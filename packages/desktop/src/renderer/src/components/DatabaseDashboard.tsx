import { useMemo, useState, type JSX, type MouseEvent } from 'react';
import type { AppStore } from '../store';
import type { ObjectNode } from '@canvabase/contracts';

interface DatabaseDashboardProps {
  store: AppStore;
}

type SortField = 'name' | 'engine' | 'rows' | 'columns' | 'indexes' | 'foreignKeys' | 'sizeBytes' | 'updatedAt';

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export function DatabaseDashboard({ store }: DatabaseDashboardProps): JSX.Element {
  const browser = store((s) => s.browser);
  const activeConnectionId = store((s) => s.activeConnectionId);
  const connections = store((s) => s.connections);
  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const openTable = store((s) => s.openTable);
  const openDesigner = store((s) => s.openDesigner);
  const setDesignerSection = store((s) => s.setDesignerSection);
  const setActiveView = store((s) => s.setActiveView);
  const setSelectedTarget = store((s) => s.setSelectedTarget);
  
  const backupDatabase = store((s) => s.backupDatabase);
  const backupTable = store((s) => s.backupTable);
  const restoreDatabase = store((s) => s.restoreDatabase);
  const restoreTable = store((s) => s.restoreTable);
  const setSql = store((s) => s.setSql);
  const selectedTable = store((s) => s.selectedTable);
  const setSelectedTable = store((s) => s.setSelectedTable);

  const objectViewMode = store((s) => s.objectViewMode);
  const setObjectViewMode = store((s) => s.setObjectViewMode);

  const [activeTab, setActiveTab] = useState<'tables' | 'views' | 'procedures' | 'triggers'>('tables');
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'database' | 'table' | 'view';
    target: string;
  } | null>(null);

  const dbName = activeConnection?.database || 'main';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filterAndSortList = <T extends ObjectNode>(items: T[]): T[] => {
    let filtered = items;
    if (filterText.trim()) {
      const lower = filterText.toLowerCase();
      filtered = items.filter((item) => item.name.toLowerCase().includes(lower));
    }

    return [...filtered].sort((a, b) => {
      let valA: unknown = a[sortField as keyof ObjectNode];
      let valB: unknown = b[sortField as keyof ObjectNode];

      if (valA === null || valA === undefined) valA = sortDir === 'asc' ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortDir === 'asc' ? Infinity : -Infinity;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });
  };

  const visibleTables = useMemo(() => filterAndSortList(browser.tables), [browser.tables, filterText, sortField, sortDir]);
  const visibleViews = useMemo(() => filterAndSortList(browser.views), [browser.views, filterText, sortField, sortDir]);
  const visibleProcedures = useMemo(() => filterAndSortList(browser.procedures), [browser.procedures, filterText, sortField, sortDir]);
  const visibleTriggers = useMemo(() => filterAndSortList(browser.triggers), [browser.triggers, filterText, sortField, sortDir]);

  const handleTableSelect = (t: ObjectNode) => {
    setSelectedTable(t.name);
    setSelectedTarget({
      type: 'table',
      name: t.name,
      metadata: t as unknown as Record<string, unknown>,
    });
  };

  const handleObjectDoubleClick = (name: string) => {
    void openTable(name);
    setSql(`SELECT * FROM ${name} LIMIT 500;`);
    setActiveView('query');
  };

  const handleDesignTable = (name: string) => {
    setSelectedTable(name);
    void openDesigner(name);
    setDesignerSection('columns');
    setActiveView('designer');
    setSelectedTarget({ type: 'table', name });
  };

  const handleTableContextMenu = (e: MouseEvent, tableName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'table', target: tableName });
  };

  const handleViewContextMenu = (e: MouseEvent, viewName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'view', target: viewName });
  };

  const handleDbContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'database', target: dbName });
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return <span className="cb-sort-arrow text-muted opacity-40">↕</span>;
    return <span className="cb-sort-arrow active">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="db-dashboard" onClick={() => setContextMenu(null)} onContextMenu={handleDbContextMenu}>
      <div className="db-dashboard-header">
        <div className="db-title-row">
          <div className="db-title-left">
            <svg className="cb-icon-svg db-large-icon" viewBox="0 0 24 24" width="22" height="22" stroke="var(--accent)" strokeWidth="2.2" fill="none"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
            <h2>{dbName}</h2>
            <span className="db-subtitle-badge">Database Dashboard</span>
          </div>

          {/* View Mode Switcher on Top Toolbar */}
          <div className="db-view-mode-bar">
            <button
              className={`db-mode-btn ${objectViewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setObjectViewMode('cards')}
              title="Card Grid View"
            >
              🎴 Cards
            </button>
            <button
              className={`db-mode-btn ${objectViewMode === 'list' ? 'active' : ''}`}
              onClick={() => setObjectViewMode('list')}
              title="Dense List View"
            >
              📋 List
            </button>
            <button
              className={`db-mode-btn ${objectViewMode === 'details' ? 'active' : ''}`}
              onClick={() => setObjectViewMode('details')}
              title="Windows Explorer Details Table View"
            >
              📑 Details
            </button>
          </div>
        </div>

        <p className="db-meta-info">
          Connection: <span className="font-semibold text-accent">{activeConnection?.name}</span> ({activeConnection?.engine}) | Host: <span className="font-semibold">{activeConnection?.host}:{activeConnection?.port}</span>
        </p>

        {/* Dashboard Tabs */}
        <div className="db-dashboard-tabs">
          <button
            className={`db-dash-tab ${activeTab === 'tables' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('tables');
              setSelectedTarget({ type: 'schema', name: 'Tables' });
            }}
          >
            📊 Tables ({browser.tables.length})
          </button>
          <button
            className={`db-dash-tab ${activeTab === 'views' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('views');
              setSelectedTarget({ type: 'schema', name: 'Views' });
            }}
          >
            👁️ Views ({browser.views.length})
          </button>
          <button
            className={`db-dash-tab ${activeTab === 'procedures' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('procedures');
              setSelectedTarget({ type: 'schema', name: 'Procedures' });
            }}
          >
            ⚙️ Procedures ({browser.procedures.length})
          </button>
          <button
            className={`db-dash-tab ${activeTab === 'triggers' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('triggers');
              setSelectedTarget({ type: 'schema', name: 'Triggers' });
            }}
          >
            ⚡ Triggers ({browser.triggers.length})
          </button>

          <div className="db-dash-search">
            <input
              className="cb-input cb-input-sm"
              placeholder={`Search ${activeTab}...`}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      </div>

      <div className="db-dashboard-body">
        {activeTab === 'tables' && (
          <div className="db-grid-container">
            {visibleTables.length === 0 ? (
              <div className="db-empty-state">No tables available</div>
            ) : objectViewMode === 'cards' ? (
              /* 1. CARD GRID VIEW */
              <div className="db-card-grid">
                {visibleTables.map((t) => {
                  const isSelected = selectedTable === t.name;
                  return (
                    <div
                      key={t.name}
                      className={`db-object-card ${isSelected ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTableSelect(t);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleObjectDoubleClick(t.name);
                      }}
                      onContextMenu={(e) => handleTableContextMenu(e, t.name)}
                      title={`Double-click to open | Right-click options: ${t.name}`}
                    >
                      <div className="db-card-header-line">
                        <div className="db-card-title-group">
                          <span className="db-card-icon">📊</span>
                          <span className="db-card-title" title={t.name}>{t.name}</span>
                        </div>
                        <span className="db-card-engine-tag">{t.engine ?? 'InnoDB'}</span>
                      </div>
                      <div className="db-card-metadata">
                        <span className="db-meta-pill" title="Columns / Fields count">
                          <span className="pill-label">Cols:</span> {t.columns}
                        </span>
                        <span className="db-meta-pill" title="Row count">
                          <span className="pill-label">Rows:</span> {t.rows !== null && t.rows !== undefined ? t.rows.toLocaleString() : '0'}
                        </span>
                        <span className="db-meta-pill" title="Index count">
                          <span className="pill-label">Idx:</span> {t.indexes ?? 0}
                        </span>
                        <span className="db-meta-pill" title="Foreign key constraints">
                          <span className="pill-label">FK:</span> {t.foreignKeys ?? 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : objectViewMode === 'list' ? (
              /* 2. DENSE LIST VIEW */
              <div className="db-dense-list">
                {visibleTables.map((t) => {
                  const isSelected = selectedTable === t.name;
                  return (
                    <div
                      key={t.name}
                      className={`db-dense-item ${isSelected ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTableSelect(t);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleObjectDoubleClick(t.name);
                      }}
                      onContextMenu={(e) => handleTableContextMenu(e, t.name)}
                    >
                      <span className="db-dense-icon">📊</span>
                      <span className="db-dense-name font-semibold">{t.name}</span>
                      <span className="db-dense-tag">{t.engine ?? 'Table'}</span>
                      <span className="db-dense-meta">Cols: {t.columns}</span>
                      <span className="db-dense-meta">Rows: {t.rows !== null ? t.rows.toLocaleString() : '0'}</span>
                      <span className="db-dense-meta">Idx: {t.indexes ?? 0}</span>
                      <span className="db-dense-meta">FK: {t.foreignKeys ?? 0}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 3. WINDOWS EXPLORER DETAILS TABLE VIEW */
              <div className="db-details-table-wrapper">
                <table className="db-details-table">
                  <thead>
                    <tr>
                      <th className="th-sortable" onClick={() => handleSort('name')}>
                        Name {renderSortIndicator('name')}
                      </th>
                      <th className="th-sortable" onClick={() => handleSort('engine')}>
                        Type / Engine {renderSortIndicator('engine')}
                      </th>
                      <th className="th-sortable text-right" onClick={() => handleSort('rows')}>
                        Rows {renderSortIndicator('rows')}
                      </th>
                      <th className="th-sortable text-right" onClick={() => handleSort('columns')}>
                        Columns {renderSortIndicator('columns')}
                      </th>
                      <th className="th-sortable text-right" onClick={() => handleSort('indexes')}>
                        Indexes {renderSortIndicator('indexes')}
                      </th>
                      <th className="th-sortable text-right" onClick={() => handleSort('foreignKeys')}>
                        Foreign Keys {renderSortIndicator('foreignKeys')}
                      </th>
                      <th className="th-sortable text-right" onClick={() => handleSort('sizeBytes')}>
                        Size {renderSortIndicator('sizeBytes')}
                      </th>
                      <th className="th-sortable" onClick={() => handleSort('updatedAt')}>
                        Date Modified {renderSortIndicator('updatedAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTables.map((t) => {
                      const isSelected = selectedTable === t.name;
                      return (
                        <tr
                          key={t.name}
                          className={`db-details-row ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTableSelect(t);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleObjectDoubleClick(t.name);
                          }}
                          onContextMenu={(e) => handleTableContextMenu(e, t.name)}
                        >
                          <td className="font-semibold cell-name">
                            <span className="cell-icon">📊</span>
                            <span>{t.name}</span>
                          </td>
                          <td>
                            <span className="engine-badge">{t.engine ?? 'Base Table'}</span>
                          </td>
                          <td className="text-right font-mono">
                            {t.rows !== null && t.rows !== undefined ? t.rows.toLocaleString() : '-'}
                          </td>
                          <td className="text-right font-mono">{t.columns}</td>
                          <td className="text-right font-mono">{t.indexes ?? 0}</td>
                          <td className="text-right font-mono">{t.foreignKeys ?? 0}</td>
                          <td className="text-right font-mono">{formatBytes(t.sizeBytes)}</td>
                          <td className="text-muted text-xs">{formatDate(t.updatedAt || t.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'views' && (
          <div className="db-grid-container">
            {visibleViews.length === 0 ? (
              <div className="db-empty-state">No views available</div>
            ) : (
              <div className="db-card-grid">
                {visibleViews.map((v) => {
                  const isSelected = selectedTable === v.name;
                  return (
                    <div
                      key={v.name}
                      className={`db-object-card ${isSelected ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTable(v.name);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleObjectDoubleClick(v.name);
                      }}
                      onContextMenu={(e) => handleViewContextMenu(e, v.name)}
                      title={`Double-click to open | Right-click options: ${v.name}`}
                    >
                      <div className="db-card-header-line">
                        <div className="db-card-title-group">
                          <span className="db-card-icon text-blue-400">👁️</span>
                          <span className="db-card-title" title={v.name}>{v.name}</span>
                        </div>
                        <span className="db-card-engine-tag text-blue-400">View</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'procedures' && (
          <div className="db-grid-container">
            {visibleProcedures.length === 0 ? (
              <div className="db-empty-state">No procedures available</div>
            ) : (
              <div className="db-card-grid">
                {visibleProcedures.map((p) => (
                  <div key={p.name} className="db-object-card db-card-disabled">
                    <div className="db-card-header-line">
                      <div className="db-card-title-group">
                        <span className="db-card-icon text-yellow-400">⚙️</span>
                        <span className="db-card-title" title={p.name}>{p.name}</span>
                      </div>
                      <span className="db-card-type">PROCEDURE</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'triggers' && (
          <div className="db-grid-container">
            {visibleTriggers.length === 0 ? (
              <div className="db-empty-state">No triggers available</div>
            ) : (
              <div className="db-card-grid">
                {visibleTriggers.map((tr) => (
                  <div key={tr.name} className="db-object-card db-card-disabled">
                    <div className="db-card-header-line">
                      <div className="db-card-title-group">
                        <span className="db-card-icon text-pink-400">⚡</span>
                        <span className="db-card-title" title={tr.name}>{tr.name}</span>
                      </div>
                      <span className="db-card-type">TRIGGER</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dashboard Context Menus */}
      {contextMenu && (
        <div
          className="cb-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'database' && (
            <>
              <div className="cb-context-header">📦 Backup Database ({contextMenu.target})</div>
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

          {(contextMenu.type === 'table' || contextMenu.type === 'view') && (
            <>
              <div className="cb-context-header">⚡ Actions ({contextMenu.target})</div>
              <button
                className="cb-context-item font-semibold"
                onClick={() => {
                  handleObjectDoubleClick(contextMenu.target);
                  setContextMenu(null);
                }}
              >
                📊 Open Data View
              </button>
              {contextMenu.type === 'table' && (
                <button
                  className="cb-context-item"
                  onClick={() => {
                    handleDesignTable(contextMenu.target);
                    setContextMenu(null);
                  }}
                >
                  🛠️ Design Table
                </button>
              )}
              <div className="cb-context-divider" />
              <div className="cb-context-header">📦 Backup {contextMenu.type === 'table' ? 'Table' : 'View'} ({contextMenu.target})</div>
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
              <div className="cb-context-header">📦 Restore {contextMenu.type === 'table' ? 'Table' : 'View'}</div>
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
        </div>
      )}
    </div>
  );
}
