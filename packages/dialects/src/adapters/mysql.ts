import promiseMysql from 'mysql2/promise';
import { createConnection as createRawConnection, type Connection } from 'mysql2';
import type {
  ColumnMetadata,
  StreamedResult,
  Chunk,
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

const capabilities: DialectCapabilities = {
  ssl: true,
  sshTunnel: false,
  streaming: true,
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

const CHUNK_SIZE = 500;

function toColumns(fields?: promiseMysql.FieldPacket[]): ColumnMetadata[] {
  if (!fields) return [];
  return fields.map((f) => ({
    name: f.name,
    type: String(f.type),
    nullable: typeof f.flags === 'number' ? (f.flags & 1) === 0 : true,
  }));
}

function buildSsl(config: DialectConnectionConfig): promiseMysql.SslOptions | undefined {
  if (config.ssl === 'verify') return { rejectUnauthorized: true };
  if (config.ssl === 'required') return { rejectUnauthorized: false };
  return undefined;
}

export class MySQLAdapter implements DialectPort {
  readonly name = 'mysql';
  readonly capabilities = capabilities;
  private pool: promiseMysql.Pool | null = null;
  private streamConn: Connection | null = null;
  private config: DialectConnectionConfig | null = null;

  async connect(config: DialectConnectionConfig, _signal?: AbortSignal): Promise<void> {
    const ssl = buildSsl(config);
    this.pool = promiseMysql.createPool({
      host: config.host,
      port: config.port,
      connectionLimit: 5,
      password: config.password ?? '',
      ...(config.database ? { database: config.database } : {}),
      ...(config.username ? { user: config.username } : {}),
      ...(ssl ? { ssl } : {}),
    });
    this.config = config;
    await this.pool.query('SELECT 1');
  }

  async disconnect(): Promise<void> {
    if (this.streamConn) {
      this.streamConn.destroy();
      this.streamConn = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.config = null;
  }

  isConnected(): boolean {
    return this.pool !== null;
  }

  async execute<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    signal?: AbortSignal,
  ): Promise<QueryResult<T>> {
    if (!this.pool) throw new Error('mysql: not connected');
    if (signal?.aborted) throw new Error('cancelled');

    const abortPromise = new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
    });

    const queryPromise = this.pool.query(sql, params);
    const [rows, fields] = await Promise.race([queryPromise, abortPromise]);
    if (!fields || fields.length === 0) {
      const header = (Array.isArray(rows) ? rows[0] : rows) as
        | { affectedRows?: number }
        | undefined;
      return { rows: [], columns: [], affected: header?.affectedRows ?? 0 };
    }
    return { rows: rows as T[], columns: toColumns(fields) };
  }

  stream<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<StreamedResult<T>> {
    if (!this.pool || !this.config) throw new Error('mysql: not connected');
    this.streamConn = createRawConnection({
      host: this.config.host,
      port: this.config.port,
      ...(this.config.database ? { database: this.config.database } : {}),
      ...(this.config.username ? { user: this.config.username } : {}),
      ...(this.config.password ? { password: this.config.password } : {}),
    });

    const query = this.streamConn.query(sql, params);
    const rowStream = query.stream();
    let cancelled = false;

    const queue: Chunk<T>[] = [];
    const waiters: Array<() => void> = [];
    let finished = false;
    let streamError: unknown = null;

    rowStream.on('end', () => {
      if (buffer.length > 0) {
        queue.push({ rows: buffer.splice(0, buffer.length), hasMore: false, offset: 0 });
      }
      finished = true;
      this.streamConn?.destroy();
      waiters.splice(0).forEach((w) => w());
    });
    rowStream.on('error', (err: Error) => {
      streamError = err;
      finished = true;
      this.streamConn?.destroy();
      waiters.splice(0).forEach((w) => w());
    });

    async function pull(): Promise<Chunk<T> | null> {
      while (queue.length === 0 && !finished) {
        await new Promise<void>((resolve) => waiters.push(resolve));
      }
      if (queue.length > 0) return queue.shift()!;
      return null;
    }

    const buffer: T[] = [];
    rowStream.on('data', (row: T) => {
      buffer.push(row);
      if (buffer.length >= CHUNK_SIZE) {
        queue.push({ rows: buffer.splice(0, CHUNK_SIZE), hasMore: true, offset: 0 });
        waiters.splice(0).forEach((w) => w());
      }
    });

    const chunks: AsyncIterator<Chunk<T>> = {
      next: async () => {
        if (cancelled) return { done: true, value: undefined };
        const chunk = await pull();
        if (streamError) {
          if (streamError instanceof Error) throw streamError;
          const message =
            typeof streamError === 'string'
              ? streamError
              : JSON.stringify(streamError);
          throw new Error(message ?? 'mysql: unknown stream error');
        }
        if (!chunk) return { done: true, value: undefined };
        return { done: false, value: chunk };
      },
    };

    return Promise.resolve({
      metadata: { totalRows: null, columns: [] },
      chunks,
      pause: () => {
        rowStream.pause();
      },
      resume: () => {
        rowStream.resume();
      },
      cancel: () => {
        cancelled = true;
        this.streamConn?.destroy();
        this.streamConn = null;
        return Promise.resolve();
      },
    });
  }

  async listTables(): Promise<string[]> {
    const result = await this.execute<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
    );
    return result.rows.map((r: { TABLE_NAME: string }) => r.TABLE_NAME);
  }

  async listDatabases(): Promise<string[]> {
    const result = await this.execute<{ SCHEMA_NAME: string }>(
      'SELECT SCHEMA_NAME FROM information_schema.schemata ORDER BY SCHEMA_NAME',
    );
    return result.rows.map((r: { SCHEMA_NAME: string }) => r.SCHEMA_NAME);
  }

  async listViews(): Promise<string[]> {
    const result = await this.execute<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM information_schema.views WHERE table_schema = DATABASE() ORDER BY TABLE_NAME",
    );
    return result.rows.map((r: { TABLE_NAME: string }) => r.TABLE_NAME);
  }

  async listProcedures(): Promise<string[]> {
    const result = await this.execute<{ ROUTINE_NAME: string }>(
      "SELECT ROUTINE_NAME FROM information_schema.routines WHERE routine_schema = DATABASE() AND routine_type = 'PROCEDURE' ORDER BY ROUTINE_NAME",
    );
    return result.rows.map((r: { ROUTINE_NAME: string }) => r.ROUTINE_NAME);
  }

  async listTriggers(): Promise<string[]> {
    const result = await this.execute<{ TRIGGER_NAME: string }>(
      'SELECT TRIGGER_NAME FROM information_schema.triggers WHERE trigger_schema = DATABASE() ORDER BY TRIGGER_NAME',
    );
    return result.rows.map((r: { TRIGGER_NAME: string }) => r.TRIGGER_NAME);
  }

  async listUsers(): Promise<string[]> {
    const result = await this.execute<{ USER: string; HOST: string }>(
      'SELECT User AS USER, Host AS HOST FROM mysql.user ORDER BY User',
    );
    return result.rows.map((r: { USER: string; HOST: string }) => `${r.USER}@${r.HOST}`);
  }

  async getTableSchema(table: string): Promise<TableColumn[]> {
    const result = await this.execute<{
      name: string;
      type: string;
      nullable: boolean | number;
      primaryKey: boolean | number;
      autoIncrement: boolean | number;
      default: unknown;
    }>(
      `SELECT c.COLUMN_NAME AS name,
              c.COLUMN_TYPE AS type,
              (c.IS_NULLABLE = 'YES') AS nullable,
              (k.COLUMN_NAME IS NOT NULL) AS primaryKey,
              (c.EXTRA LIKE '%auto_increment%') AS autoIncrement,
              c.COLUMN_DEFAULT AS \`default\`
       FROM information_schema.columns c
       LEFT JOIN information_schema.key_column_usage k
         ON k.TABLE_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME
        AND k.COLUMN_NAME = c.COLUMN_NAME AND k.CONSTRAINT_NAME = 'PRIMARY'
       WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = ?
       ORDER BY c.ORDINAL_POSITION`,
      [table],
    );
    return result.rows.map((r) => ({
      name: r.name,
      type: r.type,
      nullable: r.nullable === true || r.nullable === 1,
      primaryKey: r.primaryKey === true || r.primaryKey === 1,
      autoIncrement: r.autoIncrement === true || r.autoIncrement === 1,
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

    const indexes = await this.listIndexes(table);
    const foreignKeys = await this.listForeignKeys(table);

    const ddlResult = await this.execute<{ DDL: string }>(
      `SHOW CREATE TABLE ${this.quoteIdentifier(table)}`,
    );
    const ddl = ddlResult.rows[0]?.DDL ?? this.previewDdl({ name: table, schema: null, columns, indexes, foreignKeys });

    return { name: table, schema: null, columns, indexes, foreignKeys, ddl };
  }

  private async listIndexes(table: string): Promise<DesignerIndex[]> {
    const result = await this.execute<{
      INDEX_NAME: string;
      NON_UNIQUE: number;
      COLUMN_NAMES: string;
    }>(
      `SELECT INDEX_NAME, MIN(NON_UNIQUE) AS NON_UNIQUE,
              GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS COLUMN_NAMES
       FROM information_schema.statistics
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         AND INDEX_NAME <> 'PRIMARY'
       GROUP BY INDEX_NAME`,
      [table],
    );
    return result.rows.map((r) => ({
      name: r.INDEX_NAME,
      unique: r.NON_UNIQUE === 0,
      columns: r.COLUMN_NAMES.split(','),
    }));
  }

  private async listForeignKeys(table: string): Promise<DesignerForeignKey[]> {
    const result = await this.execute<{
      CONSTRAINT_NAME: string;
      COLUMN_NAME: string;
      REFERENCED_TABLE_NAME: string;
      REFERENCED_COLUMN_NAME: string;
      DELETE_RULE: string;
    }>(
      `SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME,
              k.REFERENCED_COLUMN_NAME, r.DELETE_RULE
       FROM information_schema.key_column_usage k
       LEFT JOIN information_schema.referential_constraints r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
        AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
        AND r.TABLE_NAME = k.TABLE_NAME
       WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ?
         AND k.REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
      [table],
    );
    const grouped = new Map<string, DesignerForeignKey>();
    for (const r of result.rows) {
      const existing = grouped.get(r.CONSTRAINT_NAME);
      if (existing) {
        existing.columns.push(r.COLUMN_NAME);
        existing.refColumns.push(r.REFERENCED_COLUMN_NAME);
      } else {
        grouped.set(r.CONSTRAINT_NAME, {
          name: r.CONSTRAINT_NAME,
          columns: [r.COLUMN_NAME],
          refTable: r.REFERENCED_TABLE_NAME,
          refColumns: [r.REFERENCED_COLUMN_NAME],
          onDelete: r.DELETE_RULE === 'NO ACTION' ? null : r.DELETE_RULE,
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
      if (c.autoIncrement) line += ' AUTO_INCREMENT';
      if (!c.nullable) line += ' NOT NULL';
      const def = formatDefault(c.default);
      if (def.length > 0) line += ` DEFAULT ${def}`;
      if (c.comment) line += ` COMMENT '${c.comment.replace(/'/g, "''")}'`;
      lines.push(line);
    }
    const pk = primaryKeyColumns(draft.columns);
    if (pk.length > 0) {
      lines.push(`  PRIMARY KEY (${pk.map((c) => q(c.name)).join(', ')})`);
    }
    for (const idx of draft.indexes) {
      const kind = idx.unique ? 'UNIQUE KEY' : 'KEY';
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
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  parameterPlaceholder(_position: number): string {
    return '?';
  }
}
