import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { DialectPort } from '@canvabase/dialects';
import type { Result, TableDraft } from '@canvabase/contracts';
import { TableDesignerService } from './TableDesignerService.js';
import type { ConnectionManager } from './ConnectionManager.js';

function errorCode(result: Result<unknown>): string | undefined {
  return result.ok ? undefined : 'code' in result.error ? result.error.code : undefined;
}

const draft: TableDraft = {
  name: 'orders',
  schema: null,
  columns: [
    { name: 'id', type: 'BIGINT', nullable: false, default: null, autoIncrement: true, isPrimaryKey: true },
  ],
  indexes: [],
  foreignKeys: [],
};

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
    execute: vi.fn().mockResolvedValue({ rows: [], columns: [], affected: 1 }),
    stream: vi.fn(),
    listTables: vi.fn().mockResolvedValue([]),
    listDatabases: vi.fn().mockResolvedValue([]),
    listViews: vi.fn().mockResolvedValue([]),
    listProcedures: vi.fn().mockResolvedValue([]),
    listTriggers: vi.fn().mockResolvedValue([]),
    listUsers: vi.fn().mockResolvedValue([]),
    getTableSchema: vi.fn().mockResolvedValue([]),
    getTableDefinition: vi.fn().mockResolvedValue({
      name: 'orders',
      schema: null,
      columns: [],
      indexes: [],
      foreignKeys: [],
      ddl: 'CREATE TABLE orders',
    }),
    previewDdl: vi.fn(() => 'CREATE TABLE orders'),
    quoteIdentifier: vi.fn((id: string) => `\`${id}\``),
    parameterPlaceholder: vi.fn(() => '?'),
    ...overrides,
  };
}

function fakeConnections(dialect: DialectPort): ConnectionManager {
  return {
    getSession: (connectionId: string) => {
      if (connectionId === 'none') return undefined;
      return { dialect, config: { name: 't', engine: 'mysql' } };
    },
  } as unknown as ConnectionManager;
}

function noDdlDialect(): DialectPort {
  return fakeDialect({
    capabilities: {
      ssl: true,
      sshTunnel: true,
      streaming: true,
      cancellation: true,
      editableGrid: true,
      tableSchema: true,
      ddl: false,
      userManagement: true,
      nativeJson: true,
      databases: true,
      views: true,
      procedures: true,
      triggers: true,
    },
  });
}

describe('TableDesignerService', () => {
  it('getTable returns definition', async () => {
    const service = new TableDesignerService(fakeConnections(fakeDialect()));
    const result = await service.getTable('c1', 'orders');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.name).toBe('orders');
  });

  it('getTable rejects empty name', async () => {
    const service = new TableDesignerService(fakeConnections(fakeDialect()));
    const result = await service.getTable('c1', '   ');
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('INVALID_INPUT');
  });

  it('getTable rejects when not connected', async () => {
    const service = new TableDesignerService(fakeConnections(fakeDialect()));
    const result = await service.getTable('none', 'orders');
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('NOT_CONNECTED');
  });

  it('previewDdl generates SQL without executing', async () => {
    const dialect = fakeDialect();
    const service = new TableDesignerService(fakeConnections(dialect));
    const result = await service.previewDdl({ connectionId: 'c1', draft });
    expect(result).toEqual(expect.objectContaining({ ok: true, data: 'CREATE TABLE orders' }));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.execute).not.toHaveBeenCalled();
  });

  it('apply executes CREATE and writes audit entry', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-designer-'));
    try {
      const dialect = fakeDialect();
      const service = new TableDesignerService(fakeConnections(dialect), dir);
      const result = await service.apply({ connectionId: 'c1', draft });
      expect(result).toEqual(expect.objectContaining({ ok: true, data: { applied: true } }));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(dialect.execute).toHaveBeenCalledOnce();

      const audit = JSON.parse(await readFile(join(dir, 'designer-audit.json'), 'utf8')) as Array<{
        action: string;
        table: string;
      }>;
      expect(audit[0]?.action).toBe('apply');
      expect(audit[0]?.table).toBe('orders');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('apply blocks ALTER on existing tables', async () => {
    const dialect = fakeDialect({ listTables: vi.fn().mockResolvedValue(['orders']) });
    const service = new TableDesignerService(fakeConnections(dialect));
    const result = await service.apply({ connectionId: 'c1', draft });
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('UNSUPPORTED_OPERATION');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.execute).not.toHaveBeenCalled();
  });

  it('drop executes DROP TABLE and writes audit entry', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-designer-'));
    try {
      const dialect = fakeDialect();
      const service = new TableDesignerService(fakeConnections(dialect), dir);
      const result = await service.drop('c1', 'orders');
      expect(result).toEqual(expect.objectContaining({ ok: true, data: { dropped: true } }));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(dialect.execute).toHaveBeenCalledWith('DROP TABLE `orders`');

      const audit = JSON.parse(await readFile(join(dir, 'designer-audit.json'), 'utf8')) as Array<{
        action: string;
        table: string;
      }>;
      expect(audit[0]?.action).toBe('drop');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects draft without columns via zod', async () => {
    const service = new TableDesignerService(fakeConnections(fakeDialect()));
    const result = await service.apply({
      connectionId: 'c1',
      draft: { name: 'orders', schema: null, columns: [], indexes: [], foreignKeys: [] },
    });
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('INVALID_INPUT');
  });

  it('returns UNSUPPORTED_OPERATION when dialect lacks ddl capability', async () => {
    const service = new TableDesignerService(fakeConnections(noDdlDialect()));
    const result = await service.previewDdl({ connectionId: 'c1', draft });
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('UNSUPPORTED_OPERATION');
  });
});
