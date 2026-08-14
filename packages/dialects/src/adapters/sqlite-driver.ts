import { createRequire } from 'node:module';

/**
 * Dual-driver SQLite abstraction.
 *
 * Primary: `node:sqlite` (built-in Node >= 22.5, zero-dependency).
 * Fallback: `better-sqlite3` (native module, jalan di Electron < 35 / Node 20).
 *
 * Alasan: Electron 33.x membundel Node 20.18 yang TIDAK punya `node:sqlite`.
 * Tanpa fallback ini, koneksi SQLite di packaged app akan crash
 * (ERR_UNKNOWN_BUILTIN_MODULE). Lihat PRD-F-01.3 (dual-driver strategy).
 */

export type SQLInputValue = string | number | bigint | Uint8Array | null;

export interface SqliteStatement {
  columns(): Array<{ name: string; type?: string | null }>;
  all(...params: SQLInputValue[]): unknown[];
  get(...params: SQLInputValue[]): unknown;
  run(...params: SQLInputValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

export interface SqliteDatabase {
  close(): void;
  prepare(sql: string): SqliteStatement;
  exec?(sql: string): void;
}

export interface SqliteDriver {
  /** Driver yang sedang aktif. */
  readonly used: 'node:sqlite' | 'better-sqlite3';
  openDatabase(path: string): SqliteDatabase;
}

const require = createRequire(import.meta.url);

async function loadNodeSqlite(): Promise<SqliteDriver | null> {
  try {
    const mod = (await import('node:sqlite')) as {
      DatabaseSync: new (path: string) => SqliteDatabase;
    };
    return {
      used: 'node:sqlite',
      openDatabase: (path) => new mod.DatabaseSync(path),
    };
  } catch {
    return null;
  }
}

function loadBetterSqlite3(): SqliteDriver | null {
  try {
    const better = require('better-sqlite3') as (path: string) => SqliteDatabase;
    return {
      used: 'better-sqlite3',
      openDatabase: (path) => better(path),
    };
  } catch {
    return null;
  }
}

/**
 * Feature-detect: coba `node:sqlite` dulu, fallback ke `better-sqlite3`.
 * Throw jika keduanya tidak tersedia (mis. runtime terlalu lama tanpa
 * better-sqlite3 terinstall).
 */
export async function createSqliteDriver(): Promise<SqliteDriver> {
  const node = await loadNodeSqlite();
  if (node) return node;
  const better = loadBetterSqlite3();
  if (better) return better;
  throw new Error(
    'sqlite: no driver available — butuh Node >= 22.5 (node:sqlite) atau install better-sqlite3',
  );
}
