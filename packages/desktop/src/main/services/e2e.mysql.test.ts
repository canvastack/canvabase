import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createBuiltinRegistry } from './DialectRegistry.js';
import { ConnectionManager } from './ConnectionManager.js';
import { ObjectBrowserService } from './ObjectBrowserService.js';
import { QueryEngine } from './QueryEngine.js';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc:${s}`, 'utf8'),
    decryptString: (b: Buffer) => b.toString('utf8').replace(/^enc:/, ''),
  },
}));

const E2E_MYSQL_URL = process.env.CANVABASE_E2E_MYSQL ?? '';
const enabled = E2E_MYSQL_URL.length > 0;

describe.skipIf(!enabled)('E2E MySQL slice (real server)', () => {
  let manager: ConnectionManager;
  let dir: string;

  beforeEach(async () => {
    const url = new URL(E2E_MYSQL_URL);
    dir = await mkdtemp(join(tmpdir(), 'canvabase-e2e-'));
    manager = new ConnectionManager(createBuiltinRegistry(), dir);
    await manager.init();
    void url;
  });

  afterEach(async () => {
    await manager.delete('cid-e2e').catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  });

  const config = {
    name: 'e2e',
    engine: 'mysql' as const,
    host: '127.0.0.1',
    port: 3306,
    database: 'canvabase_test',
    username: 'root',
    password: '',
  };

  it('creates, connects, queries, and streams chunks end-to-end', async () => {
    const created = await manager.create(config);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.data.id;

    const connected = await manager.connect(id);
    expect(connected.ok).toBe(true);

    const engine = new QueryEngine(manager);
    const result = await engine.execute({
      connectionId: id,
      sql: 'SELECT id, name, price, stock FROM products ORDER BY id',
      signalId: 'sig-e2e',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.chunk.rows).toHaveLength(5);
    expect(result.data.chunk.hasMore).toBe(false);
    expect(result.data.columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'name', 'price', 'stock']),
    );
    expect(result.data.chunk.rows[0]).toMatchObject({ name: 'Laptop', stock: 12 });

    const list = manager.list();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const summary = list.data.find((s) => s.id === id);
    expect(summary?.status).toBe('connected');
  });

  it('reports connection failure for bad credentials', async () => {
    const bad = await manager.test({ ...config, password: 'wrong-password' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect('code' in bad.error ? bad.error.code : undefined).toBe('CONNECTION_FAILED');
  });

  it('reports NOT_CONNECTED when querying without a session', async () => {
    const engine = new QueryEngine(manager);
    const result = await engine.execute({ connectionId: 'missing', sql: 'SELECT 1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect('code' in result.error ? result.error.code : undefined).toBe('NOT_CONNECTED');
  });

  it('encrypts persisted passwords', async () => {
    const created = await manager.create({ ...config, password: 'secret-e2e' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const raw = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(dir, 'connections.json'), 'utf8'),
    );
    expect(raw).not.toContain('secret-e2e');
    expect(raw).toContain('encryptedPassword');
  });

  it('lists objects via the object browser service', async () => {
    const created = await manager.create(config);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.data.id;
    await manager.connect(id);

    const browser = new ObjectBrowserService(manager);
    const caps = browser.capabilities(id);
    expect(caps.ok).toBe(true);
    if (!caps.ok) return;
    expect(caps.data).toMatchObject({
      databases: true,
      views: true,
      procedures: true,
      triggers: true,
      userManagement: true,
    });

    const tables = await browser.listTables(id);
    expect(tables.ok).toBe(true);
    if (!tables.ok) return;
    expect(tables.data.some((t) => t.name === 'products')).toBe(true);

    const dbs = await browser.listDatabases(id);
    expect(dbs.ok).toBe(true);
    if (!dbs.ok) return;
    expect(dbs.data.some((d) => d.name === 'canvabase_test')).toBe(true);
  });
});
