import type {
  BrowserCapabilities,
  ObjectNode,
  Result,
} from '@canvabase/contracts';
import { fail, ok } from '@canvabase/contracts';
import type { DialectPort } from '@canvabase/dialects';
import { toClientError } from '../errors.js';
import type { ConnectionManager } from './ConnectionManager.js';

const MAX_OBJECTS = 10_000;

function mapNames(type: ObjectNode['type'], names: string[], schema: string | null): ObjectNode[] {
  return names.slice(0, MAX_OBJECTS).map((name) => ({
    id: schema ? `${schema}.${name}` : name,
    type,
    name,
    schema,
    columns: 0,
    rows: null,
    isSystem: false,
  }));
}

export class ObjectBrowserService {
  constructor(private readonly connections: ConnectionManager) {}

  private session(connectionId: string): Result<DialectPort> {
    const session = this.connections.getSession(connectionId);
    if (!session) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    return ok(session.dialect);
  }

  capabilities(connectionId: string): Result<BrowserCapabilities> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    const caps = session.data.capabilities;
    return ok({
      databases: caps.databases,
      views: caps.views,
      procedures: caps.procedures,
      triggers: caps.triggers,
      userManagement: caps.userManagement,
    });
  }

  async listDatabases(connectionId: string): Promise<Result<ObjectNode[]>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.databases) return ok([]);
    try {
      const names = await session.data.listDatabases();
      return ok(
        names
          .slice(0, MAX_OBJECTS)
          .map((name) => ({
            id: name,
            type: 'database' as const,
            name,
            schema: null,
            columns: 0,
            rows: null,
            isSystem: false,
          })),
      );
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async listTables(connectionId: string): Promise<Result<ObjectNode[]>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    const dialect = session.data;
    try {
      if (dialect.name === 'mysql') {
        try {
          const query = `
            SELECT 
              t.TABLE_NAME AS name,
              t.ENGINE AS engine,
              t.TABLE_ROWS AS row_count,
              t.DATA_LENGTH AS size_bytes,
              t.CREATE_TIME AS created_at,
              t.UPDATE_TIME AS updated_at,
              t.TABLE_COMMENT AS comment,
              (SELECT COUNT(*) FROM information_schema.columns c WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = t.TABLE_NAME) AS column_count,
              (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.statistics s WHERE s.TABLE_SCHEMA = DATABASE() AND s.TABLE_NAME = t.TABLE_NAME AND s.INDEX_NAME <> 'PRIMARY') AS index_count,
              (SELECT COUNT(DISTINCT CONSTRAINT_NAME) FROM information_schema.key_column_usage k WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = t.TABLE_NAME AND k.REFERENCED_TABLE_NAME IS NOT NULL) AS fk_count
            FROM information_schema.tables t
            WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_TYPE = 'BASE TABLE'
            ORDER BY t.TABLE_NAME;
          `;
          const res = await dialect.execute<{
            name: string;
            engine: string | null;
            row_count: number | null;
            size_bytes: number | null;
            created_at: string | Date | null;
            updated_at: string | Date | null;
            comment: string | null;
            column_count: number;
            index_count: number;
            fk_count: number;
          }>(query);

          if (res && Array.isArray(res.rows) && res.rows.length > 0) {
            return ok(
              res.rows.slice(0, MAX_OBJECTS).map((r) => ({
                id: r.name,
                type: 'table' as const,
                name: r.name,
                schema: null,
                columns: Number(r.column_count) || 0,
                rows: r.row_count !== null && r.row_count !== undefined ? Number(r.row_count) : null,
                isSystem: false,
                indexes: Number(r.index_count) || 0,
                foreignKeys: Number(r.fk_count) || 0,
                engine: r.engine ?? 'InnoDB',
                sizeBytes: r.size_bytes !== null && r.size_bytes !== undefined ? Number(r.size_bytes) : null,
                createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
                updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
                comment: r.comment || null,
              })),
            );
          }
        } catch {
          // Fall back to standard listTables
        }
      }

      if (dialect.name === 'postgres' || dialect.name === 'postgresql') {
        try {
          const query = `
            SELECT 
              t.table_name AS name,
              t.table_schema AS schema,
              COALESCE(c.reltuples::bigint, 0) AS row_count,
              COALESCE(pg_total_relation_size(c.oid), 0) AS size_bytes,
              (SELECT count(*) FROM information_schema.columns col WHERE col.table_schema = t.table_schema AND col.table_name = t.table_name)::int AS column_count,
              (SELECT count(*) FROM pg_indexes idx WHERE idx.schemaname = t.table_schema AND idx.tablename = t.table_name AND idx.indexname NOT LIKE '%_pkey')::int AS index_count,
              (SELECT count(DISTINCT tc.constraint_name) FROM information_schema.table_constraints tc WHERE tc.table_schema = t.table_schema AND tc.table_name = t.table_name AND tc.constraint_type = 'FOREIGN KEY')::int AS fk_count
            FROM information_schema.tables t
            LEFT JOIN pg_class c ON c.relname = t.table_name
            LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
            WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema') AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name;
          `;
          const res = await dialect.execute<{
            name: string;
            schema: string;
            row_count: number;
            size_bytes: number;
            column_count: number;
            index_count: number;
            fk_count: number;
          }>(query);

          if (res && Array.isArray(res.rows) && res.rows.length > 0) {
            return ok(
              res.rows.slice(0, MAX_OBJECTS).map((r) => ({
                id: r.schema === 'public' ? r.name : `${r.schema}.${r.name}`,
                type: 'table' as const,
                name: r.schema === 'public' ? r.name : `${r.schema}.${r.name}`,
                schema: r.schema,
                columns: Number(r.column_count) || 0,
                rows: Number(r.row_count) >= 0 ? Number(r.row_count) : null,
                isSystem: false,
                indexes: Number(r.index_count) || 0,
                foreignKeys: Number(r.fk_count) || 0,
                engine: 'PostgreSQL Heap',
                sizeBytes: Number(r.size_bytes) || 0,
                createdAt: null,
                updatedAt: null,
                comment: null,
              })),
            );
          }
        } catch {
          // Fall back to standard listTables
        }
      }

      if (dialect.name === 'sqlite') {
        const names = await dialect.listTables();
        const nodes: ObjectNode[] = [];
        for (const name of names.slice(0, MAX_OBJECTS)) {
          let colsCount = 0;
          let idxCount = 0;
          let fkCount = 0;
          let rowCount: number | null = null;
          try {
            const cols = await dialect.getTableSchema(name);
            colsCount = cols.length;
          } catch {
            colsCount = 0;
          }
          try {
            const def = await dialect.getTableDefinition(name);
            idxCount = def.indexes.length;
            fkCount = def.foreignKeys.length;
          } catch {
            idxCount = 0;
            fkCount = 0;
          }
          try {
            const countRes = await dialect.execute<{ count: number }>(`SELECT COUNT(*) AS count FROM ${dialect.quoteIdentifier(name)}`);
            rowCount = countRes?.rows?.[0]?.count ?? null;
          } catch {
            rowCount = null;
          }
          nodes.push({
            id: name,
            type: 'table',
            name,
            schema: null,
            columns: colsCount,
            rows: rowCount,
            isSystem: false,
            indexes: idxCount,
            foreignKeys: fkCount,
            engine: 'SQLite B-Tree',
            sizeBytes: null,
            createdAt: null,
            updatedAt: null,
            comment: null,
          });
        }
        return ok(nodes);
      }

      // Generic fallback
      const names = await dialect.listTables();
      return ok(mapNames('table', names, null));
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async listViews(connectionId: string): Promise<Result<ObjectNode[]>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.views) return ok([]);
    try {
      const names = await session.data.listViews();
      return ok(mapNames('view', names, null));
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async listProcedures(connectionId: string): Promise<Result<ObjectNode[]>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.procedures) return ok([]);
    try {
      const names = await session.data.listProcedures();
      return ok(mapNames('procedure', names, null));
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async listTriggers(connectionId: string): Promise<Result<ObjectNode[]>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.triggers) return ok([]);
    try {
      const names = await session.data.listTriggers();
      return ok(mapNames('trigger', names, null));
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async listUsers(connectionId: string): Promise<Result<ObjectNode[]>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.userManagement) return ok([]);
    try {
      const names = await session.data.listUsers();
      return ok(mapNames('user', names, null));
    } catch (err) {
      return fail(toClientError(err));
    }
  }
}
