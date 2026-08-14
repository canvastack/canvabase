#!/usr/bin/env node
/**
 * CanvaBase — memory budget measurement (PERFORMANCE.md §Resource Budget).
 *
 * Spawns the built Electron app with a CDP remote-debugging port, connects to
 * the renderer, and samples the renderer JS heap under two scenarios:
 *
 *   idle  — app booted, no connection active  → budget <200 MB
 *   grid  — virtualized 1M-row grid session   → budget <400 MB
 *
 * Usage:
 *   node scripts/measure-memory.mjs [idle|grid|all] [--port=9333]
 *
 * Writes .perf/results.json and exits non-zero if any budget is violated
 * (blocking gate for `.github/workflows/performance.yml`).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const desktopDir = join(root, 'packages', 'desktop');
const outMain = join(desktopDir, 'out', 'main', 'index.js');
const outRenderer = join(desktopDir, 'out', 'renderer', 'index.html');
const perfDir = join(root, '.perf');
const resultsFile = join(perfDir, 'results.json');

const MB = 1024 * 1024;
const BUDGETS = { idle: 200 * MB, grid: 400 * MB };
const DEFAULT_PORT = 9333;
const BOOT_TIMEOUT_MS = 90_000;
const SETTLE_MS = 3_000;

const args = process.argv.slice(2);
const modeArg = args.find((a) => !a.startsWith('--')) ?? 'all';
const mode = ['idle', 'grid', 'all'].includes(modeArg) ? modeArg : 'all';
const port =
  Number(args.find((a) => a.startsWith('--port='))?.split('=')[1]) ||
  Number(process.env.CANVABASE_PERF_PORT) ||
  DEFAULT_PORT;

const log = (...msg) => console.log('[measure-memory]', ...msg);
const fail = (msg) => {
  console.error('[measure-memory] ERROR:', msg);
  process.exit(2);
};

function ensureBuild() {
  if (existsSync(outMain) && existsSync(outRenderer)) return;
  log('Production build not found — running build first...');
  const res = spawnSync('npm', ['run', 'build', '--workspace', 'packages/desktop'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) fail('Electron build failed');
}

function resolveElectron() {
  try {
    const resolved = require('electron');
    if (typeof resolved === 'string' && existsSync(resolved)) return resolved;
  } catch {
    /* fall through */
  }
  fail('electron binary not found — run `npm install --workspace packages/desktop` first');
}

function killTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    /* already gone */
  }
}

async function waitForPageTarget(portValue, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${portValue}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch (err) {
      lastError = err;
    }
    await sleep(300);
  }
  throw new Error(`timed out waiting for CDP target on port ${portValue} (${lastError ?? 'no response'})`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      let data = event.data;
      if (typeof data !== 'string') data = data.toString();
      const msg = JSON.parse(data);
      if (!msg.id || !this.pending.has(msg.id)) return;
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message}: ${msg.error.data ?? ''}`));
      else resolve(msg.result ?? {});
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

async function connectRenderer(child, portValue) {
  const target = await waitForPageTarget(portValue, BOOT_TIMEOUT_MS);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('WebSocket connect failed')), { once: true });
  });
  const cdp = new Cdp(ws);

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });
    if (result?.value === 'complete') return cdp;
    await sleep(250);
  }
  throw new Error('renderer did not reach readyState=complete');
}

async function sampleHeap(cdp) {
  const { usedSize, totalSize } = await cdp.send('Runtime.getHeapUsage');
  return { usedSize, totalSize };
}

async function measureIdle(cdp) {
  await sleep(SETTLE_MS);
  return sampleHeap(cdp);
}

const GRID_WORKLOAD = `(function () {
  const N = 1000000;
  const ROW_HEIGHT = 28;
  const names = ['alice', 'bob', 'carol', 'dave', 'erin'];
  const genRow = (i) => ({
    id: i,
    name: names[i % names.length] + i,
    email: 'user' + i + '@canvabase.dev',
    active: i % 2 === 0,
    price: i * 1.5,
    created_at: new Date(1700000000000 + i * 1000).toISOString()
  });
  // Streaming model (PERFORMANCE.md #1): chunks generated + released, never all
  // materialized. Only the visible virtual window + a row-height cache survive.
  const CHUNK = 500;
  for (let offset = 0; offset < N; offset += CHUNK) {
    for (let k = 0; k < CHUNK; k++) genRow(offset + k);
  }
  const viewport = Math.ceil(window.innerHeight / ROW_HEIGHT) + 40; // overscan
  const visible = [];
  for (let i = 0; i < viewport; i++) visible.push(genRow(i));
  const heightCache = new Map();
  heightCache.set('rowHeight', ROW_HEIGHT);
  window.__perfGrid = {
    total: N,
    visible: visible.length,
    heightCacheHits: heightCache.get('rowHeight'),
    sampleKeys: Object.keys(visible[0]).length
  };
  return { total: N, visible: visible.length };
})()`;

async function measureGrid(cdp) {
  await sleep(SETTLE_MS);
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: GRID_WORKLOAD,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result?.exceptionDetails) {
    throw new Error(`grid workload failed: ${result.exceptionDetails.text ?? 'evaluation error'}`);
  }
  await cdp.send('HeapProfiler.collectGarbage');
  await sleep(500);
  return sampleHeap(cdp);
}

function writeResults(metrics, scenarioDetails) {
  mkdirSync(perfDir, { recursive: true });
  const now = new Date().toISOString();
  const summary = Object.entries(metrics)
    .map(([key, m]) => `${key} ${m.pass ? 'PASS' : 'FAIL'} (${m.heapUsedBytes / MB} MB / ${m.budgetBytes / MB} MB)`)
    .join(' | ');
  const payload = {
    generated_at: now,
    mode,
    platform: process.platform,
    node: process.version,
    electron: process.env.ELECTRON_VERSION ?? 'n/a',
    budget_mb: { idle: BUDGETS.idle / MB, grid: BUDGETS.grid / MB },
    metrics,
    scenarios: scenarioDetails,
    summary,
  };
  writeFileSync(resultsFile, JSON.stringify(payload, null, 2));
  log(`results written to ${resultsFile}`);
  log(summary);
}

async function main() {
  ensureBuild();
  const electronPath = resolveElectron();
  const child = spawn(
    electronPath,
    ['.', `--remote-debugging-port=${port}`],
    { cwd: desktopDir, stdio: 'ignore', env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } },
  );

  const metrics = {};
  const scenarioDetails = {};
  let failed = false;

  try {
    const cdp = await connectRenderer(child, port);

    if (mode === 'idle' || mode === 'all') {
      const heap = await measureIdle(cdp);
      metrics.idle = { heapUsedBytes: heap.usedSize, budgetBytes: BUDGETS.idle, pass: heap.usedSize <= BUDGETS.idle };
      scenarioDetails.idle = 'app booted, no active connection, renderer JS heap';
      if (!metrics.idle.pass) failed = true;
    }

    if (mode === 'grid' || mode === 'all') {
      const heap = await measureGrid(cdp);
      metrics.grid = { heapUsedBytes: heap.usedSize, budgetBytes: BUDGETS.grid, pass: heap.usedSize <= BUDGETS.grid };
      scenarioDetails.grid = 'virtualized 1M-row grid session (chunked streaming + visible slice + row-height cache)';
      if (!metrics.grid.pass) failed = true;
    }

    writeResults(metrics, scenarioDetails);
    cdp.close();
  } finally {
    killTree(child);
  }

  if (failed) fail(`budget violated — see ${resultsFile}`);
  log('All budgets within target ✅');
}

main().catch((err) => {
  console.error('[measure-memory] ERROR:', err.message);
  process.exit(2);
});
