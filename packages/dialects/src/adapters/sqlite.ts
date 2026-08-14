import type {
  ColumnMetadata,
  StreamedResult,
  TableColumn,
  TableDefinition,
  TableDraft,
  DesignerIndex,
  DesignerForeignKey,
} from '@canvabase/contracts';
import type {
  DialectCapabilities,
  DialectConnectionConfig,
  DialectPort,
  QueryResult,
} from '../port.js';
import { formatDefault, primaryKeyColumns } from '../ddl.js';
import {
  createSqliteDriver,
  type SqliteDatabase,
  type SqliteStatement,
  type SQLInputValue,
} from './sqlite-driver.js';

const capabilities: DialectCapabilities = {
  ssl: false,
  sshTunnel: false,
  streaming: false,
  cancellation: false,
  editableGrid: true,
  tableSchema: true,
  ddl: true,
  userManagement: false,
  nativeJson: false,
  databases: false,
  views: true,
  procedures: false,
  triggers: true,
};

function toPlain<T>(row: Record<string, unknown> | null | undefined): T {
  return (row ? { ...row } : null) as T;
}

function toColumns(stmt: SqliteStatement): ColumnMetadata[] {
  return stmt.columns().map((c) => ({
    name: c.name,
    type: String(c.type ?? 'TEXT'),
    nullable: true,
  }));
}

export class SQLiteAdapter implements DialectPort {
  readonly name = 'sqlite';
  readonly capabilities = capabilities;
  private db: SqliteDatabase | null = null;
  private driverUsed: 'node:sqlite' | 'better-sqlite3' | null = null;

  /** Driver yang aktif saat ini (untuk testing/diagnostik). */
  get usedDriver(): 'node:sqlite' | 'better-sqlite3' | null {
    return this.driverUsed;
  }

  async connect(config: DialectConnectionConfig, _signal?: AbortSignal): Promise<void> {
    const driver = await createSqliteDriver();
    const file = config.database && config.database.length > 0 ? config.database : ':memory:';
    this.db = driver.openDatabase(file);
    this.driverUsed = driver.used;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    _signal?: AbortSignal,
  ): Promise<QueryResult<T>> {
    if (!this.db) throw new Error('sqlite: not connected');
    const stmt = this.db.prepare(sql);
    const args = params as unknown as SQLInputValue[];
    const columns = toColumns(stmt);
    if (columns.length > 0) {
      const rows = stmt.all(...args).map((r) => toPlain<T>(r as Record<string, unknown>));
      return { rows, columns };
    }
    const changes = Number(stmt.run(...args).changes);
    return { rows: [], columns: [], affected: changes };
  }

  stream<T = Record<string, unknown>>(
    _sql: string,
    _params?: unknown[],
  ): Promise<StreamedResult<T>> {
    return Promise.reject(
      new Error('sqlite: streaming not supported (synchronous driver)'),
    );
  }

  async listTables(): Promise<string[]> {
    const result = await this.execute<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    return result.rows.map((r: { name: string }) => r.name);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listDatabases(): Promise<string[]> {
    return [];
  }

  async listViews(): Promise<string[]> {
    const result = await this.execute<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'view' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    return result.rows.map((r: { name: string }) => r.name);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listProcedures(): Promise<string[]> {
    return [];
  }

  async listTriggers(): Promise<string[]> {
    const result = await this.execute<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    return result.rows.map((r: { name: string }) => r.name);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listUsers(): Promise<string[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getTableSchema(table: string): Promise<TableColumn[]> {
    if (!this.db) throw new Error('sqlite: not connected');
    const info = this.db
      .prepare(`PRAGMA table_info(${this.quoteIdentifier(table)})`)
      .all() as unknown as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;
    const ddlRow = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { sql: string | null } | undefined;
    const hasAutoInc = /\bAUTOINCREMENT\b/i.test(ddlRow?.sql ?? '');
    return info.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      primaryKey: col.pk > 0,
      autoIncrement: col.pk > 0 && hasAutoInc,
      default: col.dflt_value ?? null,
    }));
  }

  async getTableDefinition(table: string): Promise<TableDefinition> {
    if (!this.db) throw new Error('sqlite: not connected');
    const columns = (await this.getTableSchema(table)).map((c) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
      default: c.default,
      autoIncrement: c.autoIncrement,
      isPrimaryKey: c.primaryKey,
    }));

    const indexes = this.listIndexes(table);
    const foreignKeys = this.listForeignKeys(table);

    const ddlRow = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { sql: string | null } | undefined;
    const ddl =
      ddlRow?.sql ?? this.previewDdl({ name: table, schema: null, columns, indexes, foreignKeys });

    return { name: table, schema: null, columns, indexes, foreignKeys, ddl };
  }

  private listIndexes(table: string): DesignerIndex[] {
    if (!this.db) throw new Error('sqlite: not connected');
    const list = this.db
      .prepare(`PRAGMA index_list(${this.quoteIdentifier(table)})`)
      .all() as unknown as Array<{
      seq: number;
      name: string;
      unique: number;
      origin: string;
    }>;
    const result: DesignerIndex[] = [];
    for (const idx of list) {
      if (idx.origin === 'pk') continue;
      if (idx.name.startsWith('sqlite_autoindex_')) continue;
      const info = this.db
        .prepare(`PRAGMA index_info(${this.quoteIdentifier(idx.name)})`)
        .all() as unknown as Array<{ seqno: number; cid: number; name: string | null }>;
      result.push({
        name: idx.name,
        unique: idx.unique === 1,
        columns: info.map((c) => c.name ?? '').filter((n) => n.length > 0),
      });
    }
    return result;
  }

  private listForeignKeys(table: string): DesignerForeignKey[] {
    if (!this.db) throw new Error('sqlite: not connected');
    const list = this.db
      .prepare(`PRAGMA foreign_key_list(${this.quoteIdentifier(table)})`)
      .all() as unknown as Array<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string | null;
      on_delete: string | null;
    }>;
    const grouped = new Map<number, DesignerForeignKey>();
    for (const fk of list) {
      const existing = grouped.get(fk.id);
      if (existing) {
        existing.columns.push(fk.from);
        if (fk.to) existing.refColumns.push(fk.to);
      } else {
        grouped.set(fk.id, {
          name: `${table}_fk_${fk.id}`,
          columns: [fk.from],
          refTable: fk.table,
          refColumns: fk.to ? [fk.to] : [],
          onDelete: fk.on_delete === 'NO ACTION' ? null : fk.on_delete,
        });
      }
    }
    return [...grouped.values()];
  }

  previewDdl(draft: TableDraft): string {
    const q = (v: string): string => this.quoteIdentifier(v);
    const lines: string[] = [];
    const pk = primaryKeyColumns(draft.columns);
    const pkSingleAutoInc = pk.length === 1 && pk[0]?.autoIncrement === true;
    for (const c of draft.columns) {
      let line = `  ${q(c.name)} ${c.type}`;
      if (pkSingleAutoInc && c.isPrimaryKey) line += ' PRIMARY KEY AUTOINCREMENT';
      if (!c.nullable && !c.isPrimaryKey) line += ' NOT NULL';
      const def = formatDefault(c.default);
      if (def.length > 0) line += ` DEFAULT ${def}`;
      lines.push(line);
    }
    if (pk.length > 0 && !pkSingleAutoInc) {
      lines.push(`  PRIMARY KEY (${pk.map((c) => q(c.name)).join(', ')})`);
    }
    for (const fk of draft.foreignKeys) {
      let clause = `  FOREIGN KEY (${fk.columns.map((c) => q(c)).join(', ')}) REFERENCES ${q(fk.refTable)} (${fk.refColumns.map((c) => q(c)).join(', ')})`;
      if (fk.onDelete) clause += ` ON DELETE ${fk.onDelete}`;
      lines.push(clause);
    }
    let sql = `CREATE TABLE ${q(draft.name)} (\n${lines.join(',\n')}\n)`;
    for (const idx of draft.indexes) {
      const kind = idx.unique ? 'CREATE UNIQUE INDEX' : 'CREATE INDEX';
      sql += `\n${kind} ${q(idx.name)} ON ${q(draft.name)} (${idx.columns.map((c) => q(c)).join(', ')})`;
    }
    return sql;
  }

  quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  parameterPlaceholder(_position: number): string {
    return '?';
  }
}
