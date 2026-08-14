import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { arch, hostname, platform, userInfo } from 'node:os';

/**
 * Encrypted-file fallback untuk credential ketika OS keychain
 * (Electron `safeStorage`) tidak tersedia.
 *
 * Skema:
 *  - Key AES-256 random (32 byte) disimpan di file `keychain.key`
 *    dengan permission ketat (0o600).
 *  - File key diikat ke machine-binding (hostname + username + platform
 *    + arch) sehingga menyalin key file ke mesin lain tidak berguna.
 *  - Setiap password dienkripsi dengan AES-256-GCM (IV random 12 byte,
 *    auth tag 16 byte) — format: `cb1.<ivB64>.<tagB64>.<cipherB64>`.
 */
const KEY_FILE_NAME = 'keychain.key';
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM recommended nonce size
const BINDING = [hostname(), getUsername(), platform(), arch()].join('|');
const BINDING_HASH = createHash('sha256').update(BINDING).digest('hex').slice(0, 16);
const PREFIX = 'cb1';

function getUsername(): string {
  try {
    return userInfo().username;
  } catch {
    return 'unknown-user';
  }
}

interface KeyFilePayload {
  machine: string;
  key: string; // base64 32 bytes
}

export class KeychainCrypto {
  private key: Buffer | null = null;

  constructor(private readonly dataDir: string) {}

  private get keyFilePath(): string {
    return join(this.dataDir, KEY_FILE_NAME);
  }

  /** Load atau buat key file (permission 0o600). Harus dipanggil sebelum encrypt/decrypt. */
  async init(): Promise<void> {
    try {
      const raw = await readFile(this.keyFilePath, 'utf8');
      const payload = JSON.parse(raw) as KeyFilePayload;
      if (payload.machine !== BINDING_HASH) {
        throw new Error('keychain.key is bound to a different machine');
      }
      this.key = Buffer.from(payload.key, 'base64');
    } catch {
      // file tidak ada / rusak → buat baru
      this.key = randomBytes(KEY_LENGTH);
      await mkdir(this.dataDir, { recursive: true });
      const payload: KeyFilePayload = { machine: BINDING_HASH, key: this.key.toString('base64') };
      await writeFile(this.keyFilePath, JSON.stringify(payload), {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
      });
      await chmod(this.keyFilePath, 0o600).catch(() => undefined);
    }
  }

  encrypt(plaintext: string): string {
    if (!this.key) throw new Error('KeychainCrypto not initialized');
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [PREFIX, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  decrypt(encoded: string): string {
    if (!this.key) throw new Error('KeychainCrypto not initialized');
    const parts = encoded.split('.');
    if (parts.length !== 4 || parts[0] !== PREFIX) {
      throw new Error('invalid encrypted payload format');
    }
    const ivB64 = parts[1] ?? '';
    const tagB64 = parts[2] ?? '';
    const cipherB64 = parts[3] ?? '';
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
