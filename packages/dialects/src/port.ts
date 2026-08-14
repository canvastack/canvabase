import type { ColumnMetadata, StreamedResult, TableColumn } from '@canvabase/contracts';
import type { TableDefinition, TableDraft } from '@canvabase/contracts';

/**
 * DialectPort v1.0 — LOCKED.
 *
 * This interface is the single contract every dialect adapter must satisfy
 * (1 interface, all adapters). Additive-only after v1.0 lock:
 * - New members may be added (with sensible defaults), existing members
 *   may NOT be removed or have their signature changed in a breaking way.
 * - Adapters declare capability via `capabilities` — the UI must branch on
 *   capability, never on `name === 'mysql'`.
 */
export interface DialectCapabilities {
  ssl: boolean;
  sshTunnel: boolean;
  streaming: boolean;
  cancellation: boolean;
  editableGrid: boolean;
  tableSchema: boolean;
  ddl: boolean;
  userManagement: boolean;
  nativeJson: boolean;
  databases: boolean;
  views: boolean;
  procedures: boolean;
  triggers: boolean;
}

export interface DialectConnectionConfig {
  host: string;
  port: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: 'disabled' | 'required' | 'verify';
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  columns: ColumnMetadata[];
  /** Jumlah baris yang terpengaruh untuk statement DML (opsional, additive). */
  affected?: number;
}

/** Stringify nilai kolom metadata tanpa fallback '[object Object]'. */
export function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return value.toString();
  }
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return value.name;
  return '';
}

export interface DialectPort {
  readonly name: string;
  readonly capabilities: DialectCapabilities;
  connect(config: DialectConnectionConfig, signal?: AbortSignal): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  execute<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
    signal?: AbortSignal,
  ): Promise<QueryResult<T>>;
  stream<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<StreamedResult<T>>;
  listTables(): Promise<string[]>;
  listDatabases(): Promise<string[]>;
  listViews(): Promise<string[]>;
  listProcedures(): Promise<string[]>;
  listTriggers(): Promise<string[]>;
  listUsers(): Promise<string[]>;
  getTableSchema(table: string): Promise<TableColumn[]>;
  /**
   * Introspection lengkap untuk Table Designer (F-06) — kolom, index,
   * foreign keys, dan DDL asli (SHOW CREATE / sqlite_master / rekonstruksi).
   * Additive v1.1 — TIDAK wajib sebelum lock; adapter tanpa dukungan boleh
   * throw `UNSUPPORTED_OPERATION`.
   */
  getTableDefinition(table: string): Promise<TableDefinition>;
  /**
   * Generate DDL (CREATE TABLE) dari draft yang diedit user di Table Designer.
   * Digunakan untuk preview + apply. Additive v1.1.
   */
  previewDdl(draft: TableDraft): string;
  quoteIdentifier(identifier: string): string;
  /**
   * Placeholder parameter SQL untuk statement generasi otomatis.
   * mysql/sqlite: `?`; postgresql: `$1`..`$n` (position 1-based).
   */
  parameterPlaceholder(position: number): string;
}
