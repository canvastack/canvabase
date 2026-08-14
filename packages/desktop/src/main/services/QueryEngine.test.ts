import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { DialectPort } from '@canvabase/dialects';
import { QueryEngine } from './QueryEngine.js';
import type { ConnectionManager } from './ConnectionManager.js';

function fakeDialect(): DialectPort {
  return {
    name: 'mysql',
    capabilities: {
      ssl: true,
      sshTunnel: true,
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
    },
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: () => true,
    execute: vi.fn(),
    stream: vi.fn(),
    listTables: vi.fn().mockResolvedValue([]),
    listDatabases: vi.fn().mockResolvedValue([]),
    listViews: vi.fn().mockResolvedValue([]),
    listProcedures: vi.fn().mockResolvedValue([]),
    listTriggers: vi.fn().mockResolvedValue([]),
    listUsers: vi.fn().mockResolvedValue([]),
    getTableSchema: vi.fn().mockResolvedValue([]),
    getTableDefinition: vi.fn(),
    previewDdl: vi.fn(() => ''),
    quoteIdentifier: vi.fn((id: string) => `\`${id}\``),
    parameterPlaceholder: vi.fn(() => '?'),
  };
}

function fakeConnections(dialect: DialectPort): ConnectionManager {
  return {
    getSession: () => ({ dialect, config: { name: 't', engine: 'mysql' } }),
  } as unknown as ConnectionManager;
}

describe('QueryEngine', () => {
  it('executes and returns the first chunk', async () => {
    const dialect = fakeDialect();
    const rows = Array.from({ length: 1200 }, (_, i) => ({ id: i }));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.execute).mockResolvedValue({
      rows,
      columns: [{ name: 'id', type: 'INT', nullable: true }],
    });
    const engine = new QueryEngine(fakeConnections(dialect));

    const result = await engine.execute({ connectionId: 'c1', sql: 'SELECT * FROM t', signalId: 's1' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.chunk.rows).toHaveLength(500);
    expect(result.data.chunk.hasMore).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.execute).toHaveBeenCalledWith('SELECT * FROM t', [], expect.any(AbortSignal));
  });

  it('slices subsequent chunks via fetchChunk', async () => {
    const dialect = fakeDialect();
    const rows = Array.from({ length: 1200 }, (_, i) => ({ id: i }));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.execute).mockResolvedValue({
      rows,
      columns: [{ name: 'id', type: 'INT', nullable: true }],
    });
    const engine = new QueryEngine(fakeConnections(dialect));
    await engine.execute({ connectionId: 'c1', sql: 'SELECT * FROM t', signalId: 's1' });

    const chunk = engine.fetchChunk({ connectionId: 'c1', offset: 500, size: 500 });

    expect(chunk.ok).toBe(true);
    if (!chunk.ok) return;
    expect(chunk.data.rows).toHaveLength(500);
    expect(chunk.data.hasMore).toBe(true);
    expect(chunk.data.rows[0]).toEqual({ id: 500 });
  });

  it('returns no buffer error when no query ran', () => {
    const dialect = fakeDialect();
    const engine = new QueryEngine(fakeConnections(dialect));
    const chunk = engine.fetchChunk({ connectionId: 'c1', offset: 0, size: 500 });
    expect(chunk.ok).toBe(false);
  });

  it('cancels a running signal', async () => {
    const dialect = fakeDialect();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.execute).mockImplementation((_sql, _params, signal) => {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
      });
    });
    const engine = new QueryEngine(fakeConnections(dialect));

    const running = engine.execute({ connectionId: 'c1', sql: 'SELECT SLEEP(1)', signalId: 's1' });
    const cancelled = engine.cancel('s1');

    expect(cancelled.ok).toBe(true);
    const result = await running;
    expect(result.ok).toBe(false);
    if (!result.ok) expect('code' in result.error ? result.error.code : undefined).toBe('QUERY_CANCELLED');
  });

  it('reports NOT_CONNECTED when no session exists', async () => {
    const dialect = fakeDialect();
    const connections = { getSession: () => undefined } as unknown as ConnectionManager;
    const engine = new QueryEngine(connections);
    void dialect;

    const result = await engine.execute({ connectionId: 'c1', sql: 'SELECT 1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect('code' in result.error ? result.error.code : undefined).toBe('NOT_CONNECTED');
  });
});

describe('QueryEngine.suggest', () => {
  it('returns tables, views, and keywords matching the prefix', async () => {
    const dialect = fakeDialect();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.listTables).mockResolvedValue(['users', 'orders']);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.listViews).mockResolvedValue(['user_summary']);
    const engine = new QueryEngine(fakeConnections(dialect));

    const result = await engine.suggest({ connectionId: 'c1', sql: 'SELECT * FROM us', position: 16 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map((s) => s.label)).toEqual(expect.arrayContaining(['users', 'user_summary']));
    expect(result.data.every((s) => s.label.toLowerCase().startsWith('us'))).toBe(true);
  });

  it('supports qualified prefixes (schema.table)', async () => {
    const dialect = fakeDialect();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.listTables).mockResolvedValue(['users', 'orders']);
    const engine = new QueryEngine(fakeConnections(dialect));

    const result = await engine.suggest({ connectionId: 'c1', sql: 'SELECT * FROM app.us', position: 18 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.some((s) => s.label === 'users')).toBe(true);
  });

  it('ranks keywords last', async () => {
    const dialect = fakeDialect();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.listTables).mockResolvedValue(['select_me']);
    const engine = new QueryEngine(fakeConnections(dialect));

    const result = await engine.suggest({ connectionId: 'c1', sql: 'SELE', position: 4 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const last = result.data[result.data.length - 1];
    expect(last?.kind).toBe('keyword');
  });

  it('returns NOT_CONNECTED without a session', async () => {
    const engine = new QueryEngine({ getSession: () => undefined } as unknown as ConnectionManager);
    const result = await engine.suggest({ connectionId: 'missing', sql: 'SE', position: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect('code' in result.error ? result.error.code : undefined).toBe('NOT_CONNECTED');
  });
});

describe('QueryEngine saved queries', () => {
  it('saves, lists, overwrites by name, and deletes queries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'canvabase-saved-'));
    try {
      const engine = new QueryEngine(fakeConnections(fakeDialect()), dir);

      const saved1 = await engine.savedSave({ name: 'all users', sql: 'SELECT * FROM users' });
      expect(saved1.ok).toBe(true);
      if (!saved1.ok) return;

      const list1 = await engine.savedList();
      expect(list1.ok).toBe(true);
      if (!list1.ok) return;
      expect(list1.data).toHaveLength(1);

      const overwrite = await engine.savedSave({ name: 'all users', sql: 'SELECT id FROM users' });
      expect(overwrite.ok).toBe(true);
      const list2 = await engine.savedList();
      if (!list2.ok) return;
      expect(list2.data).toHaveLength(1);
      expect(list2.data[0]?.sql).toBe('SELECT id FROM users');

      const deleted = await engine.savedDelete(saved1.data.id);
      expect(deleted.ok).toBe(true);
      const list3 = await engine.savedList();
      if (!list3.ok) return;
      expect(list3.data).toHaveLength(0);

      const raw = await readFile(join(dir, 'saved-queries.json'), 'utf8');
      expect(raw).toBe('[]');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects empty name or sql', async () => {
    const engine = new QueryEngine(fakeConnections(fakeDialect()));
    const bad = await engine.savedSave({ name: ' ', sql: 'SELECT 1' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect('code' in bad.error ? bad.error.code : undefined).toBe('INVALID_INPUT');
  });
});
