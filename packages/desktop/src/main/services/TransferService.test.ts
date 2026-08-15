import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DialectPort } from '@canvabase/dialects';
import type { Result, TableColumn } from '@canvabase/contracts';
import { TransferService } from './TransferService.js';
import { AuditLogger } from './AuditLogger.js';
import type { ConnectionManager } from './ConnectionManager.js';

const showSaveDialog = vi.hoisted(() =>
  vi.fn<(_opts: unknown) => Promise<{ canceled: boolean; filePath?: string }>>(),
);
const showOpenDialog = vi.hoisted(() =>
  vi.fn<(_opts: unknown) => Promise<{ canceled: boolean; filePaths: string[] }>>(),
);

vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: (opts: unknown) => showSaveDialog(opts),
    showOpenDialog: (opts: unknown) => showOpenDialog(opts),
  },
}));

const COLUMNS: TableColumn[] = [
  { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true, default: null },
  { name: 'name', type: 'TEXT', nullable: true, primaryKey: false, autoIncrement: false, default: null },
];

function errorCode(result: Result<unknown>): string | undefined {
  return result.ok ? undefined : 'code' in result.error ? result.error.code : undefined;
}

function fakeDialect(overrides: Partial<DialectPort> = {}): DialectPort {
  const rows: Record<string, unknown>[] = [
    { id: 1, name: "O'Brien" },
    { id: 2, name: 'World' },
  ];
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
    execute: vi.fn().mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT')) {
        const page = [...rows];
        rows.length = 0;
        return Promise.resolve({ rows: page, columns: [], affected: 0 });
      }
      return Promise.resolve({ rows: [], columns: [], affected: 0 });
    }),
    stream: vi.fn(),
    listTables: vi.fn().mockResolvedValue([]),
    listDatabases: vi.fn().mockResolvedValue([]),
    listViews: vi.fn().mockResolvedValue([]),
    listProcedures: vi.fn().mockResolvedValue([]),
    listTriggers: vi.fn().mockResolvedValue([]),
    listUsers: vi.fn().mockResolvedValue([]),
    getTableSchema: vi.fn().mockResolvedValue(COLUMNS),
    getTableDefinition: vi.fn(),
    previewDdl: vi.fn(() => ''),
    quoteIdentifier: vi.fn((id: string) => `"${id}"`),
    parameterPlaceholder: vi.fn(() => '?'),
    ...overrides,
  };
}

/** Helper untuk test yang perlu mengintrospeksi panggilan `execute` secara langsung. */
function fakeDialectWithExecute(
  overrides: Partial<DialectPort> = {},
): { dialect: DialectPort; execute: ReturnType<typeof vi.fn> } {
  const execute = vi.fn().mockImplementation((sql: string) => {
    if (sql.startsWith('SELECT')) {
      return Promise.resolve({ rows: [], columns: [], affected: 0 });
    }
    return Promise.resolve({ rows: [], columns: [], affected: 0 });
  });
  const dialect = fakeDialect({ execute, ...overrides });
  return { dialect, execute };
}

function fakeConnections(dialect: DialectPort): ConnectionManager {
  return {
    getSession: (connectionId: string) => {
      if (connectionId === 'none') return undefined;
      return { dialect, config: { name: 't', engine: 'sqlite' } };
    },
  } as unknown as ConnectionManager;
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

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'canvabase-transfer-'));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('TransferService.export', () => {
  it('exports rows to CSV with header', async () => {
    const filePath = join(dir, 'out.csv');
    showSaveDialog.mockResolvedValue({ canceled: false, filePath });
    const service = new TransferService(fakeConnections(fakeDialect()));
    const result = await service.export({
      connectionId: 'c1',
      format: 'csv',
      table: 'users',
      columns: ['id', 'name'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toBe(2);
    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('id,name');
    expect(content).toContain("O'Brien");
  });

  it('exports rows to JSON array', async () => {
    const filePath = join(dir, 'out.json');
    showSaveDialog.mockResolvedValue({ canceled: false, filePath });
    const service = new TransferService(fakeConnections(fakeDialect()));
    const result = await service.export({
      connectionId: 'c1',
      format: 'json',
      table: 'users',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toBe(2);
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    expect(parsed).toEqual([
      { id: 1, name: "O'Brien" },
      { id: 2, name: 'World' },
    ]);
  });

  it('returns INVALID_INPUT for unknown format', async () => {
    const service = new TransferService(fakeConnections(fakeDialect()));
    const result = await service.export({
      connectionId: 'c1',
      format: 'yaml',
      table: 'users',
    } as never);
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('INVALID_INPUT');
  });

  it('returns UNSUPPORTED_OPERATION when dialect lacks tableSchema', async () => {
    const service = new TransferService(fakeConnections(noSchemaDialect()));
    const result = await service.export({ connectionId: 'c1', format: 'csv', table: 'users' });
    expect(errorCode(result)).toBe('UNSUPPORTED_OPERATION');
  });

  it('returns canceled result without writing when dialog dismissed', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    const service = new TransferService(fakeConnections(fakeDialect()));
    const result = await service.export({ connectionId: 'c1', format: 'csv', table: 'users' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.rows).toBe(0);
  });

  it('export menulis audit log (UU PDP: export data besar)', async () => {
    const filePath = join(dir, 'out-audit.csv');
    showSaveDialog.mockResolvedValue({ canceled: false, filePath });
    const service = new TransferService(fakeConnections(fakeDialect()), undefined, new AuditLogger(dir));
    const result = await service.export({ connectionId: 'c1', format: 'csv', table: 'users' });
    expect(result.ok).toBe(true);

    const raw = await readFile(join(dir, 'audit-log.json'), 'utf8');
    const audit = JSON.parse(raw) as Array<{ action: string; target?: string; connectionId?: string; detail?: Record<string, unknown> }>;
    const entry = audit.find((e) => e.action === 'transfer.export');
    expect(entry).toBeDefined();
    expect(entry?.target).toBe('users');
    expect(entry?.connectionId).toBe('c1');
    expect(entry?.detail?.format).toBe('csv');
  });
});

describe('TransferService.import', () => {
  it('imports CSV via parameterized batch insert', async () => {
    const filePath = join(dir, 'in.csv');
    await writeFile(filePath, "id,name\n1,O'Brien\n2,World\n", 'utf8');
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] });
    const { dialect, execute } = fakeDialectWithExecute();
    const service = new TransferService(fakeConnections(dialect));
    const result = await service.import({ connectionId: 'c1', format: 'csv', table: 'users', mode: 'insert', batchSize: 1000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toBe(2);

    const insertCalls = execute.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT'));
    expect(insertCalls).toHaveLength(1);
    const [sql, params] = insertCalls[0] as [string, unknown[]];
    expect(sql).not.toContain("O'Brien");
    expect(sql).toContain('?');
    expect(params).toEqual(['1', "O'Brien", '2', 'World']);
  });

  it('filters CSV columns not present in the table schema', async () => {
    const filePath = join(dir, 'in.csv');
    await writeFile(filePath, 'id,unknown,extra\n1,2,3\n', 'utf8');
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] });
    const { dialect, execute } = fakeDialectWithExecute();
    const service = new TransferService(fakeConnections(dialect));
    const result = await service.import({ connectionId: 'c1', format: 'csv', table: 'users', mode: 'insert', batchSize: 1000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const insert = execute.mock.calls.find(([q]) => String(q).startsWith('INSERT')) as [string, unknown[]];
    const [sql, params] = insert;
    expect(sql).toContain('"id"');
    expect(sql).not.toContain('unknown');
    expect(params).toEqual(['1']);
  });

  it('truncates before insert in replace mode', async () => {
    const filePath = join(dir, 'in.csv');
    await writeFile(filePath, "id,name\n1,x\n", 'utf8');
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] });
    const { dialect, execute } = fakeDialectWithExecute();
    const service = new TransferService(fakeConnections(dialect));
    const result = await service.import({ connectionId: 'c1', format: 'csv', table: 'users', mode: 'replace', batchSize: 1000 });
    expect(result.ok).toBe(true);
    expect(execute.mock.calls.some(([sql]) => String(sql).startsWith('DELETE FROM'))).toBe(true);
  });

  it('executes safe SQL scripts and blocks destructive ones', async () => {
    const filePath = join(dir, 'in.sql');
    await writeFile(filePath, "INSERT INTO users VALUES (1);\nDROP TABLE users;\n", 'utf8');
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] });
    const { dialect, execute } = fakeDialectWithExecute();
    const service = new TransferService(fakeConnections(dialect));
    const result = await service.import({ connectionId: 'c1', format: 'sql', mode: 'insert', batchSize: 1000 });
    expect(result.ok).toBe(false);
    expect(errorCode(result)).toBe('QUERY_ERROR');
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns NOT_CONNECTED for unknown connection', async () => {
    const service = new TransferService(fakeConnections(fakeDialect()));
    const result = await service.export({ connectionId: 'none', format: 'csv', table: 'users' });
    expect(errorCode(result)).toBe('NOT_CONNECTED');
  });
});
