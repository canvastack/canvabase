import { describe, expect, it, vi } from 'vitest';
import type { DialectPort } from '@canvabase/dialects';
import type { QueryEngine } from './QueryEngine.js';
import type { ConnectionManager } from './ConnectionManager.js';
import { DataService } from './DataService.js';
import { ok } from '@canvabase/contracts';

function fakeDialect(): DialectPort {
  const dialect: DialectPort = {
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
    getTableSchema: vi.fn().mockResolvedValue([
      { name: 'id', type: 'int', nullable: false, primaryKey: true, autoIncrement: true, default: null },
      { name: 'name', type: 'varchar', nullable: false, primaryKey: false, autoIncrement: false, default: null },
    ]),
    getTableDefinition: vi.fn().mockResolvedValue({
      name: 'users',
      schema: null,
      columns: [],
      indexes: [],
      foreignKeys: [],
      ddl: '',
    }),
    previewDdl: vi.fn(() => ''),
    quoteIdentifier: vi.fn((id: string) => `\`${id}\``),
    parameterPlaceholder: vi.fn(() => '?'),
  };
  return dialect;
}

function fakeConnections(dialect: DialectPort): ConnectionManager {
  return {
    getSession: () => ({ dialect, config: { name: 't', engine: 'mysql' } }),
  } as unknown as ConnectionManager;
}

function fakeQuery(): QueryEngine {
  return {
    execute: vi.fn().mockResolvedValue(
      ok({
        chunk: { rows: [{ id: 1, name: 'a' }], hasMore: false, offset: 1 },
        columns: [
          { name: 'id', type: 'int', nullable: false },
          { name: 'name', type: 'varchar', nullable: false },
        ],
      }),
    ),
  } as unknown as QueryEngine;
}

function noSession(): ConnectionManager {
  return { getSession: () => undefined } as unknown as ConnectionManager;
}

function service(): { data: DataService; dialect: DialectPort; query: QueryEngine } {
  const dialect = fakeDialect();
  const connections = fakeConnections(dialect);
  const query = fakeQuery();
  return { data: new DataService(connections, query), dialect, query };
}

describe('DataService', () => {
  it('returns NOT_CONNECTED without session', async () => {
    const data = new DataService(noSession(), fakeQuery());
    const res = await data.getSchema({ connectionId: 'c1', table: 'users' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect((res.error as { code?: string }).code).toBe('NOT_CONNECTED');
  });

  it('getSchema maps columns', async () => {
    const { data } = service();
    const res = await data.getSchema({ connectionId: 'c1', table: 'users' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.table).toBe('users');
    expect(res.data.columns.length).toBe(2);
    expect(res.data.columns[0]?.primaryKey).toBe(true);
  });

  it('openTable builds quoted SELECT and delegates to QueryEngine', async () => {
    const { data, dialect, query } = service();
    const res = await data.openTable({ connectionId: 'c1', table: 'users' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.quoteIdentifier).toHaveBeenCalledWith('users');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(query.execute).toHaveBeenCalledWith({
      connectionId: 'c1',
      sql: 'SELECT * FROM `users` LIMIT 500',
    });
    expect(res.data.table).toBe('users');
  });

  it('openTable clamps limit', async () => {
    const { data, query } = service();
    await data.openTable({ connectionId: 'c1', table: 'users', limit: 100000 });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(query.execute).toHaveBeenCalledWith({
      connectionId: 'c1',
      sql: 'SELECT * FROM `users` LIMIT 10000',
    });
  });

  it('updateRow builds param UPDATE and returns affected', async () => {
    const { data, dialect } = service();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.execute).mockResolvedValueOnce({ rows: [], columns: [], affected: 1 });
    const res = await data.updateRow({
      connectionId: 'c1',
      table: 'users',
      where: [{ column: 'id', value: 5 }],
      changes: [{ column: 'name', value: 'zed' }],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.affected).toBe(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.execute).toHaveBeenCalledWith(
      'UPDATE `users` SET `name` = ? WHERE `id` = ?',
      ['zed', 5],
    );
  });

  it('insertRow builds param INSERT', async () => {
    const { data, dialect } = service();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.execute).mockResolvedValueOnce({ rows: [], columns: [], affected: 1 });
    await data.insertRow({
      connectionId: 'c1',
      table: 'users',
      values: [{ column: 'name', value: 'alice' }],
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.execute).toHaveBeenCalledWith(
      'INSERT INTO `users` (`name`) VALUES (?)',
      ['alice'],
    );
  });

  it('deleteRow builds param DELETE and requires where', async () => {
    const { data, dialect } = service();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.execute).mockResolvedValueOnce({ rows: [], columns: [], affected: 1 });
    const res = await data.deleteRow({
      connectionId: 'c1',
      table: 'users',
      where: [{ column: 'id', value: 4 }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(dialect.execute).toHaveBeenCalledWith('DELETE FROM `users` WHERE `id` = ?', [4]);
    }
    const noWhere = await data.deleteRow({ connectionId: 'c1', table: 'users', where: [] });
    expect(noWhere.ok).toBe(false);
  });

  it('rejects unknown column (injection prevention via whitelist)', async () => {
    const { data, dialect } = service();
    const res = await data.updateRow({
      connectionId: 'c1',
      table: 'users',
      where: [{ column: 'id', value: 1 }],
      changes: [{ column: '`evil` = 1', value: 'x' }],
    });
    expect(res.ok).toBe(false);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.execute).not.toHaveBeenCalled();
  });

  it('handles DML errors to ClientError', async () => {
    const { data, dialect } = service();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(dialect.execute).mockRejectedValueOnce(new Error('duplicate key'));
    const res = await data.insertRow({
      connectionId: 'c1',
      table: 'users',
      values: [{ column: 'name', value: 'dup' }],
    });
    expect(res.ok).toBe(false);
  });
});
