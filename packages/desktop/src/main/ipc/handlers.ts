import { ipcMain } from 'electron';
import {
  connectionConfigSchema,
  ok,
  fail,
  tableDraftSchema,
  exportInputSchema,
  importInputSchema,
  backupDatabaseInputSchema,
  restoreInputSchema,
} from '@canvabase/contracts';
import type { ConnectionConfig, Result, TableDraft } from '@canvabase/contracts';
import type { RowValue } from '@canvabase/contracts';
import { IPC_CHANNELS } from '../../ipc/channels.js';
import type { ConnectionManager } from '../services/ConnectionManager.js';
import type { ObjectBrowserService } from '../services/ObjectBrowserService.js';
import type { QueryEngine } from '../services/QueryEngine.js';
import type { DataService } from '../services/DataService.js';
import type { TableDesignerService } from '../services/TableDesignerService.js';
import type { ErdService } from '../services/ErdService.js';
import type { TransferService } from '../services/TransferService.js';

interface Services {
  connections: ConnectionManager;
  query: QueryEngine;
  browser: ObjectBrowserService;
  data: DataService;
  designer: TableDesignerService;
  erd: ErdService;
  transfer: TransferService;
}

function validateConfig(input: unknown): Result<ConnectionConfig> {
  const parsed = connectionConfigSchema.safeParse(input);
  if (!parsed.success) {
    return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
  }
  return ok(parsed.data);
}

function asString(value: unknown): value is string {
  return typeof value === 'string';
}

function asRowValues(value: unknown): value is RowValue[] {
  if (!Array.isArray(value)) return false;
  return value.every((item): boolean => {
    if (typeof item !== 'object' || item === null || !('column' in item) || !('value' in item)) {
      return false;
    }
    const column = (item as { column: unknown }).column;
    return typeof column === 'string';
  });
}

/** Parse + validasi payload designer (connectionId + draft zod) — JANGAN percaya renderer. */
function parseDesignerInput(input: unknown): { connectionId: string; draft: TableDraft } | null {
  if (!input || typeof input !== 'object') return null;
  const { connectionId, draft } = input as { connectionId: unknown; draft: unknown };
  if (typeof connectionId !== 'string') return null;
  const parsed = tableDraftSchema.safeParse(draft);
  if (!parsed.success) return null;
  return { connectionId, draft: parsed.data };
}

export function registerIpcHandlers({ connections, query, browser, data, designer, erd, transfer }: Services): void {
  ipcMain.handle(IPC_CHANNELS.connectionsList, () => connections.list());

  ipcMain.handle(IPC_CHANNELS.connectionsCreate, (_event, input: unknown) => {
    const validated = validateConfig(input);
    if (!validated.ok) return validated;
    return connections.create(validated.data);
  });

  ipcMain.handle(IPC_CHANNELS.connectionsUpdate, (_event, input: unknown) => {
    if (!input || typeof input !== 'object' || !('id' in input)) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { id, ...rest } = input as { id: string } & Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) patch[key] = value;
    }
    const parsed = connectionConfigSchema.partial().safeParse(patch);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return connections.update(id, parsed.data as Partial<ConnectionConfig>);
  });

  ipcMain.handle(IPC_CHANNELS.connectionsDelete, (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return connections.delete(id);
  });

  ipcMain.handle(IPC_CHANNELS.connectionsTest, (_event, input: unknown) => {
    const validated = validateConfig(input);
    if (!validated.ok) return validated;
    return connections.test(validated.data);
  });

  ipcMain.handle(IPC_CHANNELS.connectionsConnect, (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return connections.connect(id);
  });

  ipcMain.handle(IPC_CHANNELS.connectionsDisconnect, (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return connections.disconnect(id);
  });

  ipcMain.handle(IPC_CHANNELS.browserTables, (_event, connectionId: unknown) => {
    if (typeof connectionId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return browser.listTables(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.browserCapabilities, (_event, connectionId: unknown) => {
    if (typeof connectionId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return browser.capabilities(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.browserDatabases, (_event, connectionId: unknown) => {
    if (typeof connectionId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return browser.listDatabases(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.browserViews, (_event, connectionId: unknown) => {
    if (typeof connectionId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return browser.listViews(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.browserProcedures, (_event, connectionId: unknown) => {
    if (typeof connectionId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return browser.listProcedures(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.browserTriggers, (_event, connectionId: unknown) => {
    if (typeof connectionId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return browser.listTriggers(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.browserUsers, (_event, connectionId: unknown) => {
    if (typeof connectionId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return browser.listUsers(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.queryExecute, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, sql, params, signalId } = input as {
      connectionId: string;
      sql: string;
      params?: unknown[];
      signalId?: string;
    };
    if (typeof connectionId !== 'string' || typeof sql !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return query.execute({
      connectionId,
      sql,
      ...(params !== undefined ? { params } : {}),
      ...(signalId !== undefined ? { signalId } : {}),
    });
  });

  ipcMain.handle(IPC_CHANNELS.queryFetchChunk, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, offset, size } = input as {
      connectionId: string;
      offset: number;
      size: number;
    };
    if (typeof connectionId !== 'string' || typeof offset !== 'number' || typeof size !== 'number') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return query.fetchChunk({ connectionId, offset, size });
  });

  ipcMain.handle(IPC_CHANNELS.queryCancel, (_event, signalId: unknown) => {
    if (typeof signalId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return query.cancel(signalId);
  });

  ipcMain.handle(IPC_CHANNELS.querySuggest, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, sql, position } = input as {
      connectionId: string;
      sql: string;
      position: number;
    };
    if (typeof connectionId !== 'string' || typeof sql !== 'string' || typeof position !== 'number') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return query.suggest({ connectionId, sql, position });
  });

  ipcMain.handle(IPC_CHANNELS.querySavedList, () => query.savedList());

  ipcMain.handle(IPC_CHANNELS.querySavedSave, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { name, sql } = input as { name: string; sql: string };
    if (typeof name !== 'string' || typeof sql !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return query.savedSave({ name, sql });
  });

  ipcMain.handle(IPC_CHANNELS.querySavedDelete, (_event, id: unknown) => {
    if (typeof id !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return query.savedDelete(id);
  });

  ipcMain.handle(IPC_CHANNELS.health, () => ok({ online: true }));

  ipcMain.handle(IPC_CHANNELS.designerGetTable, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, table } = input as { connectionId: unknown; table: unknown };
    if (!asString(connectionId) || !asString(table)) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return designer.getTable(connectionId, table);
  });

  ipcMain.handle(IPC_CHANNELS.designerPreviewDdl, (_event, input: unknown) => {
    const parsed = parseDesignerInput(input);
    if (!parsed) return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    return designer.previewDdl(parsed);
  });

  ipcMain.handle(IPC_CHANNELS.designerApply, (_event, input: unknown) => {
    const parsed = parseDesignerInput(input);
    if (!parsed) return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    return designer.apply(parsed);
  });

  ipcMain.handle(IPC_CHANNELS.designerDrop, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, table } = input as { connectionId: unknown; table: unknown };
    if (!asString(connectionId) || !asString(table)) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return designer.drop(connectionId, table);
  });

  ipcMain.handle(IPC_CHANNELS.erdGenerate, (_event, connectionId: unknown) => {
    if (typeof connectionId !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return erd.generate(connectionId);
  });

  ipcMain.handle(IPC_CHANNELS.erdExportImage, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { dataUrl, defaultName } = input as { dataUrl: unknown; defaultName: unknown };
    if (typeof dataUrl !== 'string' || typeof defaultName !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return erd.exportImage({ dataUrl, defaultName });
  });

  ipcMain.handle(IPC_CHANNELS.transferExport, (_event, input: unknown) => {
    const parsed = exportInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return transfer.export(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.transferImport, (_event, input: unknown) => {
    const parsed = importInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return transfer.import(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.transferBackupDatabase, (_event, input: unknown) => {
    const parsed = backupDatabaseInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return transfer.backupDatabase(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.transferRestore, (_event, input: unknown) => {
    const parsed = restoreInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return transfer.restore(parsed.data);
  });

  ipcMain.handle(IPC_CHANNELS.dataSchema, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, table } = input as { connectionId: unknown; table: unknown };
    if (!asString(connectionId) || !asString(table)) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return data.getSchema({ connectionId, table });
  });

  ipcMain.handle(IPC_CHANNELS.dataOpenTable, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, table, limit } = input as {
      connectionId: unknown;
      table: unknown;
      limit?: unknown;
    };
    if (!asString(connectionId) || !asString(table)) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return data.openTable({
      connectionId,
      table,
      ...(typeof limit === 'number' ? { limit } : {}),
    });
  });

  ipcMain.handle(IPC_CHANNELS.dataUpdateRow, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, table, where, changes } = input as {
      connectionId: unknown;
      table: unknown;
      where: unknown;
      changes: unknown;
    };
    if (!asString(connectionId) || !asString(table) || !asRowValues(where) || !asRowValues(changes)) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return data.updateRow({ connectionId, table, where, changes });
  });

  ipcMain.handle(IPC_CHANNELS.dataInsertRow, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, table, values } = input as {
      connectionId: unknown;
      table: unknown;
      values: unknown;
    };
    if (!asString(connectionId) || !asString(table) || !asRowValues(values)) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return data.insertRow({ connectionId, table, values });
  });

  ipcMain.handle(IPC_CHANNELS.dataDeleteRow, (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, table, where } = input as {
      connectionId: unknown;
      table: unknown;
      where: unknown;
    };
    if (!asString(connectionId) || !asString(table) || !asRowValues(where)) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    return data.deleteRow({ connectionId, table, where });
  });
}
