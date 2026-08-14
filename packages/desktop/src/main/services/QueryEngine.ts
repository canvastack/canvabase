import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type {
  Chunk,
  ColumnMetadata,
  Result,
  SavedQuery,
  SavedQueryInput,
  Suggestion,
} from '@canvabase/contracts';
import { fail, ok } from '@canvabase/contracts';
import { toClientError } from '../errors.js';
import type { ConnectionManager } from './ConnectionManager.js';

const CHUNK_SIZE = 500;
const MAX_ROWS = 1_000_000;

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'OFFSET', 'HAVING',
  'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'ON', 'AS',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE TABLE', 'ALTER TABLE',
  'DROP TABLE', 'TRUNCATE', 'INDEX', 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE',
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'CASE', 'WHEN', 'THEN',
  'ELSE', 'END', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CURRENT_TIMESTAMP',
];

interface ResultBuffer {
  rows: Record<string, unknown>[];
  columns: ColumnMetadata[];
  offset: number;
}

const MAX_SAVED_QUERIES = 200;

export class QueryEngine {
  private readonly signals = new Map<string, AbortController>();
  private readonly buffers = new Map<string, ResultBuffer>();
  private savedQueries: SavedQuery[] | null = null;
  private readonly savedQueriesPath: string;

  constructor(
    private readonly connections: ConnectionManager,
    dataDir?: string,
  ) {
    this.savedQueriesPath = dataDir ? join(dataDir, 'saved-queries.json') : '';
  }

  async execute(input: {
    connectionId: string;
    sql: string;
    params?: unknown[];
    signalId?: string;
  }): Promise<Result<{ chunk: Chunk<Record<string, unknown>>; columns: ColumnMetadata[] }>> {
    const session = this.connections.getSession(input.connectionId);
    if (!session) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }

    const controller = new AbortController();
    if (input.signalId) this.signals.set(input.signalId, controller);
    try {
      const result = await session.dialect.execute<Record<string, unknown>>(
        input.sql,
        input.params ?? [],
        controller.signal,
      );
      const rows = result.rows.slice(0, MAX_ROWS);
      const chunk = {
        rows: rows.slice(0, CHUNK_SIZE),
        hasMore: rows.length > CHUNK_SIZE,
        offset: 0,
      };
      this.buffers.set(input.connectionId, {
        rows,
        columns: result.columns,
        offset: chunk.rows.length,
      });
      return ok({ chunk, columns: result.columns });
    } catch (err) {
      return fail(toClientError(err));
    } finally {
      if (input.signalId) this.signals.delete(input.signalId);
    }
  }

  fetchChunk(input: {
    connectionId: string;
    offset: number;
    size: number;
  }): Result<Chunk<Record<string, unknown>>> {
    const buffer = this.buffers.get(input.connectionId);
    if (!buffer) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_FOUND', message: 'No result buffer' });
    }
    const next = buffer.rows.slice(input.offset, input.offset + input.size);
    return ok({
      rows: next,
      hasMore: input.offset + next.length < buffer.rows.length,
      offset: input.offset + next.length,
    });
  }

  cancel(signalId: string): Result<{ cancelled: boolean }> {
    const controller = this.signals.get(signalId);
    if (!controller) return ok({ cancelled: false });
    controller.abort();
    this.signals.delete(signalId);
    return ok({ cancelled: true });
  }

  async suggest(input: {
    connectionId: string;
    sql: string;
    position: number;
  }): Promise<Result<Suggestion[]>> {
    const session = this.connections.getSession(input.connectionId);
    if (!session) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }

    const before = input.sql.slice(0, Math.max(0, Math.min(input.position, input.sql.length)));
    const tokenMatch = /([\w$.]+)$/.exec(before);
    const token = tokenMatch?.[1] ?? '';
    const prefix = token.split('.').pop() ?? '';
    const qualified = token.includes('.');

    const suggestions: Suggestion[] = [];

    try {
      if (!qualified) {
        const [tables, views] = await Promise.all([
          session.dialect.listTables().catch(() => [] as string[]),
          session.dialect.capabilities.views
            ? session.dialect.listViews().catch(() => [] as string[])
            : Promise.resolve([] as string[]),
        ]);
        for (const table of tables) {
          suggestions.push({ label: table, kind: 'table', replaceText: table });
        }
        for (const view of views) {
          suggestions.push({ label: view, kind: 'view', replaceText: view });
        }
      } else {
        const tables = await session.dialect.listTables().catch(() => [] as string[]);
        for (const table of tables) {
          suggestions.push({ label: table, kind: 'table', replaceText: table });
        }
      }

      for (const keyword of SQL_KEYWORDS) {
        suggestions.push({ label: keyword, kind: 'keyword', replaceText: keyword });
      }
    } catch {
      // metadata failure degrades gracefully to keywords only
    }

    const filtered = suggestions
      .filter((s) => s.label.toLowerCase().startsWith(prefix.toLowerCase()))
      .sort((a, b) => {
        if (a.kind === 'keyword' && b.kind !== 'keyword') return 1;
        if (b.kind === 'keyword' && a.kind !== 'keyword') return -1;
        return a.label.localeCompare(b.label);
      })
      .slice(0, 50);

    return ok(filtered);
  }

  async savedList(): Promise<Result<SavedQuery[]>> {
    await this.loadSaved();
    return ok(this.savedQueries ?? []);
  }

  async savedSave(input: SavedQueryInput): Promise<Result<SavedQuery>> {
    const name = input.name.trim();
    const sql = input.sql.trim();
    if (name.length === 0 || sql.length === 0) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    await this.loadSaved();
    const now = Date.now();
    const existing = (this.savedQueries ?? []).find((q) => q.name === name);
    let saved: SavedQuery;
    if (existing) {
      saved = { ...existing, sql, updatedAt: now };
      this.savedQueries = (this.savedQueries ?? []).map((q) => (q.id === existing.id ? saved : q));
    } else {
      if ((this.savedQueries?.length ?? 0) >= MAX_SAVED_QUERIES) {
        return fail({ type: 'BUSINESS', retryable: false, code: 'LIMIT_EXCEEDED' });
      }
      saved = { id: randomUUID(), name, sql, createdAt: now, updatedAt: now };
      this.savedQueries = [...(this.savedQueries ?? []), saved];
    }
    await this.persistSaved();
    return ok(saved);
  }

  async savedDelete(id: string): Promise<Result<{ deleted: boolean }>> {
    await this.loadSaved();
    const before = this.savedQueries?.length ?? 0;
    this.savedQueries = (this.savedQueries ?? []).filter((q) => q.id !== id);
    const deleted = before !== (this.savedQueries?.length ?? 0);
    if (deleted) await this.persistSaved();
    return ok({ deleted });
  }

  private async loadSaved(): Promise<void> {
    if (this.savedQueries !== null || !this.savedQueriesPath) {
      this.savedQueries ??= [];
      return;
    }
    try {
      const raw = await readFile(this.savedQueriesPath, 'utf8');
      this.savedQueries = JSON.parse(raw) as SavedQuery[];
    } catch {
      this.savedQueries = [];
    }
  }

  private async persistSaved(): Promise<void> {
    if (!this.savedQueriesPath) return;
    await mkdir(join(this.savedQueriesPath, '..'), { recursive: true });
    await writeFile(this.savedQueriesPath, JSON.stringify(this.savedQueries ?? [], null, 2), 'utf8');
  }
}
