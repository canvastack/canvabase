import { useState, type JSX, type MouseEvent } from 'react';
import type { AppStore } from '../store';
import type { ConnectionSummary, ObjectNode, TableColumn } from '@canvabase/contracts';

interface UnifiedSidebarTreeProps {
  store: AppStore;
  onOpenNewConnection: () => void;
  onEditConnection: (conn: ConnectionSummary) => void;
}

export function UnifiedSidebarTree({
  store,
  onOpenNewConnection,
  onEditConnection,
}: UnifiedSidebarTreeProps): JSX.Element {
  const connections = store((s) => s.connections);
  const activeConnectionId = store((s) => s.activeConnectionId);
  const tabs = store((s) => s.tabs);
  const activeTabId = store((s) => s.activeTabId);
  const browser = store((s) => s.browser);
  const connect = store((s) => s.connect);
  const selectedTable = store((s) => s.selectedTable);
  const disconnect = store((s) => s.disconnect);
  const deleteConnection = store((s) => s.deleteConnection);
  const selectDatabase = store((s) => s.selectDatabase);
  const openTable = store((s) => s.openTable);
  const openDesigner = store((s) => s.openDesigner);
  const openErd = store((s) => s.openErd);
  const setActiveView = store((s) => s.setActiveView);
  const refreshBrowser = store((s) => s.refreshBrowser);

  const openProcedure = store((s) => s.openProcedure);
  const openTrigger = store((s) => s.openTrigger);
  const toggleLeftSidebar = store((s) => s.toggleLeftSidebar);
  const setSql = store((s) => s.setSql);
  const setSelectedTable = store((s) => s.setSelectedTable);
  const setSelectedTarget = store((s) => s.setSelectedTarget);
  const setDesignerSection = store((s) => s.setDesignerSection);
  const backupDatabase = store((s) => s.backupDatabase);
  const backupTable = store((s) => s.backupTable);
  const restoreDatabase = store((s) => s.restoreDatabase);
  const restoreTable = store((s) => s.restoreTable);

  // Expanded nodes state
  const [expandedConns, setExpandedConns] = useState<Record<string, boolean>>({});
  const [expandedDbs, setExpandedDbs] = useState<Record<string, boolean>>({});
  const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({
    public: true,
    main: true,
    dbo: true,
    default: true,
  });
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});
  const [expandedSubfolders, setExpandedSubfolders] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    tables: true,
    views: false,
    procedures: false,
    triggers: false,
  });

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connErrors, setConnErrors] = useState<Record<string, string | null>>({});
  const [activeDbName, setActiveDbName] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [contextMenu, setContextMenu] = useState<
    | { x: number; y: number; type: 'connection'; target: ConnectionSummary }
    | { x: number; y: number; type: 'database' | 'table' | 'view' | 'procedure' | 'trigger' | 'user'; target: string }
    | null
  >(null);

  // Toggle connection expansion & auto-connect
  const handleToggleConn = async (conn: ConnectionSummary) => {
    const isExpanded = !!expandedConns[conn.id];
    if (!isExpanded) {
      setExpandedConns((prev) => ({ ...prev, [conn.id]: true }));
      if (activeConnectionId !== conn.id) {
        setConnectingId(conn.id);
        setConnErrors((prev) => ({ ...prev, [conn.id]: null }));
        const res = await connect(conn.id);
        setConnectingId(null);
        if (!res.ok) {
          setConnErrors((prev) => ({
            ...prev,
            [conn.id]: res.error || 'Failed to connect. Please check host, port & server status.',
          }));
        } else {
          // Auto expand default db if present
          const dbName = conn.database || 'main';
          setExpandedDbs((prev) => ({ ...prev, [dbName]: true }));
        }
      }
    } else {
      setExpandedConns((prev) => ({ ...prev, [conn.id]: false }));
    }
  };

  const handleToggleDb = async (dbName: string) => {
    const isExpanded = !!expandedDbs[dbName];
    if (!isExpanded) {
      const ok = await selectDatabase(dbName);
      if (ok) {
        setActiveDbName(dbName);
        setExpandedDbs((prev) => ({ ...prev, [dbName]: true }));
        setActiveView('database');
      }
    } else {
      setExpandedDbs((prev) => ({ ...prev, [dbName]: false }));
    }
  };

  const handleTableDoubleClick = (tableName: string) => {
    void openTable(tableName);
    setSql(`SELECT * FROM ${tableName} LIMIT 500;`);
    setActiveView('query');
  };

  const handleViewClick = (viewName: string) => {
    void openTable(viewName);
    setActiveView('query');
  };

  const handleProcedureClick = (procedureName: string) => {
    openProcedure(procedureName);
    setActiveView('query');
  };

  const handleTriggerClick = (triggerName: string) => {
    openTrigger(triggerName);
    setActiveView('query');
  };

  const handleDeleteConn = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete connection "${name}"?`)) {
      await deleteConnection(id);
    }
  };

  // Context Menu handlers
  const openConnContextMenu = (e: MouseEvent, conn: ConnectionSummary) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'connection', target: conn });
  };

  const openDbContextMenu = (e: MouseEvent, dbName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'database', target: dbName });
  };

  const openObjectContextMenu = (
    e: MouseEvent,
    type: 'table' | 'view' | 'procedure' | 'trigger' | 'user',
    name: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, target: name });
  };

  // Filter nodes
  const filterNodes = (nodes: ObjectNode[]) => {
    if (!filterText.trim()) return nodes;
    const lower = filterText.toLowerCase();
    return nodes.filter((n) => n.name.toLowerCase().includes(lower));
  };

  const filteredTables = filterNodes(browser.tables);
  const filteredViews = filterNodes(browser.views);
  const filteredProcedures = filterNodes(browser.procedures);
  const filteredTriggers = filterNodes(browser.triggers);
  const filteredDatabases = filterNodes(browser.databases);

  return (
    <div className="unified-sidebar-tree" onClick={() => setContextMenu(null)}>
      {/* Sidebar Header */}
      <div className="sidebar-tree-header">
        <div className="sidebar-header-row">
          <span className="sidebar-title">
            <svg className="cb-icon-svg" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
            CONNECTIONS
          </span>
          <div className="sidebar-header-actions">
            <button
              className="cb-icon-button cb-btn-add-conn"
              onClick={onOpenNewConnection}
              title="Add New Connection"
            >
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button
              className="cb-icon-button cb-btn-collapse-sidebar"
              onClick={toggleLeftSidebar}
              title="Collapse Left Sidebar"
            >
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
          </div>
        </div>

        <div className="sidebar-search-row">
          <input
            className="cb-input cb-input-sm"
            placeholder="🔍 Search tables, databases..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      {/* Main Hierarchical Tree View */}
      <div className="tree-scroll-area">
        {connections.length === 0 ? (
          <div className="empty-hint-card">
            <p>No connections configured</p>
            <button className="cb-button cb-button-primary cb-btn-sm" onClick={onOpenNewConnection}>
              + Create Connection
            </button>
          </div>
        ) : (
          connections.map((conn) => {
            const isConnected = conn.id === activeConnectionId;
            const isConnExpanded = !!expandedConns[conn.id];
            const isConnecting = connectingId === conn.id;
            const connError = connErrors[conn.id];

            return (
              <div key={conn.id} className="tree-conn-node">
                {/* Level 1: Connection Node */}
                <div
                  className={`tree-node-row conn-node-row ${isConnected ? 'active' : ''}`}
                  onClick={() => void handleToggleConn(conn)}
                  onContextMenu={(e) => openConnContextMenu(e, conn)}
                >
                  <span className={`tree-caret ${isConnExpanded ? 'open' : ''}`}>▶</span>
                  <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
                  <span className="conn-node-name">{conn.name}</span>
                  <span className="engine-tag">{conn.engine}</span>
                </div>

                {/* Level 2: Databases under Connection */}
                {isConnExpanded && (
                  <div className="tree-children conn-children">
                    {isConnecting ? (
                      <div className="tree-loading">Connecting to server...</div>
                    ) : connError ? (
                      <div className="cb-alert cb-alert-error m-2">{connError}</div>
                    ) : !isConnected ? (
                      <div className="tree-loading">Click connection to connect</div>
                    ) : browser.loading && browser.databases.length === 0 ? (
                      <div className="tree-loading">Fetching databases...</div>
                    ) : (
                      <>
                        {/* List Databases */}
                        {(filteredDatabases.length > 0
                          ? filteredDatabases
                          : [{ id: 'default', type: 'database', name: conn.database || 'main' } as ObjectNode]
                        ).map((db) => {
                          const isDbExpanded = !!expandedDbs[db.name];
                          const isActiveDb =
                            activeDbName === db.name || (!activeDbName && (db.name === conn.database || db.name === 'main'));

                          return (
                            <div key={db.id || db.name} className="tree-db-node">
                              {/* Database Row */}
                              <div
                                className={`tree-node-row db-node-row ${isActiveDb ? 'active-db' : ''}`}
                                onClick={() => void handleToggleDb(db.name)}
                                onContextMenu={(e) => openDbContextMenu(e, db.name)}
                              >
                                <span className={`tree-caret ${isDbExpanded ? 'open' : ''}`}>▶</span>
                                <span className="tree-node-icon">🗄️</span>
                                <span className="db-node-name">{db.name}</span>
                                {isActiveDb && <span className="active-badge">Active</span>}
                              </div>

                              {/* Level 3: Objects under Active Expanded Database */}
                              {isDbExpanded && isActiveDb && (
                                <div className="tree-children db-children">
                                  {/* Level 3.1: Schema Node (e.g. public, main, dbo) */}
                                  {(() => {
                                    const defaultSchemaName = conn.engine === 'sqlite' ? 'main' : conn.engine === 'postgresql' ? 'public' : 'dbo';
                                    const isSchemaExpanded = !!expandedSchemas[defaultSchemaName];
                                    const activeTab = tabs.find((t) => t.id === activeTabId);

                                    return (
                                      <div className="tree-schema-node">
                                        <div
                                          className="tree-node-row schema-node-row"
                                          onClick={() => {
                                            setExpandedSchemas((s) => ({
                                              ...s,
                                              [defaultSchemaName]: !s[defaultSchemaName],
                                            }));
                                            setSelectedTarget({ type: 'schema', name: defaultSchemaName });
                                          }}
                                        >
                                          <span className={`tree-caret ${isSchemaExpanded ? 'open' : ''}`}>
                                            ▶
                                          </span>
                                          <span className="tree-node-icon">📂</span>
                                          <span className="schema-node-name">
                                            Schema: <span className="highlight-schema">{defaultSchemaName}</span>
                                          </span>
                                          <span className="tree-badge">{filteredTables.length} tables</span>
                                        </div>

                                        {isSchemaExpanded && (
                                          <div className="tree-children schema-children">
                                            {/* Tables Group */}
                                            <div className="tree-group-node">
                                              <div
                                                className="tree-node-row group-node-row"
                                                onClick={() => {
                                                  setExpandedGroups((g) => ({ ...g, tables: !g.tables }));
                                                  setActiveView('database');
                                                  setSelectedTarget({ type: 'schema', name: 'Tables' });
                                                }}
                                              >
                                                <span className={`tree-caret ${expandedGroups.tables ? 'open' : ''}`}>
                                                  ▶
                                                </span>
                                                <span className="tree-node-icon">📑</span>
                                                <span className="group-label">Tables</span>
                                                <span className="tree-badge">{filteredTables.length}</span>
                                              </div>

                                              {expandedGroups.tables && (
                                                <div className="tree-children group-children">
                                                  {filteredTables.length === 0 ? (
                                                    <div className="tree-empty">No tables found</div>
                                                  ) : (
                                                    filteredTables.map((t) => {
                                                      const isSelectedTable = selectedTable === t.name;
                                                      const isTableExpanded = !!expandedTables[t.name];

                                                      // Table subfolder expansion helper
                                                      const toggleSubfolder = (sub: string) => {
                                                        const key = `${t.name}_${sub}`;
                                                        setExpandedSubfolders((prev) => ({
                                                          ...prev,
                                                          [key]: !prev[key],
                                                        }));
                                                      };

                                                      const isSubExpanded = (sub: string) =>
                                                        !!expandedSubfolders[`${t.name}_${sub}`];

                                                      const currentSchema =
                                                        activeTab?.table === t.name && activeTab.schema.length > 0
                                                          ? activeTab.schema
                                                          : null;

                                                      return (
                                                        <div key={t.id} className="tree-table-wrapper">
                                                          {/* Table Node */}
                                                          <div
                                                            className={`tree-node-row object-node-row table-node-row ${isSelectedTable ? 'selected-table' : ''}`}
                                                            onClick={() => {
                                                              setSelectedTable(t.name);
                                                              setSelectedTarget({
                                                                type: 'table',
                                                                name: t.name,
                                                                metadata: t as unknown as Record<string, unknown>,
                                                              });
                                                            }}
                                                            onDoubleClick={() => handleTableDoubleClick(t.name)}
                                                            onContextMenu={(e) => openObjectContextMenu(e, 'table', t.name)}
                                                            title="Click to select | Double-click to View Data | Right-click options"
                                                          >
                                                            <span
                                                              className={`tree-caret ${isTableExpanded ? 'open' : ''}`}
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedTables((prev) => ({
                                                                  ...prev,
                                                                  [t.name]: !prev[t.name],
                                                                }));
                                                              }}
                                                            >
                                                              ▶
                                                            </span>
                                                            <span className="tree-node-icon">📋</span>
                                                            <span className="object-name font-medium">{t.name}</span>
                                                          </div>

                                                          {/* Collapsible Subfolders under Table */}
                                                          {isTableExpanded && (
                                                            <div className="tree-children table-subfolders">
                                                              {/* 1. Fields Subfolder */}
                                                              <div className="tree-subfolder-node">
                                                                <div
                                                                  className="tree-node-row subfolder-row"
                                                                  onClick={() => {
                                                                    toggleSubfolder('fields');
                                                                    setSelectedTable(t.name);
                                                                    void openDesigner(t.name);
                                                                    setDesignerSection('columns');
                                                                    setActiveView('designer');
                                                                    setSelectedTarget({
                                                                      type: 'table',
                                                                      name: t.name,
                                                                      metadata: t as unknown as Record<string, unknown>,
                                                                    });
                                                                  }}
                                                                >
                                                                  <span className={`tree-caret ${isSubExpanded('fields') ? 'open' : ''}`}>▶</span>
                                                                  <span className="subfolder-icon">📁</span>
                                                                  <span className="subfolder-label">Fields</span>
                                                                  {currentSchema && (
                                                                    <span className="tree-badge-sm">{currentSchema.length}</span>
                                                                  )}
                                                                </div>
                                                                {isSubExpanded('fields') && (
                                                                  <div className="tree-children subfolder-children">
                                                                    {currentSchema ? (
                                                                      currentSchema.map((col: TableColumn) => (
                                                                        <div
                                                                          key={col.name}
                                                                          className="tree-node-row field-node-row"
                                                                          onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedTable(t.name);
                                                                            void openDesigner(t.name);
                                                                            setDesignerSection('columns');
                                                                            setActiveView('designer');
                                                                            setSelectedTarget({
                                                                              type: 'field',
                                                                              name: col.name,
                                                                              parentTable: t.name,
                                                                              metadata: col as unknown as Record<string, unknown>,
                                                                            });
                                                                          }}
                                                                        >
                                                                          <span className="field-icon">
                                                                            {col.primaryKey ? '🔑' : '🏷️'}
                                                                          </span>
                                                                          <span className="field-name">{col.name}</span>
                                                                          <span className="field-type-tag">{col.type}</span>
                                                                        </div>
                                                                      ))
                                                                    ) : (
                                                                      <div
                                                                        className="tree-node-row field-node-row text-muted"
                                                                        onClick={(e) => {
                                                                          e.stopPropagation();
                                                                          setSelectedTable(t.name);
                                                                          void openDesigner(t.name);
                                                                          setDesignerSection('columns');
                                                                          setActiveView('designer');
                                                                          setSelectedTarget({
                                                                            type: 'field',
                                                                            name: 'id',
                                                                            parentTable: t.name,
                                                                            metadata: { name: 'id', type: 'INTEGER', primaryKey: true },
                                                                          });
                                                                        }}
                                                                      >
                                                                        <span className="field-icon">🔑</span>
                                                                        <span className="field-name">id</span>
                                                                        <span className="field-type-tag">INTEGER (PK)</span>
                                                                      </div>
                                                                    )}
                                                                  </div>
                                                                )}
                                                              </div>

                                                              {/* 2. Indexes Subfolder */}
                                                              <div className="tree-subfolder-node">
                                                                <div
                                                                  className="tree-node-row subfolder-row"
                                                                  onClick={() => {
                                                                    toggleSubfolder('indexes');
                                                                    setSelectedTable(t.name);
                                                                    void openDesigner(t.name);
                                                                    setDesignerSection('indexes');
                                                                    setActiveView('designer');
                                                                    setSelectedTarget({
                                                                      type: 'table',
                                                                      name: t.name,
                                                                      metadata: t as unknown as Record<string, unknown>,
                                                                    });
                                                                  }}
                                                                >
                                                                  <span className={`tree-caret ${isSubExpanded('indexes') ? 'open' : ''}`}>▶</span>
                                                                  <span className="subfolder-icon">⚡</span>
                                                                  <span className="subfolder-label">Indexes</span>
                                                                </div>
                                                                {isSubExpanded('indexes') && (
                                                                  <div className="tree-children subfolder-children">
                                                                    <div
                                                                      className="tree-node-row index-node-row"
                                                                      onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedTable(t.name);
                                                                        void openDesigner(t.name);
                                                                        setDesignerSection('indexes');
                                                                        setActiveView('designer');
                                                                        setSelectedTarget({
                                                                          type: 'index',
                                                                          name: `pk_${t.name}`,
                                                                          parentTable: t.name,
                                                                          metadata: { name: `pk_${t.name}`, unique: true, columns: ['PRIMARY'] },
                                                                        });
                                                                      }}
                                                                    >
                                                                      <span className="node-sub-icon">📌</span>
                                                                      <span>{`pk_${t.name}`} (PRIMARY)</span>
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </div>

                                                              {/* 3. Foreign Keys Subfolder */}
                                                              <div className="tree-subfolder-node">
                                                                <div
                                                                  className="tree-node-row subfolder-row"
                                                                  onClick={() => {
                                                                    toggleSubfolder('fk');
                                                                    setSelectedTable(t.name);
                                                                    void openDesigner(t.name);
                                                                    setDesignerSection('foreignKeys');
                                                                    setActiveView('designer');
                                                                    setSelectedTarget({
                                                                      type: 'table',
                                                                      name: t.name,
                                                                      metadata: t as unknown as Record<string, unknown>,
                                                                    });
                                                                  }}
                                                                >
                                                                  <span className={`tree-caret ${isSubExpanded('fk') ? 'open' : ''}`}>▶</span>
                                                                  <span className="subfolder-icon">🔗</span>
                                                                  <span className="subfolder-label">Foreign Keys</span>
                                                                </div>
                                                                {isSubExpanded('fk') && (
                                                                  <div className="tree-children subfolder-children">
                                                                    <div className="tree-node-row fk-node-row text-muted">
                                                                      <span>(No foreign keys defined)</span>
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </div>

                                                              {/* 4. Uniques Subfolder */}
                                                              <div className="tree-subfolder-node">
                                                                <div
                                                                  className="tree-node-row subfolder-row"
                                                                  onClick={() => toggleSubfolder('uniques')}
                                                                >
                                                                  <span className={`tree-caret ${isSubExpanded('uniques') ? 'open' : ''}`}>▶</span>
                                                                  <span className="subfolder-icon">🔒</span>
                                                                  <span className="subfolder-label">Uniques</span>
                                                                </div>
                                                                {isSubExpanded('uniques') && (
                                                                  <div className="tree-children subfolder-children">
                                                                    <div className="tree-node-row unique-node-row text-muted">
                                                                      <span>(No unique constraints)</span>
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </div>

                                                              {/* 5. Checks Subfolder */}
                                                              <div className="tree-subfolder-node">
                                                                <div
                                                                  className="tree-node-row subfolder-row"
                                                                  onClick={() => toggleSubfolder('checks')}
                                                                >
                                                                  <span className={`tree-caret ${isSubExpanded('checks') ? 'open' : ''}`}>▶</span>
                                                                  <span className="subfolder-icon">🛡️</span>
                                                                  <span className="subfolder-label">Checks</span>
                                                                </div>
                                                                {isSubExpanded('checks') && (
                                                                  <div className="tree-children subfolder-children">
                                                                    <div className="tree-node-row check-node-row text-muted">
                                                                      <span>(No check constraints)</span>
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </div>

                                                              {/* 6. Triggers Subfolder */}
                                                              <div className="tree-subfolder-node">
                                                                <div
                                                                  className="tree-node-row subfolder-row"
                                                                  onClick={() => toggleSubfolder('triggers')}
                                                                >
                                                                  <span className={`tree-caret ${isSubExpanded('triggers') ? 'open' : ''}`}>▶</span>
                                                                  <span className="subfolder-icon">⚡</span>
                                                                  <span className="subfolder-label">Triggers</span>
                                                                </div>
                                                                {isSubExpanded('triggers') && (
                                                                  <div className="tree-children subfolder-children">
                                                                    <div className="tree-node-row trigger-node-row text-muted">
                                                                      <span>(No triggers attached)</span>
                                                                    </div>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Views Group */}
                                  {browser.capabilities?.views !== false && (
                                    <div className="tree-group-node">
                                      <div
                                        className="tree-node-row group-node-row"
                                        onClick={() =>
                                          setExpandedGroups((g) => ({ ...g, views: !g.views }))
                                        }
                                      >
                                        <span className={`tree-caret ${expandedGroups.views ? 'open' : ''}`}>
                                          ▶
                                        </span>
                                        <span className="tree-node-icon">👁️</span>
                                        <span className="group-label">Views</span>
                                        <span className="tree-badge">{filteredViews.length}</span>
                                      </div>

                                      {expandedGroups.views && (
                                        <div className="tree-children group-children">
                                          {filteredViews.length === 0 ? (
                                            <div className="tree-empty">No views found</div>
                                          ) : (
                                            filteredViews.map((v) => (
                                              <div
                                                key={v.id}
                                                className="tree-node-row object-node-row"
                                                onClick={() => handleViewClick(v.name)}
                                                onDoubleClick={() => handleViewClick(v.name)}
                                                onContextMenu={(e) => openObjectContextMenu(e, 'view', v.name)}
                                                title="Click/Double-click to View Data | Right-click options"
                                              >
                                                <span className="tree-node-icon">👁️</span>
                                                <span className="object-name">{v.name}</span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Procedures Group */}
                                  {browser.capabilities?.procedures !== false && (
                                    <div className="tree-group-node">
                                      <div
                                        className="tree-node-row group-node-row"
                                        onClick={() =>
                                          setExpandedGroups((g) => ({
                                            ...g,
                                            procedures: !g.procedures,
                                          }))
                                        }
                                      >
                                        <span
                                          className={`tree-caret ${
                                            expandedGroups.procedures ? 'open' : ''
                                          }`}
                                        >
                                          ▶
                                        </span>
                                        <span className="tree-node-icon">⚡</span>
                                        <span className="group-label">Procedures / Functions</span>
                                        <span className="tree-badge">{filteredProcedures.length}</span>
                                      </div>

                                      {expandedGroups.procedures && (
                                        <div className="tree-children group-children">
                                          {filteredProcedures.length === 0 ? (
                                            <div className="tree-empty">No procedures found</div>
                                          ) : (
                                            filteredProcedures.map((p) => (
                                              <div
                                                key={p.id}
                                                className="tree-node-row object-node-row"
                                                onClick={() => handleProcedureClick(p.name)}
                                                onDoubleClick={() => handleProcedureClick(p.name)}
                                                onContextMenu={(e) => openObjectContextMenu(e, 'procedure', p.name)}
                                                title="Click/Double-click to Execute | Right-click options"
                                              >
                                                <span className="tree-node-icon">⚡</span>
                                                <span className="object-name">{p.name}</span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Triggers Group */}
                                  {browser.capabilities?.triggers !== false && (
                                    <div className="tree-group-node">
                                      <div
                                        className="tree-node-row group-node-row"
                                        onClick={() =>
                                          setExpandedGroups((g) => ({ ...g, triggers: !g.triggers }))
                                        }
                                      >
                                        <span
                                          className={`tree-caret ${expandedGroups.triggers ? 'open' : ''}`}
                                        >
                                          ▶
                                        </span>
                                        <span className="tree-node-icon">🔔</span>
                                        <span className="group-label">Triggers</span>
                                        <span className="tree-badge">{filteredTriggers.length}</span>
                                      </div>

                                      {expandedGroups.triggers && (
                                        <div className="tree-children group-children">
                                          {filteredTriggers.length === 0 ? (
                                            <div className="tree-empty">No triggers found</div>
                                          ) : (
                                            filteredTriggers.map((tr) => (
                                              <div
                                                key={tr.id}
                                                className="tree-node-row object-node-row"
                                                onClick={() => handleTriggerClick(tr.name)}
                                                onDoubleClick={() => handleTriggerClick(tr.name)}
                                                onContextMenu={(e) => openObjectContextMenu(e, 'trigger', tr.name)}
                                                title="Click/Double-click to View DDL | Right-click options"
                                              >
                                                <span className="tree-node-icon">🔔</span>
                                                <span className="object-name">{tr.name}</span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Context Menus */}
      {contextMenu && (
        <div
          className="cb-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'connection' && (
            <>
              <button
                className="cb-context-item"
                onClick={() => {
                  if (activeConnectionId === contextMenu.target.id) {
                    void disconnect(contextMenu.target.id);
                  } else {
                    void connect(contextMenu.target.id);
                  }
                  setContextMenu(null);
                }}
              >
                {activeConnectionId === contextMenu.target.id ? '🔌 Disconnect Server' : '🔌 Connect / Open Server'}
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  onEditConnection(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                ✏️ Edit Connection Settings
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void refreshBrowser();
                  setContextMenu(null);
                }}
              >
                🔄 Refresh Databases
              </button>
              <button
                className="cb-context-item cb-context-danger"
                onClick={() => {
                  void handleDeleteConn(contextMenu.target.id, contextMenu.target.name);
                  setContextMenu(null);
                }}
              >
                🗑️ Delete Connection
              </button>
            </>
          )}

          {contextMenu.type === 'database' && (
            <>
              <button
                className="cb-context-item"
                onClick={() => {
                  void handleToggleDb(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                🗄️ Open & Set Active Database
              </button>
              <div className="cb-context-divider" />
              <div className="cb-context-header">📦 Backup Database</div>
              <button
                className="cb-context-item"
                onClick={() => {
                  void backupDatabase('sql');
                  setContextMenu(null);
                }}
              >
                📥 Backup to SQL Dump
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void backupDatabase('csv');
                  setContextMenu(null);
                }}
              >
                📥 Backup to CSV Files
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void backupDatabase('txt');
                  setContextMenu(null);
                }}
              >
                📥 Backup to TXT Files
              </button>
              <div className="cb-context-divider" />
              <div className="cb-context-header">📦 Restore Database</div>
              <button
                className="cb-context-item"
                onClick={() => {
                  void restoreDatabase('sql');
                  setContextMenu(null);
                }}
              >
                📤 Restore from SQL Dump
              </button>
            </>
          )}

          {contextMenu.type === 'table' && (
            <>
              <button
                className="cb-context-item"
                onClick={() => {
                  void openTable(contextMenu.target);
                  setActiveView('query');
                  setContextMenu(null);
                }}
              >
                📊 View Table Data Grid
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void openDesigner(contextMenu.target);
                  setActiveView('designer');
                  setContextMenu(null);
                }}
              >
                📑 Design Table Structure
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void openErd();
                  setActiveView('erd');
                  setContextMenu(null);
                }}
              >
                🎨 View in ERD Canvas
              </button>
              <div className="cb-context-divider" />
              <div className="cb-context-header">📦 Backup Table</div>
              <button
                className="cb-context-item"
                onClick={() => {
                  void backupTable(contextMenu.target, 'sql');
                  setContextMenu(null);
                }}
              >
                📥 Backup to SQL
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void backupTable(contextMenu.target, 'csv');
                  setContextMenu(null);
                }}
              >
                📥 Backup to CSV
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void backupTable(contextMenu.target, 'txt');
                  setContextMenu(null);
                }}
              >
                📥 Backup to TXT
              </button>
              <div className="cb-context-divider" />
              <div className="cb-context-header">📦 Restore Table</div>
              <button
                className="cb-context-item"
                onClick={() => {
                  void restoreTable(contextMenu.target, 'sql');
                  setContextMenu(null);
                }}
              >
                📤 Restore from SQL
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void restoreTable(contextMenu.target, 'csv');
                  setContextMenu(null);
                }}
              >
                📤 Restore from CSV
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void restoreTable(contextMenu.target, 'txt');
                  setContextMenu(null);
                }}
              >
                📤 Restore from TXT
              </button>
            </>
          )}

          {contextMenu.type === 'view' && (
            <>
              <button
                className="cb-context-item"
                onClick={() => {
                  handleViewClick(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                👁️ View Data Grid
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void navigator.clipboard.writeText(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                📋 Copy View Name
              </button>
            </>
          )}

          {contextMenu.type === 'procedure' && (
            <>
              <button
                className="cb-context-item"
                onClick={() => {
                  handleProcedureClick(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                ⚡ Execute / Call Routine
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void navigator.clipboard.writeText(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                📋 Copy Procedure Name
              </button>
            </>
          )}

          {contextMenu.type === 'trigger' && (
            <>
              <button
                className="cb-context-item"
                onClick={() => {
                  handleTriggerClick(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                🔔 View Trigger DDL / Info
              </button>
              <button
                className="cb-context-item"
                onClick={() => {
                  void navigator.clipboard.writeText(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                📋 Copy Trigger Name
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
