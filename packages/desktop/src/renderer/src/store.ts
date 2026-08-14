import { create } from 'zustand';
import type {
  BrowserCapabilities,
  Client,
  ClientError,
  ColumnMetadata,
  ConnectionConfig,
  ConnectionSummary,
  ErdGraph,
  ExportFormat,
  ImportMode,
  ObjectNode,
  RowValue,
  SavedQuery,
  TableColumn,
  TableDefinition,
  TableDraft,
} from '@canvabase/contracts';
import { transferProgressSchema } from '@canvabase/contracts';
import { coerceCellValue, pkValues } from './lib/gridOps';
import type { RowFilters, SortState } from './lib/gridOps';
import { IPC_CHANNELS } from '../../ipc/channels';

const CHUNK_SIZE = 500;

function errorMessage(error: ClientError): string {
  if ('message' in error && error.message) return error.message;
  if ('code' in error && error.code) return error.code;
  if ('originalError' in error) return 'Network error';
  return 'Unknown error';
}

export interface QueryTab {
  id: string;
  title: string;
  sql: string;
  running: boolean;
  columns: ColumnMetadata[];
  rows: Record<string, unknown>[];
  hasMore: boolean;
  error: string | null;
  table: string | null;
  schema: TableColumn[];
  sort: SortState | null;
  filters: RowFilters;
  page: number;
  pageSize: number;
}

interface BrowserState {
  capabilities: BrowserCapabilities | null;
  databases: ObjectNode[];
  tables: ObjectNode[];
  views: ObjectNode[];
  procedures: ObjectNode[];
  triggers: ObjectNode[];
  users: ObjectNode[];
  loading: boolean;
  error: string | null;
}

interface DesignerState {
  open: boolean;
  creating: boolean;
  loading: boolean;
  error: string | null;
  definition: TableDefinition | null;
  draft: TableDraft | null;
  preview: string | null;
  dirty: boolean;
}

interface ErdState {
  open: boolean;
  loading: boolean;
  error: string | null;
  graph: ErdGraph | null;
  focusTable: string | null;
}

interface TransferState {
  active: boolean;
  direction: 'export' | 'import' | null;
  format: ExportFormat | null;
  processed: number;
  total: number | null;
  error: string | null;
}

export type InspectorTargetType =
  | 'table'
  | 'schema'
  | 'database'
  | 'field'
  | 'index'
  | 'foreignKey'
  | 'view'
  | 'procedure'
  | 'trigger'
  | 'user';

export interface InspectorTarget {
  type: InspectorTargetType;
  name: string;
  parentTable?: string;
  schema?: string | null;
  metadata?: Record<string, unknown>;
}

interface AppState {
  client: Client;
  connections: ConnectionSummary[];
  activeConnectionId: string | null;
  loaded: boolean;
  tabs: QueryTab[];
  activeTabId: string;
  savedQueries: SavedQuery[];
  browser: BrowserState;
  activeView: 'query' | 'designer' | 'erd' | 'database';
  setActiveView: (view: 'query' | 'designer' | 'erd' | 'database') => void;
  selectedTarget: InspectorTarget | null;
  setSelectedTarget: (target: InspectorTarget | null) => void;
  designerSection: 'columns' | 'indexes' | 'foreignKeys';
  setDesignerSection: (section: 'columns' | 'indexes' | 'foreignKeys') => void;
  objectViewMode: 'cards' | 'list' | 'details';
  setObjectViewMode: (mode: 'cards' | 'list' | 'details') => void;
  backupDatabase: (format: 'csv' | 'sql' | 'txt') => Promise<boolean>;
  backupTable: (tableName: string, format: 'csv' | 'sql' | 'txt') => Promise<boolean>;
  restoreDatabase: (format: 'csv' | 'sql' | 'txt') => Promise<boolean>;
  restoreTable: (tableName: string, format: 'csv' | 'sql' | 'txt') => Promise<boolean>;
  updateConnection: (id: string, input: Partial<ConnectionConfig>) => Promise<boolean>;
  deleteConnection: (id: string) => Promise<boolean>;
  testConnection: (input: ConnectionConfig) => Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
  selectDatabase: (databaseName: string) => Promise<boolean>;
  refreshConnections: () => Promise<void>;
  createConnection: (input: {
    name: string;
    engine: 'mysql' | 'postgresql' | 'sqlite';
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }) => Promise<boolean>;
  connect: (id: string) => Promise<{ ok: boolean; error?: string }>;
  disconnect: (id: string) => Promise<void>;
  selectedTable: string | null;
  setSelectedTable: (table: string | null) => void;
  newTab: () => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  runQuery: () => Promise<void>;
  fetchMore: () => Promise<void>;
  cancelQuery: () => Promise<void>;
  setSql: (sql: string) => void;
  saveQuery: (name: string) => Promise<boolean>;
  deleteSavedQuery: (id: string) => Promise<void>;
  loadSavedQueries: () => Promise<void>;
  refreshBrowser: () => Promise<void>;
  openTable: (table: string) => Promise<boolean>;
  openProcedure: (procedureName: string) => void;
  openTrigger: (triggerName: string) => void;
  openUser: (userName: string) => void;
  closeTable: () => void;
  setSort: (column: string) => void;
  setFilter: (column: string, value: string) => void;
  updateCell: (rowIndex: number, column: string, value: unknown) => Promise<void>;
  deleteRowAt: (rowIndex: number) => Promise<void>;
  insertRow: (values: RowValue[]) => Promise<boolean>;
  designer: DesignerState;
  openDesigner: (table: string) => Promise<void>;
  newDesigner: () => void;
  closeDesigner: () => void;
  updateDesignerDraft: (draft: TableDraft) => void;
  previewDesignerDdl: () => Promise<void>;
  applyDesigner: () => Promise<boolean>;
  dropDesignerTable: () => Promise<boolean>;
  erd: ErdState;
  openErd: () => Promise<void>;
  closeErd: () => void;
  setErdFocus: (table: string | null) => void;
  exportErdImage: (dataUrl: string, defaultName: string) => Promise<boolean>;
  transfer: TransferState;
  exportTable: (format: ExportFormat) => Promise<boolean>;
  importData: (format: ExportFormat, mode?: ImportMode) => Promise<boolean>;
  toolbarDisplayStyle: 'both' | 'icon' | 'text';
  setToolbarDisplayStyle: (style: 'both' | 'icon' | 'text') => void;
  leftSidebarOpen: boolean;
  setLeftSidebarOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;
  leftSidebarWidth: number;
  setLeftSidebarWidth: (width: number) => void;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  toggleRightSidebar: () => void;
  rightSidebarWidth: number;
  setRightSidebarWidth: (width: number) => void;
  gridDisplayMode: 'grid' | 'form';
  setGridDisplayMode: (mode: 'grid' | 'form') => void;
  inspectorTab: 'info' | 'ddl' | 'ai';
  setInspectorTab: (tab: 'info' | 'ddl' | 'ai') => void;
  setGridPage: (page: number) => void;
  setGridPageSize: (pageSize: number) => void;
  nextGridPage: () => void;
  prevGridPage: () => void;
  firstGridPage: () => void;
  lastGridPage: () => void;
}

let tabCounter = 0;
let signalCounter = 0;

function nextTabId(): string {
  return `tab-${Date.now()}-${tabCounter++}`;
}

function emptyTab(): QueryTab {
  return {
    id: nextTabId(),
    title: 'Untitled',
    sql: '',
    running: false,
    columns: [],
    rows: [],
    hasMore: false,
    error: null,
    table: null,
    schema: [],
    sort: null,
    filters: {},
    page: 1,
    pageSize: 500,
  };
}

const initialBrowser: BrowserState = {
  capabilities: null,
  databases: [],
  tables: [],
  views: [],
  procedures: [],
  triggers: [],
  users: [],
  loading: false,
  error: null,
};

const initialDesigner: DesignerState = {
  open: false,
  creating: false,
  loading: false,
  error: null,
  definition: null,
  draft: null,
  preview: null,
  dirty: false,
};

const initialErd: ErdState = {
  open: false,
  loading: false,
  error: null,
  graph: null,
  focusTable: null,
};

const initialTransfer: TransferState = {
  active: false,
  direction: null,
  format: null,
  processed: 0,
  total: null,
  error: null,
};

export const createAppStore = (client: Client) => {
  const firstTab = emptyTab();
  client.events.subscribe(IPC_CHANNELS.transferProgress, (payload) => {
    const parsed = transferProgressSchema.safeParse(payload);
    if (!parsed.success) return;
    const p = parsed.data;
    appStore.setState({
      transfer: {
        active: p.phase !== 'done',
        direction: p.direction,
        format: p.format,
        processed: p.processed,
        total: p.total,
        error: p.error ?? null,
      },
    });
  });
  const appStore = create<AppState>()((set, get) => ({
    client,
    connections: [],
    activeConnectionId: null,
    selectedTable: null,
    loaded: false,
    tabs: [firstTab],
    activeTabId: firstTab.id,
    savedQueries: [],
    browser: initialBrowser,
    designer: initialDesigner,
    erd: initialErd,

    activeView: 'query',
    setActiveView: (activeView) => set({ activeView }),

    selectedTarget: null,
    setSelectedTarget: (selectedTarget) => set({ selectedTarget }),

    designerSection: 'columns',
    setDesignerSection: (designerSection) => set({ designerSection }),

    objectViewMode:
      (localStorage.getItem('cb_object_view_mode') as 'cards' | 'list' | 'details') || 'cards',
    setObjectViewMode: (mode) => {
      localStorage.setItem('cb_object_view_mode', mode);
      set({ objectViewMode: mode });
    },

    toolbarDisplayStyle:
      (localStorage.getItem('cb_toolbar_style') as 'both' | 'icon' | 'text') || 'both',
    setToolbarDisplayStyle: (style) => {
      localStorage.setItem('cb_toolbar_style', style);
      set({ toolbarDisplayStyle: style });
    },

    leftSidebarOpen: localStorage.getItem('cb_left_sidebar_open') !== 'false',
    setLeftSidebarOpen: (open) => {
      localStorage.setItem('cb_left_sidebar_open', String(open));
      set({ leftSidebarOpen: open });
    },
    toggleLeftSidebar: () => {
      const next = !get().leftSidebarOpen;
      localStorage.setItem('cb_left_sidebar_open', String(next));
      set({ leftSidebarOpen: next });
    },
    leftSidebarWidth: Math.max(
      200,
      Math.min(600, parseInt(localStorage.getItem('cb_left_sidebar_width') || '300', 10))
    ),
    setLeftSidebarWidth: (width) => {
      const clamped = Math.max(200, Math.min(600, width));
      localStorage.setItem('cb_left_sidebar_width', String(clamped));
      set({ leftSidebarWidth: clamped });
    },

    rightSidebarOpen: false,
    setRightSidebarOpen: (open) => {
      localStorage.setItem('cb_right_sidebar_open', String(open));
      set({ rightSidebarOpen: open });
    },
    toggleRightSidebar: () => {
      const next = !get().rightSidebarOpen;
      localStorage.setItem('cb_right_sidebar_open', String(next));
      set({ rightSidebarOpen: next });
    },
    rightSidebarWidth: Math.max(
      220,
      Math.min(600, parseInt(localStorage.getItem('cb_right_sidebar_width') || '320', 10))
    ),
    setRightSidebarWidth: (width) => {
      const clamped = Math.max(220, Math.min(600, width));
      localStorage.setItem('cb_right_sidebar_width', String(clamped));
      set({ rightSidebarWidth: clamped });
    },

    gridDisplayMode: 'grid',
    setGridDisplayMode: (gridDisplayMode) => set({ gridDisplayMode }),

    inspectorTab: 'info',
    setInspectorTab: (inspectorTab) => set({ inspectorTab }),

    setGridPage: (page) => {
      const { activeTabId } = get();
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, page: Math.max(1, page) } : t)),
      }));
    },

    setGridPageSize: (pageSize) => {
      const { activeTabId } = get();
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId ? { ...t, pageSize: Math.max(10, pageSize), page: 1 } : t,
        ),
      }));
    },

    nextGridPage: () => {
      const { activeTabId, tabs } = get();
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;
      const totalPages = Math.max(1, Math.ceil(tab.rows.length / tab.pageSize));
      if (tab.page < totalPages) {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, page: t.page + 1 } : t)),
        }));
      }
    },

    prevGridPage: () => {
      const { activeTabId, tabs } = get();
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;
      if (tab.page > 1) {
        set((s) => ({
          tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, page: t.page - 1 } : t)),
        }));
      }
    },

    firstGridPage: () => {
      const { activeTabId } = get();
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, page: 1 } : t)),
      }));
    },

    lastGridPage: () => {
      const { activeTabId, tabs } = get();
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;
      const totalPages = Math.max(1, Math.ceil(tab.rows.length / tab.pageSize));
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, page: totalPages } : t)),
      }));
    },

    updateConnection: async (id, input: Partial<ConnectionConfig>) => {
      const result = await client.connections.update(id, input);
      if (result.ok) {
        await get().refreshConnections();
        return true;
      }
      return false;
    },

    deleteConnection: async (id) => {
      const result = await client.connections.delete(id);
      if (result.ok) {
        if (get().activeConnectionId === id) {
          set({ activeConnectionId: null, browser: initialBrowser });
        }
        await get().refreshConnections();
        return true;
      }
      return false;
    },

    testConnection: async (input: ConnectionConfig) => {
      const result = await client.connections.test(input);
      if (result.ok) {
        return { ok: true, latencyMs: result.data.latencyMs };
      }
      return { ok: false, error: errorMessage(result.error) };
    },

    selectDatabase: async (databaseName) => {
      const { activeConnectionId, activeTabId } = get();
      if (!activeConnectionId) return false;
      const result = await client.connections.update(activeConnectionId, { database: databaseName });
      if (result.ok) {
        await get().refreshConnections();
        await get().refreshBrowser();

        const tab = get().tabs.find((t) => t.id === activeTabId);
        if (tab && tab.table) {
          void get().openTable(tab.table);
        } else if (tab) {
          set((s) => ({
            tabs: s.tabs.map((t) =>
              t.id === activeTabId
                ? { ...t, rows: [], columns: [], error: null, hasMore: false }
                : t,
            ),
          }));
        }
        return true;
      }
      return false;
    },

    refreshConnections: async () => {
      const result = await client.connections.list();
      if (result.ok) {
        const active = get().activeConnectionId;
        const stillExists = active ? result.data.some((c) => c.id === active) : false;
        const connectedConn = result.data.find((c) => c.status === 'connected');
        const nextActive = stillExists ? active : (connectedConn ? connectedConn.id : null);
        set({ connections: result.data, activeConnectionId: nextActive, loaded: true });
      }
    },

    createConnection: async (input) => {
      const result = await client.connections.create(input);
      if (!result.ok) {
        const tabs = get().tabs;
        const activeTabId = get().activeTabId;
        set({
          tabs: tabs.map((t) => (t.id === activeTabId ? { ...t, error: errorMessage(result.error) } : t)),
        });
        return false;
      }
      await get().refreshConnections();
      return true;
    },

    connect: async (id) => {
      set({ activeConnectionId: id });
      const result = await client.connections.connect(id);
      if (!result.ok) {
        set({ activeConnectionId: null });
        const err = errorMessage(result.error);
        const tabs = get().tabs;
        const activeTabId = get().activeTabId;
        set({
          tabs: tabs.map((t) => (t.id === activeTabId ? { ...t, error: err } : t)),
        });
        return { ok: false, error: err };
      }
      await get().refreshConnections();
      await get().refreshBrowser();
      return { ok: true };
    },

    disconnect: async (id) => {
      await client.connections.disconnect(id);
      await get().refreshConnections();
      if (get().activeConnectionId === id) {
        set({ activeConnectionId: null, browser: initialBrowser });
      }
    },

    setSelectedTable: (table) => {
      set({ selectedTable: table });
    },

    newTab: () => {
      const tab = emptyTab();
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get();
      if (tabs.length <= 1) {
        const fresh = emptyTab();
        set({ tabs: [fresh], activeTabId: fresh.id, selectedTable: null });
        return;
      }
      const idx = tabs.findIndex((t) => t.id === id);
      const next = tabs.filter((t) => t.id !== id);
      const fallback = next[Math.max(0, idx - 1)] ?? next[0];
      const newActive = activeTabId === id && fallback ? fallback.id : (next[0]?.id ?? '');
      set({ tabs: next, activeTabId: newActive });
    },

    activateTab: (id) => set({ activeTabId: id }),

    renameTab: (id, title) => {
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
      }));
    },

    runQuery: async () => {
      const { activeConnectionId, activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!activeConnectionId || !tab || tab.running || tab.sql.trim().length === 0) return;
      const signalId = `q-${Date.now()}-${signalCounter++}`;
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, running: true, error: null, columns: [], rows: [], hasMore: false, table: null, schema: [], sort: null, filters: {} }
            : t,
        ),
      }));
      const result = await client.query.execute({
        connectionId: activeConnectionId,
        sql: tab.sql,
        signalId,
      });
      if (result.ok) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  columns: result.data.columns,
                  rows: result.data.chunk.rows,
                  hasMore: result.data.chunk.hasMore,
                  running: false,
                }
              : t,
          ),
        }));
      } else {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId ? { ...t, running: false, error: errorMessage(result.error) } : t,
          ),
        }));
      }
    },

    fetchMore: async () => {
      const { activeConnectionId, activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!activeConnectionId || !tab || !tab.hasMore || tab.running) return;
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, running: true } : t)),
      }));
      const result = await client.query.fetchChunk({
        connectionId: activeConnectionId,
        offset: tab.rows.length,
        size: CHUNK_SIZE,
      });
      if (result.ok) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  rows: [...t.rows, ...result.data.rows],
                  hasMore: result.data.hasMore,
                  running: false,
                }
              : t,
          ),
        }));
      } else {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId ? { ...t, running: false, error: errorMessage(result.error) } : t,
          ),
        }));
      }
    },

    cancelQuery: async () => {
      const { activeTabId } = get();
      await client.query.cancel(`q-${Date.now()}-${signalCounter++}`);
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, running: false } : t)),
      }));
    },

    setSql: (sql) => {
      const { activeTabId } = get();
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId ? { ...t, sql, title: t.title === 'Untitled' && sql.length > 0 ? firstLine(sql) : t.title } : t,
        ),
      }));
    },

    saveQuery: async (name) => {
      const { activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!tab || tab.sql.trim().length === 0) return false;
      const result = await client.query.savedSave({ name, sql: tab.sql });
      if (result.ok) {
        await get().loadSavedQueries();
        return true;
      }
      return false;
    },

    deleteSavedQuery: async (id) => {
      await client.query.savedDelete(id);
      await get().loadSavedQueries();
    },

    loadSavedQueries: async () => {
      const result = await client.query.savedList();
      if (result.ok) set({ savedQueries: result.data });
    },

    refreshBrowser: async () => {
      const { activeConnectionId } = get();
      if (!activeConnectionId) {
        set({ browser: { ...initialBrowser } });
        return;
      }
      set((s) => ({ browser: { ...s.browser, loading: true, error: null } }));
      const [caps, databases, tables, views, procedures, triggers, users] = await Promise.all([
        client.browser.capabilities(activeConnectionId),
        client.browser.listDatabases(activeConnectionId),
        client.browser.listTables(activeConnectionId),
        client.browser.listViews(activeConnectionId),
        client.browser.listProcedures(activeConnectionId),
        client.browser.listTriggers(activeConnectionId),
        client.browser.listUsers(activeConnectionId),
      ]);
      set(() => ({
        browser: {
          capabilities: caps.ok ? caps.data : null,
          databases: databases.ok ? databases.data : [],
          tables: tables.ok ? tables.data : [],
          views: views.ok ? views.data : [],
          procedures: procedures.ok ? procedures.data : [],
          triggers: triggers.ok ? triggers.data : [],
          users: users.ok ? users.data : [],
          loading: false,
          error: caps.ok
            ? null
            : [databases, tables, views, procedures, triggers, users].some((r) => !r.ok)
              ? errorMessage(caps.error)
              : null,
        },
      }));
    },

    openTable: async (table) => {
      const { activeConnectionId, activeTabId, tabs } = get();
      if (!activeConnectionId) return false;
      let targetTabId = activeTabId;
      let curTab = tabs.find((t) => t.id === targetTabId);
      const first = tabs[0];
      if (!curTab) {
        if (first) {
          targetTabId = first.id;
          curTab = first;
        } else {
          const fresh = emptyTab();
          set((s) => ({ tabs: [...s.tabs, fresh], activeTabId: fresh.id }));
          targetTabId = fresh.id;
          curTab = fresh;
        }
      }
      if (curTab && curTab.running) return false;

      const defaultSql = `SELECT * FROM ${table} LIMIT 500;`;
      set((s) => ({
        selectedTable: table,
        activeTabId: targetTabId,
        activeView: 'query',
        selectedTarget: { type: 'table', name: table },
        tabs: s.tabs.map((t) =>
          t.id === targetTabId
            ? {
                ...t,
                title: table,
                sql: defaultSql,
                running: true,
                error: null,
                columns: [],
                rows: [],
                hasMore: false,
                table,
                schema: [],
                sort: null,
                filters: {},
                page: 1,
              }
            : t,
        ),
      }));
      const [schema, opened] = await Promise.all([
        client.data.getSchema({ connectionId: activeConnectionId, table }),
        client.data.openTable({ connectionId: activeConnectionId, table }),
      ]);
      if (opened.ok && schema.ok) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === targetTabId
              ? {
                  ...t,
                  columns: opened.data.columns,
                  rows: opened.data.chunk.rows,
                  hasMore: opened.data.chunk.hasMore,
                  schema: schema.data.columns,
                  table: opened.data.table,
                  running: false,
                }
              : t,
          ),
        }));
        return true;
      }
      const failed = (!opened.ok ? opened : schema) as { error: ClientError };
      const error = errorMessage(failed.error);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === targetTabId ? { ...t, running: false, error, table: null, schema: [] } : t,
        ),
      }));
      return false;
    },

    openProcedure: (procedureName) => {
      const conn = get().connections.find((c) => c.id === get().activeConnectionId);
      const sql = conn?.engine === 'mysql' ? `CALL ${procedureName}();` : `SELECT * FROM ${procedureName}();`;
      const tab = emptyTab();
      tab.title = procedureName;
      tab.sql = sql;
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id, activeView: 'query' }));
    },

    openTrigger: (triggerName) => {
      const conn = get().connections.find((c) => c.id === get().activeConnectionId);
      const sql = conn?.engine === 'mysql'
        ? `SHOW CREATE TRIGGER ${triggerName};`
        : `SELECT * FROM information_schema.triggers WHERE trigger_name = '${triggerName}';`;
      const tab = emptyTab();
      tab.title = triggerName;
      tab.sql = sql;
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id, activeView: 'query' }));
    },

    openUser: (userName) => {
      const conn = get().connections.find((c) => c.id === get().activeConnectionId);
      const sql = conn?.engine === 'mysql'
        ? `SHOW GRANTS FOR '${userName}';`
        : `SELECT * FROM pg_catalog.pg_roles WHERE rolname = '${userName}';`;
      const tab = emptyTab();
      tab.title = userName;
      tab.sql = sql;
      set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id, activeView: 'query' }));
    },

    closeTable: () => {
      const { activeTabId } = get();
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId ? { ...t, table: null, schema: [], sort: null, filters: {} } : t,
        ),
      }));
    },

    setSort: (column) => {
      const { activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!tab) return;
      const next: SortState | null =
        tab.sort?.column === column
          ? tab.sort.direction === 'asc'
            ? { column, direction: 'desc' }
            : null
          : { column, direction: 'asc' };
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === activeTabId ? { ...t, sort: next } : t)),
      }));
    },

    setFilter: (column, value) => {
      const { activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!tab) return;
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId ? { ...t, filters: { ...t.filters, [column]: value } } : t,
        ),
      }));
    },

    updateCell: async (rowIndex, column, value) => {
      const { activeConnectionId, activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!activeConnectionId || !tab?.table || !tab?.schema.length) return;
      const row = tab.rows[rowIndex];
      if (!row) return;
      const where = pkValues(row, tab.schema);
      if (where.length === 0) return;
      const col = tab.schema.find((c) => c.name === column);
      const coerced = coerceCellValue(col?.type ?? '', String(value));
      const result = await client.data.updateRow({
        connectionId: activeConnectionId,
        table: tab.table,
        where,
        changes: [{ column, value: coerced }],
      });
      if (result.ok) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  rows: t.rows.map((r, i) => (i === rowIndex ? { ...r, [column]: coerced } : r)),
                }
              : t,
          ),
        }));
      } else {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId ? { ...t, error: errorMessage(result.error) } : t,
          ),
        }));
      }
    },

    deleteRowAt: async (rowIndex) => {
      const { activeConnectionId, activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!activeConnectionId || !tab?.table || !tab?.schema.length) return;
      const row = tab.rows[rowIndex];
      if (!row) return;
      const where = pkValues(row, tab.schema);
      if (where.length === 0) return;
      const result = await client.data.deleteRow({
        connectionId: activeConnectionId,
        table: tab.table,
        where,
      });
      if (result.ok) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, rows: t.rows.filter((_, i) => i !== rowIndex) }
              : t,
          ),
        }));
      } else {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === activeTabId ? { ...t, error: errorMessage(result.error) } : t,
          ),
        }));
      }
    },

    insertRow: async (values) => {
      const { activeConnectionId, activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!activeConnectionId || !tab?.table || tab.running) return false;
      const coerced = values.map((v) => {
        const col = tab.schema.find((c) => c.name === v.column);
        return col
          ? { column: v.column, value: coerceCellValue(col.type, String(v.value)) }
          : v;
      });
      const result = await client.data.insertRow({
        connectionId: activeConnectionId,
        table: tab.table,
        values: coerced,
      });
      if (result.ok) {
        await get().openTable(tab.table);
        return true;
      }
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === activeTabId ? { ...t, error: errorMessage(result.error) } : t,
        ),
      }));
      return false;
    },

    openDesigner: async (table) => {
      const { activeConnectionId } = get();
      if (!activeConnectionId) return;
      set({ designer: { ...initialDesigner, open: true, loading: true } });
      const result = await client.designer.getTable(activeConnectionId, table);
      if (result.ok) {
        const { ddl, ...draft } = result.data;
        set({
          designer: {
            open: true,
            creating: false,
            loading: false,
            error: null,
            definition: result.data,
            draft,
            preview: ddl,
            dirty: false,
          },
        });
      } else {
        set({
          designer: {
            open: true,
            creating: false,
            loading: false,
            error: errorMessage(result.error),
            definition: null,
            draft: null,
            preview: null,
            dirty: false,
          },
        });
      }
    },

    newDesigner: () => {
      const draft: TableDraft = {
        name: '',
        schema: null,
        columns: [
          {
            name: 'id',
            type: 'INTEGER',
            nullable: false,
            default: null,
            autoIncrement: true,
            isPrimaryKey: true,
          },
        ],
        indexes: [],
        foreignKeys: [],
      };
      set({
        designer: {
          open: true,
          creating: true,
          loading: false,
          error: null,
          definition: null,
          draft,
          preview: null,
          dirty: false,
        },
      });
    },

    closeDesigner: () => set({ designer: initialDesigner }),

    updateDesignerDraft: (draft) => {
      set((s) => ({ designer: { ...s.designer, draft, dirty: true } }));
    },

    previewDesignerDdl: async () => {
      const { activeConnectionId } = get();
      const draft = get().designer.draft;
      if (!activeConnectionId || !draft) return;
      const result = await client.designer.previewDdl({ connectionId: activeConnectionId, draft });
      if (result.ok) {
        set((s) => ({ designer: { ...s.designer, preview: result.data } }));
      } else {
        set((s) => ({ designer: { ...s.designer, error: errorMessage(result.error) } }));
      }
    },

    applyDesigner: async () => {
      const { activeConnectionId } = get();
      const draft = get().designer.draft;
      if (!activeConnectionId || !draft) return false;
      const result = await client.designer.apply({ connectionId: activeConnectionId, draft });
      if (result.ok) {
        set((s) => ({ designer: { ...s.designer, open: false } }));
        await get().refreshBrowser();
        return true;
      }
      set((s) => ({ designer: { ...s.designer, error: errorMessage(result.error) } }));
      return false;
    },

    dropDesignerTable: async () => {
      const { activeConnectionId } = get();
      const definition = get().designer.definition;
      if (!activeConnectionId || !definition) return false;
      const result = await client.designer.drop(activeConnectionId, definition.name);
      if (result.ok) {
        set((s) => ({ designer: { ...s.designer, open: false } }));
        await get().refreshBrowser();
        return true;
      }
      set((s) => ({ designer: { ...s.designer, error: errorMessage(result.error) } }));
      return false;
    },

    openErd: async () => {
      const { activeConnectionId } = get();
      if (!activeConnectionId) return;
      set({ erd: { ...initialErd, open: true, loading: true } });
      const result = await client.erd.generate(activeConnectionId);
      if (result.ok) {
        set({
          erd: { open: true, loading: false, error: null, graph: result.data, focusTable: null },
        });
      } else {
        set({
          erd: { open: true, loading: false, error: errorMessage(result.error), graph: null, focusTable: null },
        });
      }
    },

    closeErd: () => set({ erd: initialErd }),

    setErdFocus: (table) => {
      set((s) => ({ erd: { ...s.erd, focusTable: table } }));
    },

    exportErdImage: async (dataUrl, defaultName) => {
      const result = await client.erd.exportImage({ dataUrl, defaultName });
      if (result.ok) {
        set((s) => ({ erd: { ...s.erd, error: result.data.saved ? null : s.erd.error } }));
        return result.data.saved;
      }
      set((s) => ({ erd: { ...s.erd, error: errorMessage(result.error) } }));
      return false;
    },

    transfer: initialTransfer,

    exportTable: async (format) => {
      const { activeConnectionId, activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!activeConnectionId || !tab?.table) return false;
      set((s) => ({
        transfer: { ...s.transfer, active: true, direction: 'export', format, processed: 0, total: null, error: null },
      }));
      const result = await client.transfer.export({
        connectionId: activeConnectionId,
        table: tab.table,
        columns: tab.schema.map((c) => c.name),
        format,
      });
      if (result.ok) {
        set((s) => ({ transfer: { ...s.transfer, active: false, processed: result.data.rows } }));
        return true;
      }
      set((s) => ({ transfer: { ...s.transfer, active: false, error: errorMessage(result.error) } }));
      return false;
    },

    importData: async (format, mode = 'insert') => {
      const { activeConnectionId, activeTabId } = get();
      const tab = get().tabs.find((t) => t.id === activeTabId);
      if (!activeConnectionId) return false;
      set((s) => ({
        transfer: { ...s.transfer, active: true, direction: 'import', format, processed: 0, total: null, error: null },
      }));
      const result = await client.transfer.import({
        connectionId: activeConnectionId,
        format,
        mode,
        batchSize: 1000,
        ...(tab?.table ? { table: tab.table } : {}),
      });
      if (result.ok) {
        set((s) => ({ transfer: { ...s.transfer, active: false, processed: result.data.rows } }));
        await get().refreshBrowser();
        return true;
      }
      set((s) => ({ transfer: { ...s.transfer, active: false, error: errorMessage(result.error) } }));
      return false;
    },

    backupDatabase: async (format) => {
      const { activeConnectionId } = get();
      const conn = get().connections.find((c) => c.id === activeConnectionId);
      const databaseName = conn?.database || 'main';
      if (!activeConnectionId) return false;
      set((s) => ({
        transfer: { ...s.transfer, active: true, direction: 'export', format: format === 'txt' ? 'csv' : format, processed: 0, total: null, error: null },
      }));
      const result = await client.transfer.backupDatabase({
        connectionId: activeConnectionId,
        format,
        databaseName,
      });
      if (result.ok) {
        set((s) => ({ transfer: { ...s.transfer, active: false, processed: result.data.rows } }));
        return true;
      }
      set((s) => ({ transfer: { ...s.transfer, active: false, error: errorMessage(result.error) } }));
      return false;
    },

    backupTable: async (table, format) => {
      const { activeConnectionId } = get();
      if (!activeConnectionId) return false;
      set((s) => ({
        transfer: { ...s.transfer, active: true, direction: 'export', format: format === 'txt' ? 'csv' : format, processed: 0, total: null, error: null },
      }));
      const schemaResult = await client.data.getSchema({ connectionId: activeConnectionId, table });
      if (!schemaResult.ok) {
        set((s) => ({ transfer: { ...s.transfer, active: false, error: errorMessage(schemaResult.error) } }));
        return false;
      }
      const result = await client.transfer.export({
        connectionId: activeConnectionId,
        format: format === 'txt' ? 'txt' : format,
        table,
        columns: schemaResult.data.columns.map((c) => c.name),
      });
      if (result.ok) {
        set((s) => ({ transfer: { ...s.transfer, active: false, processed: result.data.rows } }));
        return true;
      }
      set((s) => ({ transfer: { ...s.transfer, active: false, error: errorMessage(result.error) } }));
      return false;
    },

    restoreDatabase: async (format) => {
      const { activeConnectionId } = get();
      if (!activeConnectionId) return false;
      set((s) => ({
        transfer: { ...s.transfer, active: true, direction: 'import', format: format === 'txt' ? 'csv' : format, processed: 0, total: null, error: null },
      }));
      const result = await client.transfer.restore({
        connectionId: activeConnectionId,
        format,
      });
      if (result.ok) {
        set((s) => ({ transfer: { ...s.transfer, active: false, processed: result.data.rows } }));
        await get().refreshBrowser();
        return true;
      }
      set((s) => ({ transfer: { ...s.transfer, active: false, error: errorMessage(result.error) } }));
      return false;
    },

    restoreTable: async (table, format) => {
      const { activeConnectionId } = get();
      if (!activeConnectionId) return false;
      set((s) => ({
        transfer: { ...s.transfer, active: true, direction: 'import', format: format === 'txt' ? 'csv' : format, processed: 0, total: null, error: null },
      }));
      const result = await client.transfer.restore({
        connectionId: activeConnectionId,
        table,
        format,
      });
      if (result.ok) {
        set((s) => ({ transfer: { ...s.transfer, active: false, processed: result.data.rows } }));
        await get().refreshBrowser();
        return true;
      }
      set((s) => ({ transfer: { ...s.transfer, active: false, error: errorMessage(result.error) } }));
      return false;
    },
  }));
  return appStore;
};

function firstLine(sql: string): string {
  const line = sql.split('\n')[0]?.trim() ?? '';
  return line.length > 24 ? `${line.slice(0, 24)}…` : line;
}

export type AppStore = ReturnType<typeof createAppStore>;
