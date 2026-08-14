import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { safeStorage } from 'electron';
import type {
  ConnectionConfig,
  ConnectionSummary,
  Engine,
  Result,
} from '@canvabase/contracts';
import { fail, ok } from '@canvabase/contracts';
import type { DialectConnectionConfig, DialectPort } from '@canvabase/dialects';
import { toClientError } from '../errors.js';
import type { DialectRegistry } from './DialectRegistry.js';
import { KeychainCrypto } from './KeychainCrypto.js';

const DEFAULT_PORT: Record<Engine, number> = {
  mysql: 3306,
  postgresql: 5432,
  sqlite: 0,
};

const DEFAULT_HOST: Record<Engine, string> = {
  mysql: 'localhost',
  postgresql: 'localhost',
  sqlite: 'localhost',
};

interface PersistedConnection {
  id: string;
  config: ConnectionConfig;
  encryptedPassword?: string;
  createdAt: number;
}

interface Session {
  dialect: DialectPort;
  config: ConnectionConfig;
}

function stripPassword(config: ConnectionConfig): ConnectionConfig {
  const { password, ...rest } = config;
  void password;
  return rest;
}

function toSummary(
  conn: PersistedConnection,
  status: ConnectionSummary['status'],
): ConnectionSummary {
  return {
    id: conn.id,
    name: conn.config.name,
    engine: conn.config.engine,
    ...(conn.config.database ? { database: conn.config.database } : {}),
    ...(conn.config.host ? { host: conn.config.host } : {}),
    ...(conn.config.port ? { port: conn.config.port } : {}),
    ...(conn.config.username ? { username: conn.config.username } : {}),
    status,
  };
}

function toDialectConfig(config: ConnectionConfig): DialectConnectionConfig {
  return {
    host: config.host ?? DEFAULT_HOST[config.engine],
    port: config.port ?? DEFAULT_PORT[config.engine],
    password: config.password ?? '',
    ...(config.database ? { database: config.database } : {}),
    ...(config.username ? { username: config.username } : {}),
    ...(config.ssl ? { ssl: config.ssl } : {}),
  };
}

export class ConnectionManager {
  private readonly connections = new Map<string, PersistedConnection>();
  private readonly sessions = new Map<string, Session>();
  private readonly filePath: string;
  private readonly fallbackCrypto: KeychainCrypto;
  private fallbackActive = false;

  constructor(
    private readonly registry: DialectRegistry,
    dataDir: string,
  ) {
    this.filePath = join(dataDir, 'connections.json');
    this.fallbackCrypto = new KeychainCrypto(dataDir);
  }

  /** True jika fallback AES-256-GCM sedang aktif (OS keychain tidak tersedia). */
  isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  async init(): Promise<void> {
    // Deteksi ketersediaan OS keychain.
    try {
      this.fallbackActive = !safeStorage.isEncryptionAvailable();
    } catch {
      this.fallbackActive = true;
    }
    if (this.fallbackActive) {
      await this.fallbackCrypto.init();
    }
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as PersistedConnection[];
      for (const conn of parsed) {
        if (conn.encryptedPassword) {
          const decrypted = this.decrypt(conn.encryptedPassword);
          conn.config = { ...conn.config, password: decrypted };
        }
        this.connections.set(conn.id, conn);
      }
    } catch {
      // first run — no store yet
    }
  }

  list(): Result<ConnectionSummary[]> {
    const summaries = [...this.connections.values()].map((conn) =>
      toSummary(conn, this.sessions.has(conn.id) ? 'connected' : 'disconnected'),
    );
    return ok(summaries);
  }

  async create(input: ConnectionConfig): Promise<Result<ConnectionSummary>> {
    const id = randomUUID();
    const conn: PersistedConnection = {
      id,
      config: { ...input },
      createdAt: Date.now(),
    };
    if (input.password) {
      conn.encryptedPassword = this.encrypt(input.password);
    }
    this.connections.set(id, conn);
    await this.persist();
    return ok(toSummary(conn, 'disconnected'));
  }

  async update(id: string, input: Partial<ConnectionConfig>): Promise<Result<ConnectionSummary>> {
    const conn = this.connections.get(id);
    if (!conn) return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_FOUND' });

    const newPassword = input.password ? input.password : conn.config.password;
    const merged: ConnectionConfig = {
      ...conn.config,
      ...input,
      ...(newPassword ? { password: newPassword } : {}),
    };

    if (newPassword) {
      conn.encryptedPassword = this.encrypt(newPassword);
    }

    conn.config = merged;
    this.connections.set(id, conn);
    await this.persist();

    // If connected session exists, update its config and reconnect if connection params changed
    const session = this.sessions.get(id);
    if (session) {
      const dbChanged = input.database !== undefined && input.database !== session.config.database;
      const hostChanged = input.host !== undefined && input.host !== session.config.host;
      const portChanged = input.port !== undefined && input.port !== session.config.port;
      const userChanged = input.username !== undefined && input.username !== session.config.username;
      const passChanged = input.password !== undefined && input.password !== session.config.password;

      session.config = merged;

      if (dbChanged || hostChanged || portChanged || userChanged || passChanged) {
        try {
          await session.dialect.disconnect();
          await session.dialect.connect(toDialectConfig(merged));
        } catch {
          this.sessions.delete(id);
        }
      }
    }

    return ok(toSummary(conn, this.sessions.has(id) ? 'connected' : 'disconnected'));
  }

  async delete(id: string): Promise<Result<{ deleted: boolean }>> {
    await this.disconnect(id);
    const deleted = this.connections.delete(id);
    await this.persist();
    return ok({ deleted });
  }

  async test(input: ConnectionConfig): Promise<Result<{ ok: boolean; latencyMs: number }>> {
    let fullConfig = input;
    if (!input.password && input.name) {
      const existing = [...this.connections.values()].find(
        (c) => c.config.name === input.name || (c.config.host === input.host && c.config.port === input.port),
      );
      if (existing?.config.password) {
        fullConfig = { ...input, password: existing.config.password };
      }
    }

    const dialect = this.registry.create(fullConfig.engine);
    const started = Date.now();
    try {
      await dialect.connect(toDialectConfig(fullConfig));
      return ok({ ok: true, latencyMs: Date.now() - started });
    } catch (err) {
      return fail(toClientError(err, 'CONNECTION_FAILED'));
    } finally {
      await dialect.disconnect();
    }
  }

  async connect(id: string): Promise<Result<ConnectionSummary>> {
    const conn = this.connections.get(id);
    if (!conn) return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_FOUND' });
    if (this.sessions.has(id)) {
      return ok(toSummary(conn, 'connected'));
    }
    const config = conn.config;
    if (!config) return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_FOUND' });
    const dialect = this.registry.create(config.engine);
    try {
      await dialect.connect(toDialectConfig(config));
      this.sessions.set(id, { dialect, config });
      return ok(toSummary(conn, 'connected'));
    } catch (err) {
      await dialect.disconnect();
      return fail(toClientError(err, 'CONNECTION_FAILED'));
    }
  }

  async disconnect(id: string): Promise<Result<{ disconnected: boolean }>> {
    const session = this.sessions.get(id);
    if (session) {
      await session.dialect.disconnect();
      this.sessions.delete(id);
    }
    return ok({ disconnected: true });
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  private encrypt(password: string): string {
    if (!this.fallbackActive) {
      return safeStorage.encryptString(password).toString('base64');
    }
    return this.fallbackCrypto.encrypt(password);
  }

  private decrypt(encoded: string): string {
    if (!this.fallbackActive) {
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    }
    return this.fallbackCrypto.decrypt(encoded);
  }

  private async persist(): Promise<void> {
    await mkdir(join(this.filePath, '..'), { recursive: true });
    const payload = [...this.connections.values()].map((conn) => ({
      id: conn.id,
      config: stripPassword(conn.config),
      ...(conn.encryptedPassword ? { encryptedPassword: conn.encryptedPassword } : {}),
      createdAt: conn.createdAt,
    }));
    await writeFile(this.filePath, JSON.stringify(payload, null, 2), 'utf8');
  }
}
