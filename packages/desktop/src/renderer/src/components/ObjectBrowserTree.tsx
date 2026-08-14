import { useState, type JSX, type MouseEvent } from 'react';
import type { AppStore } from '../store';
import type { ObjectNode } from '@canvabase/contracts';

export function ObjectBrowserTree({ store }: { store: AppStore }): JSX.Element {
  const activeConnectionId = store((s) => s.activeConnectionId);
  const connections = store((s) => s.connections);
  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const browser = store((s) => s.browser);
  const openTable = store((s) => s.openTable);
  const openDesigner = store((s) => s.openDesigner);
  const openErd = store((s) => s.openErd);
  const setActiveView = store((s) => s.setActiveView);
  const refreshBrowser = store((s) => s.refreshBrowser);

  const openProcedure = store((s) => s.openProcedure);
  const openTrigger = store((s) => s.openTrigger);
  const openUser = store((s) => s.openUser);

  const [filterText, setFilterText] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; table: string } | null>(null);

  if (!activeConnectionId) {
    return (
      <div className="object-browser empty">
        <div className="empty-hint">Connect to a database to explore tables, views & objects</div>
      </div>
    );
  }

  const filterNodes = (nodes: ObjectNode[]) => {
    if (!filterText.trim()) return nodes;
    const lower = filterText.toLowerCase();
    return nodes.filter((n) => n.name.toLowerCase().includes(lower));
  };

  const filteredTables = filterNodes(browser.tables);
  const filteredViews = filterNodes(browser.views);
  const filteredProcedures = filterNodes(browser.procedures);
  const filteredTriggers = filterNodes(browser.triggers);
  const filteredUsers = filterNodes(browser.users);

  const handleTableDoubleClick = (tableName: string) => {
    void openTable(tableName);
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

  const handleUserClick = (userName: string) => {
    openUser(userName);
    setActiveView('query');
  };

  const handleContextMenu = (e: MouseEvent, tableName: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, table: tableName });
  };

  return (
    <div className="object-browser" onClick={() => setContextMenu(null)}>
      <div className="browser-header">
        <div className="browser-title-row">
          <span className="browser-title">🗂️ {activeConnection?.name ? activeConnection.name : 'Objects'}</span>
          <button className="cb-icon-button" onClick={() => void refreshBrowser()} title="Refresh">
            🔄
          </button>
        </div>

        <input
          className="cb-input cb-input-sm"
          type="search"
          placeholder="Filter objects..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {browser.loading ? (
        <div className="browser-loading">Loading database objects...</div>
      ) : (
        <div className="browser-tree">
          {/* Tables Section */}
          <details open className="tree-group">
            <summary className="tree-group-header">
              <span>📊 Tables</span>
              <span className="tree-badge">{filteredTables.length}</span>
            </summary>
            <div className="tree-items">
              {filteredTables.length === 0 ? (
                <div className="tree-empty">No tables found</div>
              ) : (
                filteredTables.map((t) => (
                  <div
                    key={t.id}
                    className="tree-item"
                    onClick={() => void openTable(t.name)}
                    onDoubleClick={() => handleTableDoubleClick(t.name)}
                    onContextMenu={(e) => handleContextMenu(e, t.name)}
                    title="Double-click to View Data | Right-click for options"
                  >
                    <span className="tree-icon">📄</span>
                    <span className="tree-name">{t.name}</span>
                  </div>
                ))
              )}
            </div>
          </details>

          {/* Views Section */}
          {browser.capabilities?.views !== false && (
            <details className="tree-group">
              <summary className="tree-group-header">
                <span>👁️ Views</span>
                <span className="tree-badge">{filteredViews.length}</span>
              </summary>
              <div className="tree-items">
                {filteredViews.length === 0 ? (
                  <div className="tree-empty">No views found</div>
                ) : (
                  filteredViews.map((v) => (
                    <div
                      key={v.id}
                      className="tree-item"
                      onClick={() => handleViewClick(v.name)}
                      onDoubleClick={() => handleViewClick(v.name)}
                    >
                      <span className="tree-icon">👁️</span>
                      <span className="tree-name">{v.name}</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          )}

          {/* Procedures Section */}
          {browser.capabilities?.procedures !== false && (
            <details className="tree-group">
              <summary className="tree-group-header">
                <span>⚡ Procedures / Functions</span>
                <span className="tree-badge">{filteredProcedures.length}</span>
              </summary>
              <div className="tree-items">
                {filteredProcedures.length === 0 ? (
                  <div className="tree-empty">No procedures found</div>
                ) : (
                  filteredProcedures.map((p) => (
                    <div
                      key={p.id}
                      className="tree-item"
                      onClick={() => handleProcedureClick(p.name)}
                      onDoubleClick={() => handleProcedureClick(p.name)}
                    >
                      <span className="tree-icon">⚡</span>
                      <span className="tree-name">{p.name}</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          )}

          {/* Triggers Section */}
          {browser.capabilities?.triggers !== false && (
            <details className="tree-group">
              <summary className="tree-group-header">
                <span>🔔 Triggers</span>
                <span className="tree-badge">{filteredTriggers.length}</span>
              </summary>
              <div className="tree-items">
                {filteredTriggers.length === 0 ? (
                  <div className="tree-empty">No triggers found</div>
                ) : (
                  filteredTriggers.map((tr) => (
                    <div
                      key={tr.id}
                      className="tree-item"
                      onClick={() => handleTriggerClick(tr.name)}
                      onDoubleClick={() => handleTriggerClick(tr.name)}
                    >
                      <span className="tree-icon">🔔</span>
                      <span className="tree-name">{tr.name}</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          )}

          {/* Users Section */}
          {browser.capabilities?.userManagement !== false && (
            <details className="tree-group">
              <summary className="tree-group-header">
                <span>👤 Users / Roles</span>
                <span className="tree-badge">{filteredUsers.length}</span>
              </summary>
              <div className="tree-items">
                {filteredUsers.length === 0 ? (
                  <div className="tree-empty">No users found</div>
                ) : (
                  filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="tree-item"
                      onClick={() => handleUserClick(u.name)}
                      onDoubleClick={() => handleUserClick(u.name)}
                    >
                      <span className="tree-icon">👤</span>
                      <span className="tree-name">{u.name}</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Table Context Menu */}
      {contextMenu && (
        <div
          className="cb-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="cb-context-item"
            onClick={() => {
              void openTable(contextMenu.table);
              setActiveView('query');
              setContextMenu(null);
            }}
          >
            📊 View Table Data
          </button>
          <button
            className="cb-context-item"
            onClick={() => {
              void openDesigner(contextMenu.table);
              setActiveView('designer');
              setContextMenu(null);
            }}
          >
            📑 Design Table
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
        </div>
      )}
    </div>
  );
}
