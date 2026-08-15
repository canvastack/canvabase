import { useState, type JSX } from 'react';
import type { AppStore } from '../store';
import logoUrl from '../assets/logo.png';

import { applyBgColor, getSavedBgColor } from './SettingsModal';

interface HeaderToolbarProps {
  store: AppStore;
  onOpenNewConnection: () => void;
  onOpenExportModal: () => void;
  onOpenImportModal: () => void;
  onOpenSettingsModal: () => void;
}

export function HeaderToolbar({
  store,
  onOpenNewConnection,
  onOpenExportModal,
  onOpenImportModal,
  onOpenSettingsModal,
}: HeaderToolbarProps): JSX.Element {
  const activeConnectionId = store((s) => s.activeConnectionId);
  const connections = store((s) => s.connections);
  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const browser = store((s) => s.browser);
  const activeView = store((s) => s.activeView);
  const setActiveView = store((s) => s.setActiveView);
  const newDesigner = store((s) => s.newDesigner);
  const openErd = store((s) => s.openErd);
  const selectDatabase = store((s) => s.selectDatabase);
  const refreshBrowser = store((s) => s.refreshBrowser);
  const newTab = store((s) => s.newTab);
  const setSql = store((s) => s.setSql);
  const backupDatabase = store((s) => s.backupDatabase);

  const tabs = store((s) => s.tabs);
  const activeTabId = store((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const toolbarDisplayStyle = store((s) => s.toolbarDisplayStyle);
  const setToolbarDisplayStyle = store((s) => s.setToolbarDisplayStyle);
  const leftSidebarOpen = store((s) => s.leftSidebarOpen);
  const toggleLeftSidebar = store((s) => s.toggleLeftSidebar);
  const rightSidebarOpen = store((s) => s.rightSidebarOpen);
  const toggleRightSidebar = store((s) => s.toggleRightSidebar);

  const client = store((s) => s.client);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);

    const savedBg = getSavedBgColor(next);
    applyBgColor(savedBg, next);
    try {
      void client.events.emit('canvabase:theme:set', next);
    } catch {
      // ignore in browser test environment
    }
  };

  const showIcon = toolbarDisplayStyle === 'both' || toolbarDisplayStyle === 'icon';
  const showText = toolbarDisplayStyle === 'both' || toolbarDisplayStyle === 'text';

  const cycleToolbarStyle = () => {
    const styles: Array<'both' | 'icon' | 'text'> = ['both', 'icon', 'text'];
    const nextIdx = (styles.indexOf(toolbarDisplayStyle) + 1) % styles.length;
    setToolbarDisplayStyle(styles[nextIdx] ?? 'both');
  };

  const styleLabel =
    toolbarDisplayStyle === 'both'
      ? 'Icon + Text'
      : toolbarDisplayStyle === 'icon'
      ? 'Icon Only'
      : 'Text Only';

  return (
    <div className="cb-toolbar-wrapper">
      <header className={`cb-toolbar toolbar-style-${toolbarDisplayStyle}`}>
        <div className="cb-toolbar-left">
          {/* Logo as Left Sidebar Toggle Button */}
          <button
            className={`cb-brand-btn ${leftSidebarOpen ? 'sidebar-expanded' : 'sidebar-collapsed'}`}
            onClick={toggleLeftSidebar}
            title={leftSidebarOpen ? 'Collapse Left Sidebar (Ctrl+B)' : 'Expand Left Sidebar (Ctrl+B)'}
          >
            <img src={logoUrl} className="cb-brand-logo-img" alt="CanvaBase Logo" />
            <div className="cb-brand-title">
              CanvaBase <span className="cb-brand-badge">v0.1.0</span>
            </div>
          </button>

          <div className="cb-divider" />

          {/* Action Buttons */}
          <button
            className="cb-tool-button cb-tool-button-primary"
            onClick={onOpenNewConnection}
            title="New Connection"
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="8" width="6" height="8" rx="1.5"></rect><line x1="10" y1="2" x2="10" y2="8"></line><line x1="14" y1="2" x2="14" y2="8"></line><path d="M12 16v6"></path></svg>
            )}
            {showText && <span className="cb-tool-label">New Connection</span>}
          </button>

          <div className="cb-divider" />

          {/* Views navigation tabs */}
          <div className="cb-view-tabs">
            <button
              className={`cb-view-tab ${activeView === 'query' ? 'active' : ''}`}
              onClick={() => setActiveView('query')}
              title="SQL Query Editor"
            >
              {showIcon && (
                <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
              )}
              {showText && <span>Query Editor</span>}
            </button>

            <button
              className={`cb-view-tab ${activeView === 'designer' ? 'active' : ''}`}
              onClick={() => {
                newDesigner();
                setActiveView('designer');
              }}
              title="Visual Table Designer"
            >
              {showIcon && (
                <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="21" y1="9" x2="3" y2="9"></line><line x1="21" y1="15" x2="3" y2="15"></line><line x1="12" y1="3" x2="12" y2="21"></line></svg>
              )}
              {showText && <span>Table Designer</span>}
            </button>

            <button
              className={`cb-view-tab ${activeView === 'erd' ? 'active' : ''}`}
              onClick={() => {
                void openErd();
                setActiveView('erd');
              }}
              title="Entity Relationship Diagram"
              disabled={!activeConnectionId}
            >
              {showIcon && (
                <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"></rect><rect x="15" y="3" width="6" height="6" rx="1"></rect><rect x="15" y="15" width="6" height="6" rx="1"></rect><rect x="3" y="15" width="6" height="6" rx="1"></rect><path d="M9 6h6M9 18h6M6 9v6M18 9v6"></path></svg>
              )}
              {showText && <span>ERD Canvas</span>}
            </button>

            <button
              className={`cb-view-tab ${activeView === 'role' ? 'active' : ''}`}
              onClick={() => setActiveView('role')}
              title="PostgreSQL Role & Privilege Manager"
            >
              {showIcon && (
                <svg className="cb-icon-svg text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              )}
              {showText && <span>Role Manager</span>}
            </button>

            <button
              className={`cb-view-tab ${activeView === 'history_log' ? 'active' : ''}`}
              onClick={() => setActiveView('history_log')}
              title="Query Execution History Log (Ctrl+L)"
            >
              {showIcon && (
                <svg className="cb-icon-svg text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              )}
              {showText && <span>History Log</span>}
            </button>

            <button
              className={`cb-view-tab ${activeView === 'server_monitor' ? 'active' : ''}`}
              onClick={() => setActiveView('server_monitor')}
              title="Database Server Process & Lock Monitor"
            >
              {showIcon && (
                <svg className="cb-icon-svg text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
              )}
              {showText && <span>Server Monitor</span>}
            </button>
          </div>

          <div className="cb-divider" />

          {/* Import / Export Tools */}
          <button
            className="cb-tool-button"
            onClick={onOpenExportModal}
            disabled={!activeConnectionId || !activeTab?.table}
            title={!activeTab?.table ? 'Export requires active table' : 'Export Data Wizard'}
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            )}
            {showText && <span className="cb-tool-label">Export</span>}
          </button>

          <button
            className="cb-tool-button"
            onClick={onOpenImportModal}
            disabled={!activeConnectionId || !activeTab?.table}
            title={!activeTab?.table ? 'Import requires active table' : 'Import Data Wizard'}
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            )}
            {showText && <span className="cb-tool-label">Import</span>}
          </button>
        </div>

        <div className="cb-toolbar-right">
          {/* Active Database Selector */}
          {activeConnectionId && (
            <div className="cb-db-selector">
              <span className="cb-db-label">Database:</span>
              <select
                className="cb-select"
                value={activeConnection?.database || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    void selectDatabase(e.target.value);
                  }
                }}
              >
                <option value="">(Select Database)</option>
                {browser.databases.map((db) => (
                  <option key={db.id || db.name} value={db.name}>
                    {db.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Connection status indicator */}
          <div className="cb-conn-badge">
            <span className={`status-dot ${activeConnection ? 'connected' : 'disconnected'}`} />
            <span className="cb-conn-name">
              {activeConnection ? activeConnection.name : 'Not Connected'}
            </span>
            {activeConnection && <span className="engine-tag">{activeConnection.engine}</span>}
          </div>

          <div className="cb-divider-sm" />

          {/* Toolbar Display Style Quick Switcher */}
          <button
            className="cb-tool-button cb-toolbar-style-btn"
            onClick={cycleToolbarStyle}
            title={`Toolbar Style: ${styleLabel} (Click to switch)`}
          >
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <span className="cb-tool-label">{styleLabel}</span>
          </button>

          {/* Right Inspector Toggle */}
          <button
            className={`cb-icon-button ${rightSidebarOpen ? 'active' : ''}`}
            onClick={toggleRightSidebar}
            title={rightSidebarOpen ? 'Hide Inspector Sidebar' : 'Show Inspector Sidebar'}
          >
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </button>

          <button className="cb-icon-button" onClick={() => void refreshBrowser()} title="Refresh">
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          </button>

          <button
            className="cb-icon-button"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            ) : (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            )}
          </button>

          <button className="cb-icon-button" onClick={onOpenSettingsModal} title="Theme & Settings">
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </div>
      </header>

      {/* Top Object Ribbon Toolbar */}
      <div className={`cb-object-ribbon toolbar-style-${toolbarDisplayStyle}`}>
        <div className="cb-ribbon-group">
          <button className="cb-ribbon-btn" onClick={onOpenNewConnection} title="New Connection">
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="8" width="6" height="8" rx="1.5"></rect><line x1="10" y1="2" x2="10" y2="8"></line><line x1="14" y1="2" x2="14" y2="8"></line><path d="M12 16v6"></path></svg>
            )}
            {showText && <span>Connection</span>}
          </button>

          <button
            className="cb-ribbon-btn"
            onClick={() => {
              newTab();
              setActiveView('query');
            }}
            title="Create New Query Tab"
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            )}
            {showText && <span>New Query</span>}
          </button>
        </div>

        <div className="cb-divider-sm" />

        <div className="cb-ribbon-group">
          <button
            className="cb-ribbon-btn"
            onClick={() => {
              newDesigner();
              setActiveView('designer');
            }}
            title="Design New Table"
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="21" y1="9" x2="3" y2="9"></line><line x1="21" y1="15" x2="3" y2="15"></line><line x1="12" y1="3" x2="12" y2="21"></line></svg>
            )}
            {showText && <span>Table</span>}
          </button>

          <button
            className="cb-ribbon-btn"
            onClick={() => {
              newTab();
              setSql('-- Create View\nCREATE VIEW v_sample AS\nSELECT * FROM ...;');
              setActiveView('query');
            }}
            title="Create New Database View"
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            )}
            {showText && <span>View</span>}
          </button>

          <button
            className="cb-ribbon-btn"
            onClick={() => {
              newTab();
              setSql('-- Create Materialized View\nCREATE MATERIALIZED VIEW mv_summary AS\nSELECT * FROM ...;');
              setActiveView('query');
            }}
            title="Create Materialized View"
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            )}
            {showText && <span>Materialized View</span>}
          </button>
        </div>

        <div className="cb-divider-sm" />

        <div className="cb-ribbon-group">
          <button
            className="cb-ribbon-btn"
            onClick={() => {
              newTab();
              setSql('-- Create Function / Stored Procedure\nCREATE FUNCTION fn_calculate()\nRETURNS void AS $$\nBEGIN\n  -- Logic here\nEND;\n$$ LANGUAGE plpgsql;');
              setActiveView('query');
            }}
            title="Create Function / Procedure"
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            )}
            {showText && <span>Function</span>}
          </button>

          <button
            className="cb-ribbon-btn"
            onClick={() => {
              newTab();
              setSql('-- Create Role / User Management\nCREATE ROLE app_role WITH LOGIN PASSWORD \'secure_pass\';\nGRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO app_role;');
              setActiveView('query');
            }}
            title="Manage Roles & Permissions"
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            )}
            {showText && <span>Role</span>}
          </button>
        </div>

        <div className="cb-divider-sm" />

        <div className="cb-ribbon-group">
          <button
            className="cb-ribbon-btn"
            onClick={() => {
              void backupDatabase('sql');
            }}
            title="Backup Active Database to SQL Dump"
          >
            {showIcon && (
              <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            )}
            {showText && <span>Backup</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
