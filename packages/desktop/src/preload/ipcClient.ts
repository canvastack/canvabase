import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type {
  BrowserApi,
  BrowserCapabilities,
  Chunk,
  Client,
  ClientError,
  ColumnMetadata,
  ConnectionApi,
  ConnectionConfig,
  ConnectionSummary,
  DataApi,
  DesignerApi,
  ErdApi,
  ErdGraph,
  EventBusApi,
  ExportInput,
  HealthApi,
  ImportInput,
  BackupDatabaseInput,
  RestoreInput,
  ObjectNode,
  QueryApi,
  Result,
  RowValue,
  SavedQuery,
  SavedQueryInput,
  SettingsApi,
  Suggestion,
  TableDefinition,
  TableDraft,
  TableSchema,
  TransferApi,
} from '@canvabase/contracts';
import { IPC_CHANNELS } from '../ipc/channels.js';

function invoke<T>(channel: string, payload?: unknown): Promise<Result<T>> {
  return ipcRenderer.invoke(channel, payload) as Promise<Result<T>>;
}

function unsupported(): Promise<Result<never>> {
  const error: ClientError = { type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' };
  return Promise.resolve({ ok: false, error });
}

const connections: ConnectionApi = {
  list: () => invoke<ConnectionSummary[]>(IPC_CHANNELS.connectionsList),
  create: (input: ConnectionConfig) => invoke<ConnectionSummary>(IPC_CHANNELS.connectionsCreate, input),
  update: (id: string, input: Partial<ConnectionConfig>) =>
    invoke<ConnectionSummary>(IPC_CHANNELS.connectionsUpdate, { id, ...input }),
  delete: (id: string) => invoke<{ deleted: boolean }>(IPC_CHANNELS.connectionsDelete, id),
  test: (input: ConnectionConfig) =>
    invoke<{ ok: boolean; latencyMs: number }>(IPC_CHANNELS.connectionsTest, input),
  connect: (id: string) => invoke<ConnectionSummary>(IPC_CHANNELS.connectionsConnect, id),
  disconnect: (id: string) =>
    invoke<{ disconnected: boolean }>(IPC_CHANNELS.connectionsDisconnect, id),
};

const browser: BrowserApi = {
  capabilities: (connectionId: string) =>
    invoke<BrowserCapabilities>(IPC_CHANNELS.browserCapabilities, connectionId),
  listDatabases: (connectionId: string) =>
    invoke<ObjectNode[]>(IPC_CHANNELS.browserDatabases, connectionId),
  listTables: (connectionId: string) =>
    invoke<ObjectNode[]>(IPC_CHANNELS.browserTables, connectionId),
  listViews: (connectionId: string) =>
    invoke<ObjectNode[]>(IPC_CHANNELS.browserViews, connectionId),
  listProcedures: (connectionId: string) =>
    invoke<ObjectNode[]>(IPC_CHANNELS.browserProcedures, connectionId),
  listTriggers: (connectionId: string) =>
    invoke<ObjectNode[]>(IPC_CHANNELS.browserTriggers, connectionId),
  listUsers: (connectionId: string) =>
    invoke<ObjectNode[]>(IPC_CHANNELS.browserUsers, connectionId),
};

const query: QueryApi = {
  execute: (input: {
    connectionId: string;
    sql: string;
    params?: unknown[];
    signalId?: string;
  }) =>
    invoke<{ chunk: Chunk<Record<string, unknown>>; columns: ColumnMetadata[] }>(
      IPC_CHANNELS.queryExecute,
      input,
    ),
  fetchChunk: (input: { connectionId: string; offset: number; size: number }) =>
    invoke<Chunk<Record<string, unknown>>>(IPC_CHANNELS.queryFetchChunk, input),
  cancel: (signalId: string) =>
    invoke<{ cancelled: boolean }>(IPC_CHANNELS.queryCancel, signalId),
  suggest: (input: { connectionId: string; sql: string; position: number }) =>
    invoke<Suggestion[]>(IPC_CHANNELS.querySuggest, input),
  savedList: () => invoke<SavedQuery[]>(IPC_CHANNELS.querySavedList),
  savedSave: (input: SavedQueryInput) =>
    invoke<SavedQuery>(IPC_CHANNELS.querySavedSave, input),
  savedDelete: (id: string) =>
    invoke<{ deleted: boolean }>(IPC_CHANNELS.querySavedDelete, id),
};

const data: DataApi = {
  getSchema: (input: { connectionId: string; table: string }) =>
    invoke<TableSchema>(IPC_CHANNELS.dataSchema, input),
  openTable: (input: { connectionId: string; table: string; limit?: number }) =>
    invoke<{ chunk: Chunk<Record<string, unknown>>; columns: ColumnMetadata[]; table: string }>(
      IPC_CHANNELS.dataOpenTable,
      input,
    ),
  updateRow: (input: { connectionId: string; table: string; where: RowValue[]; changes: RowValue[] }) =>
    invoke<{ affected: number }>(IPC_CHANNELS.dataUpdateRow, input),
  insertRow: (input: { connectionId: string; table: string; values: RowValue[] }) =>
    invoke<{ affected: number }>(IPC_CHANNELS.dataInsertRow, input),
  deleteRow: (input: { connectionId: string; table: string; where: RowValue[] }) =>
    invoke<{ affected: number }>(IPC_CHANNELS.dataDeleteRow, input),
};

const designer: DesignerApi = {
  getTable: (connectionId: string, table: string) =>
    invoke<TableDefinition>(IPC_CHANNELS.designerGetTable, { connectionId, table }),
  previewDdl: (input: { connectionId: string; draft: TableDraft }) =>
    invoke<string>(IPC_CHANNELS.designerPreviewDdl, input),
  apply: (input: { connectionId: string; draft: TableDraft }) =>
    invoke<{ applied: boolean }>(IPC_CHANNELS.designerApply, input),
  drop: (connectionId: string, table: string) =>
    invoke<{ dropped: boolean }>(IPC_CHANNELS.designerDrop, { connectionId, table }),
};

const erd: ErdApi = {
  generate: (connectionId: string) =>
    invoke<ErdGraph>(IPC_CHANNELS.erdGenerate, connectionId),
  exportImage: (input: { dataUrl: string; defaultName: string }) =>
    invoke<{ saved: boolean; path: string | null }>(IPC_CHANNELS.erdExportImage, input),
};

const transfer: TransferApi = {
  export: (input: ExportInput) =>
    invoke<{ path: string; rows: number }>(IPC_CHANNELS.transferExport, input),
  import: (input: ImportInput) =>
    invoke<{ rows: number }>(IPC_CHANNELS.transferImport, input),
  backupDatabase: (input: BackupDatabaseInput) =>
    invoke<{ path: string; rows: number }>(IPC_CHANNELS.transferBackupDatabase, input),
  restore: (input: RestoreInput) =>
    invoke<{ rows: number }>(IPC_CHANNELS.transferRestore, input),
};

const settings: SettingsApi = {
  get: () => unsupported(),
  set: () => unsupported(),
};

const events: EventBusApi = {
  subscribe: (event: string, handler: (payload: unknown) => void) => {
    const listener = (_event: IpcRendererEvent, payload: unknown): void => handler(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
  emit: (event: string, payload: unknown) => {
    ipcRenderer.send(event, payload);
  },
};

const health: HealthApi = {
  health: async () => {
    const result = await invoke<{ online: boolean }>(IPC_CHANNELS.health);
    return result.ok ? result.data : { online: false };
  },
};

const client: Client = { connections, browser, query, data, designer, erd, transfer, settings, events, health };

export function exposeClient(): void {
  contextBridge.exposeInMainWorld('canvabase', client);
}
