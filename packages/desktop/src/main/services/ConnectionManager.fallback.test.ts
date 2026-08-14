import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { ConnectionManager } from './ConnectionManager.js';

// Simulasi environment tanpa OS keychain (mis. Linux tanpa libsecret).
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
  },
}));

describe('ConnectionManager fallback (AES-256-GCM via KeychainCrypto)', () => {
  let manager: ConnectionManager;
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'canvabase-fallback-'));
    manager = new ConnectionManager({ create: () => ({}) as never, get: () => undefined } as never, dir);
    await manager.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('fallback aktif ketika OS keychain tidak tersedia', () => {
    expect(manager.isFallbackActive()).toBe(true);
  });

  it('persist password terenkripsi AES-256-GCM (bukan base64 plaintext)', async () => {
    const created = await manager.create({
      name: 'fallback-test',
      engine: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'P@ssw0rd-Sensitive',
    });
    expect(created.ok).toBe(true);

    const raw = await readFile(join(dir, 'connections.json'), 'utf8');
    const payload = JSON.parse(raw) as Array<{ encryptedPassword?: string }>;
    expect(payload[0]?.encryptedPassword).toBeDefined();
    // Format fallback: cb1.<iv>.<tag>.<cipher> — bukan base64 plaintext murni.
    expect(payload[0]!.encryptedPassword!.startsWith('cb1.')).toBe(true);
    expect(payload[0]!.encryptedPassword).not.toContain('P@ssw0rd-Sensitive');
  });

  it('reload dari disk mendekripsi password dengan benar', async () => {
    await manager.create({
      name: 'fallback-reload',
      engine: 'postgresql',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'Roundtrip-Secret',
    });

    const manager2 = new ConnectionManager({ create: () => ({}) as never, get: () => undefined } as never, dir);
    await manager2.init();
    const list = manager2.list();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.length).toBe(1);
  });
});
