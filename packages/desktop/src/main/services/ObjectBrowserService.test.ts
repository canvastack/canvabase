import { describe, expect, it, vi } from 'vitest';
import type { DialectPort } from '@canvabase/dialects';
import { ObjectBrowserService } from './ObjectBrowserService.js';
import type { ConnectionManager } from './ConnectionManager.js';

function fakeDialect(overrides: Partial<DialectPort> = {}): DialectPort {
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
    listTables: vi.fn().mockResolvedValue(['users', 'orders']),
    listDatabases: vi.fn().mockResolvedValue(['app', 'test']),
    listViews: vi.fn().mockResolvedValue(['user_summary']),
    listProcedures: vi.fn().mockResolvedValue(['create_user']),
    listTriggers: vi.fn().mockResolvedValue(['audit_insert']),
    listUsers: vi.fn().mockResolvedValue(['root@localhost']),
    getTableSchema: vi.fn().mockResolvedValue([]),
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
    ...overrides,
  };
}

function fakeConnections(dialect: DialectPort): ConnectionManager {
  return {
    getSession: () => ({ dialect, config: { name: 't', engine: 'mysql' } }),
  } as unknown as ConnectionManager;
}

function noSession(): ConnectionManager {
  return { getSession: () => undefined } as unknown as ConnectionManager;
}

describe('ObjectBrowserService', () => {
  it('maps tables to ObjectNodes', async () => {
    const service = new ObjectBrowserService(fakeConnections(fakeDialect()));
    const result = await service.listTables('c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      { id: 'users', type: 'table', name: 'users', schema: null, columns: 0, rows: null, isSystem: false },
      { id: 'orders', type: 'table', name: 'orders', schema: null, columns: 0, rows: null, isSystem: false },
    ]);
  });

  it('returns empty list for unsupported capability', async () => {
    const dialect = fakeDialect({
      capabilities: {
        ssl: false, sshTunnel: false, streaming: false, cancellation: false,
        editableGrid: true, tableSchema: true, ddl: true, userManagement: false, nativeJson: false,
        databases: false, views: false, procedures: false, triggers: false,
      },
      listProcedures: vi.fn().mockResolvedValue(['nope']),
    });
    const service = new ObjectBrowserService(fakeConnections(dialect));
    const procedures = await service.listProcedures('c1');
    expect(procedures.ok).toBe(true);
    if (!procedures.ok) return;
    expect(procedures.data).toEqual([]);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.listProcedures).not.toHaveBeenCalled();
  });

  it('returns NOT_CONNECTED without a session', async () => {
    const service = new ObjectBrowserService(noSession());
    const result = await service.listTables('missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect('code' in result.error ? result.error.code : undefined).toBe('NOT_CONNECTED');
  });

  it('surfaces dialect errors as client errors', async () => {
    const dialect = fakeDialect({ listTables: vi.fn().mockRejectedValue(new Error('permission denied')) });
    const service = new ObjectBrowserService(fakeConnections(dialect));
    const result = await service.listTables('c1');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect('message' in result.error ? result.error.message : undefined).toContain('permission denied');
    }
  });

  it('exposes browser capabilities from the dialect', () => {
    const service = new ObjectBrowserService(fakeConnections(fakeDialect()));
    const result = service.capabilities('c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      databases: true,
      views: true,
      procedures: true,
      triggers: true,
      userManagement: true,
    });
  });

  it('returns NOT_CONNECTED for capabilities without a session', () => {
    const service = new ObjectBrowserService(noSession());
    const result = service.capabilities('missing');
    expect(result.ok).toBe(false);
    if (!result.ok) expect('code' in result.error ? result.error.code : undefined).toBe('NOT_CONNECTED');
  });
});
