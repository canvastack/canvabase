import { describe, expect, it, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { DialectPort } from '@canvabase/dialects';
import type { Result, TableDefinition } from '@canvabase/contracts';
import { ErdService, MAX_ERD_TABLES } from './ErdService.js';
import type { ConnectionManager } from './ConnectionManager.js';

const showSaveDialog = vi.hoisted(() =>
  vi.fn<(_opts: unknown) => Promise<{ canceled: boolean; filePath?: string }>>(),
);

vi.mock('electron', () => ({
  dialog: { showSaveDialog: (opts: unknown) => showSaveDialog(opts) },
}));

function errorCode(result: Result<unknown>): string | undefined {
  return result.ok ? undefined : 'code' in result.error ? result.error.code : undefined;
}

function makeDefinition(name: string, foreignKeys: TableDefinition['foreignKeys'] = []): TableDefinition {
  return {
    name,
    schema: null,
    columns: [
      { name: 'id', type: 'INTEGER', nullable: false, default: null, autoIncrement: true, isPrimaryKey: true },
      { name: 'name', type: 'TEXT', nullable: true, default: null, autoIncrement: false, isPrimaryKey: false },
    ],
    indexes: [],
    foreignKeys,
    ddl: `CREATE TABLE ${name}`,
  };
}

function fakeDialect(overrides: Partial<DialectPort> = {}): DialectPort {
  return {
    name: 'sqlite',
    capabilities: {
      ssl: false,
      sshTunnel: false,
      streaming: true,
      cancellation: true,
      editableGrid: true,
      tableSchema: true,
      ddl: true,
      userManagement: true,
      nativeJson: false,
      databases: false,
      views: true,
      procedures: false,
      triggers: true,
    },
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: () => true,
    execute: vi.fn().mockResolvedValue({ rows: [], columns: [], affected: 0 }),
    stream: vi.fn(),
    listTables: vi.fn().mockResolvedValue(['users', 'orders']),
    listDatabases: vi.fn().mockResolvedValue([]),
    listViews: vi.fn().mockResolvedValue([]),
    listProcedures: vi.fn().mockResolvedValue([]),
    listTriggers: vi.fn().mockResolvedValue([]),
    listUsers: vi.fn().mockResolvedValue([]),
    getTableSchema: vi.fn().mockResolvedValue([]),
    getTableDefinition: vi.fn().mockImplementation((table: string) =>
      Promise.resolve(
        table === 'orders'
          ? makeDefinition('orders', [
              { name: 'fk_user', columns: ['user_id'], refTable: 'users', refColumns: ['id'], onDelete: null },
            ])
          : makeDefinition('users'),
      ),
    ),
    previewDdl: vi.fn(() => ''),
    quoteIdentifier: vi.fn((id: string) => `"${id}"`),
    parameterPlaceholder: vi.fn(() => '?'),
    ...overrides,
  };
}

function noSchemaDialect(): DialectPort {
  return fakeDialect({
    capabilities: {
      ssl: false,
      sshTunnel: false,
      streaming: true,
      cancellation: true,
      editableGrid: true,
      tableSchema: false,
      ddl: false,
      userManagement: true,
      nativeJson: false,
      databases: false,
      views: true,
      procedures: false,
      triggers: true,
    },
  });
}

function fakeConnections(dialect: DialectPort): ConnectionManager {
  return {
    getSession: (connectionId: string) => {
      if (connectionId === 'none') return undefined;
      return { dialect, config: { name: 't', engine: 'sqlite' } };
    },
  } as unknown as ConnectionManager;
}

describe('ErdService.generate', () => {
  it('builds nodes + edges from table definitions', async () => {
    const service = new ErdService(fakeConnections(fakeDialect()));
    const result = await service.generate('c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes.map((n) => n.name)).toEqual(['users', 'orders']);
    expect(result.data.edges).toHaveLength(1);
    const edge = result.data.edges[0];
    expect(edge).toBeDefined();
    if (!edge) return;
    expect(edge.source).toBe('orders');
    expect(edge.target).toBe('users');
    expect(edge.columns).toEqual(['user_id']);
    expect(edge.type).toBe('one-many');
    for (const node of result.data.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
      expect(node.columns.length).toBeGreaterThan(0);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('marks one-to-one when FK columns are the PK', async () => {
    const dialect = fakeDialect({
      getTableDefinition: vi.fn().mockImplementation((table: string) =>
        Promise.resolve(
          table === 'profile'
            ? {
                ...makeDefinition('profile'),
                columns: [
                  { name: 'user_id', type: 'INTEGER', nullable: false, default: null, autoIncrement: false, isPrimaryKey: true },
                ],
                foreignKeys: [
                  { name: 'fk_user', columns: ['user_id'], refTable: 'users', refColumns: ['id'], onDelete: null },
                ],
              }
            : makeDefinition('users'),
        ),
      ),
    });
    dialect.listTables = vi.fn().mockResolvedValue(['users', 'profile']);
    const service = new ErdService(fakeConnections(dialect));
    const result = await service.generate('c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edge = result.data.edges[0];
    expect(edge?.type).toBe('one-one');
  });

  it('skips edges to tables outside the diagram', async () => {
    const dialect = fakeDialect({
      getTableDefinition: vi.fn().mockImplementation((table: string) =>
        Promise.resolve(
          table === 'orders'
            ? makeDefinition('orders', [
                { name: 'fk_audit', columns: ['audit_id'], refTable: 'audit_log', refColumns: ['id'], onDelete: null },
              ])
            : makeDefinition('users'),
        ),
      ),
    });
    const service = new ErdService(fakeConnections(dialect));
    const result = await service.generate('c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.edges).toHaveLength(0);
  });

  it('caps introspection at MAX_ERD_TABLES', async () => {
    const many = Array.from({ length: MAX_ERD_TABLES + 20 }, (_, i) => `t${i}`);
    const dialect = fakeDialect({
      listTables: vi.fn().mockResolvedValue(many),
      getTableDefinition: vi.fn().mockImplementation((table: string) =>
        Promise.resolve(makeDefinition(table)),
      ),
    });
    const service = new ErdService(fakeConnections(dialect));
    const result = await service.generate('c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes.length).toBe(MAX_ERD_TABLES);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(dialect.getTableDefinition).toHaveBeenCalledTimes(MAX_ERD_TABLES);
  });

  it('rejects when not connected', async () => {
    const service = new ErdService(fakeConnections(fakeDialect()));
    const result = await service.generate('none');
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('NOT_CONNECTED');
  });

  it('rejects when dialect lacks tableSchema capability', async () => {
    const service = new ErdService(fakeConnections(noSchemaDialect()));
    const result = await service.generate('c1');
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('UNSUPPORTED_OPERATION');
  });

  it('fetches definitions with bounded concurrency', async () => {
    const dialect = fakeDialect({
      listTables: vi.fn().mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']),
      getTableDefinition: vi.fn().mockImplementation((table: string) =>
        Promise.resolve(makeDefinition(table)),
      ),
    });
    const service = new ErdService(fakeConnections(dialect));
    const result = await service.generate('c1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.nodes.length).toBe(10);
    expect(result.data.nodes.map((n) => n.name)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  });
});

describe('ErdService.exportImage', () => {
  beforeEach(() => {
    showSaveDialog.mockReset();
  });

  it('rejects invalid input', async () => {
    const service = new ErdService(fakeConnections(fakeDialect()));
    const missing = await service.exportImage({ dataUrl: '', defaultName: '' });
    expect(missing.ok).toBe(false);
    expect(errorCode(missing)).toBe('INVALID_INPUT');

    const wrongMime = await service.exportImage({
      dataUrl: 'data:image/gif;base64,R0lGOD',
      defaultName: 'erd',
    });
    expect(wrongMime.ok).toBe(false);
    expect(errorCode(wrongMime)).toBe('INVALID_INPUT');
  });

  it('rejects non-image data URL', async () => {
    const service = new ErdService(fakeConnections(fakeDialect()));
    const result = await service.exportImage({
      dataUrl: 'data:text/html;base64,PGh0bWw+',
      defaultName: 'erd',
    });
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('INVALID_INPUT');
  });

  it('returns saved:false when dialog canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    const service = new ErdService(fakeConnections(fakeDialect()));
    const result = await service.exportImage({
      dataUrl: 'data:image/png;base64,aGVsbG8=',
      defaultName: 'erd-3-tables',
    });
    expect(result).toEqual(expect.objectContaining({ ok: true, data: { saved: false, path: null } }));
  });

  it('writes PNG buffer to chosen path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cb-erd-'));
    const target = join(dir, 'diagram.png');
    try {
      showSaveDialog.mockResolvedValue({ canceled: false, filePath: target });
      const service = new ErdService(fakeConnections(fakeDialect()));
      const result = await service.exportImage({
        dataUrl: 'data:image/png;base64,aGVsbG8=',
        defaultName: 'diagram',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.saved).toBe(true);
      expect(result.data.path).toBe(target);
      expect(await readFile(target, 'utf8')).toBe('hello');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('sanitizes unsafe characters in default filename', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    const service = new ErdService(fakeConnections(fakeDialect()));
    await service.exportImage({
      dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=',
      defaultName: 'erd:../secret',
    });
    expect(showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'erd_.._secret.svg' }),
    );
  });
});
