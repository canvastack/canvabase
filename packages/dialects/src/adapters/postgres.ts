import { Pool, type PoolClient, type PoolConfig } from 'pg';
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
import { toNullableString } from '../port.js';
import { formatDefault, primaryKeyColumns } from '../ddl.js';

/** Ekstrak daftar kolom dari indexdef Postgres (bagian `(...)` terakhir). */
function extractIndexColumns(indexdef: string): string[] {
  const match = /\((.*)\)/.exec(indexdef);
  if (!match?.[1]) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter((s) => s.length > 0 && !s.includes(' DESC') && !s.includes(' ASC'));
}

const capabilities: DialectCapabilities = {
  ssl: true,
  sshTunnel: true,
  streaming: false,
  cancellation: true,
  editableGrid: true,
  tableSchema: true,
  ddl: true,
  userManagement: true,
  nativeJson: true,
  databases: true,
  views: true,
  procedures: true,
  triggers: true,
};

function toColumns(rows: unknown, fields?: Array<{ name: string; dataTypeID: number }>): ColumnMetadata[] {
  void rows;
  if (!fields) return [];
  return fields.map((f) => ({
    name: f.name,
    type: String(f.dataTypeID),
    nullable: true,
  }));
}

function buildPool(config: DialectConnectionConfig): PoolConfig {
  return {
    host: config.host,
    port: config.port,
    connectionTimeoutMillis: 10_000,
    max: 5,
    password: config.password ?? '',
    ...(config.database ? { database: config.database } : {}),
    ...(config.username ? { user: config.username } : {}),
    ...(config.ssl && config.ssl !== 'disabled'
      ? { ssl: { rejectUnauthorized: config.ssl === 'verify' } }
      : {}),
  };
}

export class PostgreSQLAdapter implements DialectPort {
  readonly name = 'postgresql';
  readonly capabilities = capabilities;
  private pool: Pool | null = null;

  async connect(config: DialectConnectionConfig, _signal?: AbortSignal): Promise<void> {
    this.pool = new Pool(buildPool(config));
    await this.pool.query('SELECT 1');
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async execute<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    signal?: AbortSignal,
  ): Promise<QueryResult<T>> {
    if (!this.pool) throw new Error('postgresql: not connected');
    if (signal?.aborted) throw new Error('cancelled');

    const client = await this.pool.connect();
    let cancelled = false;
    try {
      if (signal) {
        try {
          return await this.runCancellable<T>(client, sql, params, signal);
        } catch (err) {
          if (err instanceof Error && err.message.toLowerCase().includes('cancelled')) {
            cancelled = true;
          }
          throw err;
        }
      }
      const result = await client.query(sql, params);
      return {
        rows: result.rows as T[],
        columns: toColumns(result.rows, result.fields),
        ...(typeof result.rowCount === 'number' ? { affected: result.rowCount } : {}),
      };
    } finally {
      if (cancelled) {
        client.release(true);
      } else {
        client.release();
      }
    }
  }

  private async runCancellable<T>(
    client: PoolClient,
    sql: string,
    params: unknown[],
    signal: AbortSignal,
  ): Promise<QueryResult<T>> {
    const pid = (client as PoolClient & { processID: number }).processID;

    const abortPromise = new Promise<never>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          void this.cancelBackend(pid);
          reject(new Error('cancelled'));
        },
        { once: true },
      );
    });

    const queryPromise = client.query(sql, params);
    const result = await Promise.race([queryPromise, abortPromise]);
    return {
      rows: result.rows as T[],
      columns: toColumns(result.rows, result.fields),
      ...(typeof result.rowCount === 'number' ? { affected: result.rowCount } : {}),
    };
  }

  private async cancelBackend(pid: number): Promise<void> {
    try {
      const canceller = await this.pool!.connect();
      try {
        await canceller.query(`SELECT pg_cancel_backend(${pid})`);
      } finally {
        canceller.release();
      }
    } catch {
      // best-effort cancel — query will resolve on its own if it fails
    }
  }

  stream<T = Record<string, unknown>>(
    _sql: string,
    _params?: unknown[],
  ): Promise<StreamedResult<T>> {
    return Promise.reject(new Error('postgresql: streaming not supported (use pg-cursor in v1.1)'));
  }

  async listTables(): Promise<string[]> {
    const result = await this.execute<{ schemaname: string; tablename: string }>(
      "SELECT schemaname, tablename FROM pg_catalog.pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, tablename",
    );
    return result.rows.map((r) =>
      r.schemaname === 'public' ? r.tablename : `${r.schemaname}.${r.tablename}`,
    );
  }

  async listDatabases(): Promise<string[]> {
    const result = await this.execute<{ datname: string }>(
      "SELECT datname FROM pg_catalog.pg_database WHERE datistemplate = false ORDER BY datname",
    );
    return result.rows.map((r: { datname: string }) => r.datname);
  }

  async listViews(): Promise<string[]> {
    const result = await this.execute<{ schemaname: string; viewname: string }>(
      "SELECT schemaname, viewname FROM pg_catalog.pg_views WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, viewname",
    );
    return result.rows.map((r) =>
      r.schemaname === 'public' ? r.viewname : `${r.schemaname}.${r.viewname}`,
    );
  }

  async listProcedures(): Promise<string[]> {
    const result = await this.execute<{ routine_schema: string; routine_name: string }>(
      "SELECT routine_schema, routine_name FROM information_schema.routines WHERE routine_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY routine_schema, routine_name",
    );
    return result.rows.map((r) =>
      r.routine_schema === 'public' ? r.routine_name : `${r.routine_schema}.${r.routine_name}`,
    );
  }

  async listTriggers(): Promise<string[]> {
    const result = await this.execute<{ trigger_name: string }>(
      "SELECT t.tgname AS trigger_name FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON t.tgrelid = c.oid JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND NOT t.tgisinternal ORDER BY trigger_name",
    );
    return result.rows.map((r: { trigger_name: string }) => r.trigger_name);
  }

  async listUsers(): Promise<string[]> {
    const result = await this.execute<{ rolname: string }>(
      "SELECT rolname FROM pg_catalog.pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY rolname",
    );
    return result.rows.map((r: { rolname: string }) => r.rolname);
  }

  async getTableSchema(table: string): Promise<TableColumn[]> {
    let schema = 'public';
    let tableName = table;
    const cleaned = table.replace(/"/g, '');
    if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      schema = parts[0] ?? 'public';
      tableName = parts[1] ?? table;
    }

    const result = await this.execute<{
      name: string;
      type: string;
      nullable: boolean;
      primaryKey: boolean;
      autoIncrement: boolean;
      default: unknown;
    }>(
      `SELECT c.column_name AS "name",
              c.data_type AS "type",
              (c.is_nullable = 'YES') AS "nullable",
              (pk.column_name IS NOT NULL) AS "primaryKey",
              (c.is_identity = 'YES' OR c.column_default LIKE 'nextval(%') AS "autoIncrement",
              c.column_default AS "default"
       FROM information_schema.columns c
       LEFT JOIN (
         SELECT ku.column_name, ku.table_schema, ku.table_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage ku
           ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
       ) pk
         ON pk.table_schema = c.table_schema
        AND pk.table_name = c.table_name
        AND pk.column_name = c.column_name
       WHERE (c.table_schema = $1 OR ($1 = 'public' AND c.table_schema = current_schema())) AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, tableName],
    );
    return result.rows.map((r) => ({
      name: r.name,
      type: r.type,
      nullable: r.nullable,
      primaryKey: r.primaryKey,
      autoIncrement: r.autoIncrement,
      default: toNullableString(r.default),
    }));
  }

  async getTableDefinition(table: string): Promise<TableDefinition> {
    const columns = (await this.getTableSchema(table)).map((c) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
      default: c.default,
      autoIncrement: c.autoIncrement,
      isPrimaryKey: c.primaryKey,
    }));

    const [indexes, foreignKeys] = await Promise.all([
      this.listIndexes(table),
      this.listForeignKeys(table),
    ]);

    const ddl = this.previewDdl({ name: table, schema: null, columns, indexes, foreignKeys });
    return { name: table, schema: null, columns, indexes, foreignKeys, ddl };
  }

  private async listIndexes(table: string): Promise<DesignerIndex[]> {
    const result = await this.execute<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_catalog.pg_indexes
       WHERE schemaname = current_schema() AND tablename = $1`,
      [table],
    );
    const indexes: DesignerIndex[] = [];
    for (const row of result.rows) {
      if (row.indexdef.includes(' PRIMARY KEY')) continue;
      const cols = extractIndexColumns(row.indexdef);
      if (cols.length === 0) continue;
      indexes.push({
        name: row.indexname,
        unique: row.indexdef.includes('UNIQUE'),
        columns: cols,
      });
    }
    return indexes;
  }

  private async listForeignKeys(table: string): Promise<DesignerForeignKey[]> {
    const result = await this.execute<{
      constraint_name: string;
      column_name: string;
      ref_table: string;
      ref_column: string;
      delete_rule: string;
    }>(
      `SELECT tc.constraint_name, kcu.column_name,
              ccu.table_name AS ref_table,
              ccu.column_name AS ref_column,
              rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = current_schema()
         AND tc.table_name = $1
       ORDER BY tc.constraint_name, kcu.ordinal_position`,
      [table],
    );
    const grouped = new Map<string, DesignerForeignKey>();
    for (const row of result.rows) {
      const existing = grouped.get(row.constraint_name);
      if (existing) {
        existing.columns.push(row.column_name);
        existing.refColumns.push(row.ref_column);
      } else {
        grouped.set(row.constraint_name, {
          name: row.constraint_name,
          columns: [row.column_name],
          refTable: row.ref_table,
          refColumns: [row.ref_column],
          onDelete: row.delete_rule === 'NO ACTION' ? null : row.delete_rule,
        });
      }
    }
    return [...grouped.values()];
  }

  previewDdl(draft: TableDraft): string {
    const q = (v: string): string => this.quoteIdentifier(v);
    const lines: string[] = [];
    for (const c of draft.columns) {
      let line = `  ${q(c.name)} ${c.type}`;
      if (c.autoIncrement) line += ' GENERATED BY DEFAULT AS IDENTITY';
      if (!c.nullable) line += ' NOT NULL';
      const def = formatDefault(c.default);
      if (def.length > 0) line += ` DEFAULT ${def}`;
      lines.push(line);
    }
    const pk = primaryKeyColumns(draft.columns);
    if (pk.length > 0) {
      lines.push(`  PRIMARY KEY (${pk.map((c) => q(c.name)).join(', ')})`);
    }
    for (const idx of draft.indexes) {
      const kind = idx.unique ? 'UNIQUE' : 'INDEX';
      lines.push(`  ${kind} ${q(idx.name)} (${idx.columns.map((c) => q(c)).join(', ')})`);
    }
    for (const fk of draft.foreignKeys) {
      let line = `  CONSTRAINT ${q(fk.name)} FOREIGN KEY (${fk.columns.map((c) => q(c)).join(', ')}) REFERENCES ${q(fk.refTable)} (${fk.refColumns.map((c) => q(c)).join(', ')})`;
      if (fk.onDelete) line += ` ON DELETE ${fk.onDelete}`;
      lines.push(line);
    }
    return `CREATE TABLE ${q(draft.name)} (\n${lines.join(',\n')}\n);`;
  }

  quoteIdentifier(identifier: string): string {
    const cleaned = identifier.replace(/"/g, '');
    if (cleaned.includes('.')) {
      const parts = cleaned.split('.');
      return `"${parts[0] ?? ''}"."${parts[1] ?? ''}"`;
    }
    return `"${cleaned}"`;
  }

  parameterPlaceholder(position: number): string {
    return `$${position}`;
  }
}
