import type {
  Chunk,
  ColumnMetadata,
  DataApi,
  Result,
  RowValue,
  TableSchema,
} from '@canvabase/contracts';
import { fail, ok } from '@canvabase/contracts';
import type { DialectPort } from '@canvabase/dialects';
import { toClientError } from '../errors.js';
import type { ConnectionManager } from './ConnectionManager.js';
import type { QueryEngine } from './QueryEngine.js';

const CHUNK_SIZE = 500;
const MAX_OPEN_LIMIT = 10_000;

/**
 * DataService — Data Viewer/Editor (F-05).
 *
 * Menyediakan operasi schema + CRUD untuk tabel yang di-bind ke grid.
 * Seluruh nilai user selalu parameterized; identifier dikutip via
 * `dialect.quoteIdentifier`; kolom divalidasi terhadap schema (whitelist)
 * sebelum dipakai agar identifier tidak bisa di-inject.
 */
export class DataService implements DataApi {
  constructor(
    private readonly connections: ConnectionManager,
    private readonly query: QueryEngine,
  ) {}

  private dialect(connectionId: string): DialectPort | null {
    return this.connections.getSession(connectionId)?.dialect ?? null;
  }

  async getSchema(input: { connectionId: string; table: string }): Promise<Result<TableSchema>> {
    const dialect = this.dialect(input.connectionId);
    if (!dialect) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    const table = input.table.trim();
    if (table.length === 0) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    try {
      const columns = await dialect.getTableSchema(table);
      return ok({ table, columns });
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async openTable(input: {
    connectionId: string;
    table: string;
    limit?: number;
  }): Promise<
    Result<{ chunk: Chunk<Record<string, unknown>>; columns: ColumnMetadata[]; table: string }>
  > {
    const dialect = this.dialect(input.connectionId);
    if (!dialect) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    const table = input.table.trim();
    if (table.length === 0) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? CHUNK_SIZE), MAX_OPEN_LIMIT));
    const sql = `SELECT * FROM ${dialect.quoteIdentifier(table)} LIMIT ${limit}`;
    const result = await this.query.execute({ connectionId: input.connectionId, sql });
    if (!result.ok) return result;
    return ok({ ...result.data, table });
  }

  async updateRow(input: {
    connectionId: string;
    table: string;
    where: RowValue[];
    changes: RowValue[];
  }): Promise<Result<{ affected: number }>> {
    const dialect = this.dialect(input.connectionId);
    if (!dialect) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    const table = input.table.trim();
    const schema = await this.schemaOrFail(dialect, table);
    if (schema instanceof Error) return this.schemaFail();
    if (input.changes.length === 0) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const where = this.validateKeys(schema.columns, input.where);
    const changes = this.validateKeys(schema.columns, input.changes);
    if (!where || !changes) return this.schemaFail();

    const setClause = changes
      .map((c, i) => `${dialect.quoteIdentifier(c.column)} = ${dialect.parameterPlaceholder(i + 1)}`)
      .join(', ');
    const params: unknown[] = [...changes.map((c) => c.value)];
    const whereParts = where.map(
      (w, i) => `${dialect.quoteIdentifier(w.column)} = ${dialect.parameterPlaceholder(params.length + i + 1)}`,
    );
    params.push(...where.map((w) => w.value));

    const sql = `UPDATE ${dialect.quoteIdentifier(table)} SET ${setClause} WHERE ${whereParts.join(' AND ')}`;
    return this.executeAffected(dialect, sql, params);
  }

  async insertRow(input: {
    connectionId: string;
    table: string;
    values: RowValue[];
  }): Promise<Result<{ affected: number }>> {
    const dialect = this.dialect(input.connectionId);
    if (!dialect) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    const table = input.table.trim();
    const schema = await this.schemaOrFail(dialect, table);
    if (schema instanceof Error) return this.schemaFail();
    const values = this.validateKeys(schema.columns, input.values);
    if (!values) return this.schemaFail();

    if (values.length === 0) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const cols = values.map((v) => dialect.quoteIdentifier(v.column)).join(', ');
    const placeholders = values.map((_, i) => dialect.parameterPlaceholder(i + 1)).join(', ');
    const sql = `INSERT INTO ${dialect.quoteIdentifier(table)} (${cols}) VALUES (${placeholders})`;
    return this.executeAffected(dialect, sql, values.map((v) => v.value));
  }

  async deleteRow(input: {
    connectionId: string;
    table: string;
    where: RowValue[];
  }): Promise<Result<{ affected: number }>> {
    const dialect = this.dialect(input.connectionId);
    if (!dialect) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    const table = input.table.trim();
    const schema = await this.schemaOrFail(dialect, table);
    if (schema instanceof Error) return this.schemaFail();
    const where = this.validateKeys(schema.columns, input.where);
    if (!where) return this.schemaFail();
    if (where.length === 0) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const whereParts = where.map(
      (w, i) => `${dialect.quoteIdentifier(w.column)} = ${dialect.parameterPlaceholder(i + 1)}`,
    );
    const sql = `DELETE FROM ${dialect.quoteIdentifier(table)} WHERE ${whereParts.join(' AND ')}`;
    return this.executeAffected(dialect, sql, where.map((w) => w.value));
  }

  private async schemaOrFail(dialect: DialectPort, table: string): Promise<TableSchema | Error> {
    if (table.length === 0) return new Error('empty table');
    try {
      const columns = await dialect.getTableSchema(table);
      return { table, columns };
    } catch {
      return new Error('schema');
    }
  }

  private schemaFail(): Result<never> {
    return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
  }

  /** Whitelist: hanya kolom yang ada di schema yang boleh dipakai. */
  private validateKeys(columns: TableSchema['columns'], rows: RowValue[]): RowValue[] | null {
    const known = new Set(columns.map((c) => c.name));
    if (!rows.every((r) => known.has(r.column))) return null;
    return rows;
  }

  private async executeAffected(
    dialect: DialectPort,
    sql: string,
    params: unknown[],
  ): Promise<Result<{ affected: number }>> {
    try {
      const result = await dialect.execute(sql, params);
      return ok({ affected: result.affected ?? 0 });
    } catch (err) {
      return fail(toClientError(err));
    }
  }
}
