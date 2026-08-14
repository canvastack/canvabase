import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { KeychainCrypto } from './KeychainCrypto.js';

describe('KeychainCrypto (AES-256-GCM fallback)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'canvabase-kc-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('encrypt/decrypt roundtrip untuk password', async () => {
    const crypto = new KeychainCrypto(dir);
    await crypto.init();
    const cipher = crypto.encrypt('SuperSecret!123');
    expect(cipher).not.toContain('SuperSecret');
    expect(crypto.decrypt(cipher)).toBe('SuperSecret!123');
  });

  it('produksi ciphertext unik per encrypt (IV random)', async () => {
    const crypto = new KeychainCrypto(dir);
    await crypto.init();
    const a = crypto.encrypt('same-password');
    const b = crypto.encrypt('same-password');
    expect(a).not.toBe(b);
  });

  it('membuat key file dengan format yang benar', async () => {
    const crypto = new KeychainCrypto(dir);
    await crypto.init();
    const raw = await readFile(join(dir, 'keychain.key'), 'utf8');
    const payload = JSON.parse(raw) as { machine: string; key: string };
    expect(payload.machine).toHaveLength(16);
    expect(payload.key.length).toBeGreaterThan(20);
  });

  it('reuse key file antar instance (persist)', async () => {
    const crypto1 = new KeychainCrypto(dir);
    await crypto1.init();
    const cipher = crypto1.encrypt('persisted-password');
    const crypto2 = new KeychainCrypto(dir);
    await crypto2.init();
    expect(crypto2.decrypt(cipher)).toBe('persisted-password');
  });

  it('menolak payload dengan format tidak valid', async () => {
    const crypto = new KeychainCrypto(dir);
    await crypto.init();
    expect(() => crypto.decrypt('garbage')).toThrow();
    expect(() => crypto.decrypt('cb1.abc.def')).toThrow();
  });

  it('throw jika dipakai sebelum init', () => {
    const crypto = new KeychainCrypto(dir);
    expect(() => crypto.encrypt('x')).toThrow(/not initialized/i);
  });
});
