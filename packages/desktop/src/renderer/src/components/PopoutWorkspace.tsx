import { useEffect, useState, useMemo, type JSX } from 'react';
import { createAppStore, type AppStore } from '../store';
import { QueryEditor } from './QueryEditor';
import { ResultGrid } from './ResultGrid';
import { StatusBar } from './StatusBar';
import { SettingsModal, applyAccent, applyBgColor, getSavedBgColor } from './SettingsModal';
import { initPersistedFonts } from '../lib/fontManager';
import { applySavedSqlTheme } from '../lib/sqlTheme';
import type { Client } from '@canvabase/contracts';
import logoUrl from '../assets/logo.png';

export function PopoutWorkspace({ client }: { client: Client }): JSX.Element {
  const [store] = useState<AppStore>(() => createAppStore(client));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Parse URL hash parameters
  const params = useMemo(() => {
    const hash = window.location.hash;
    const queryIdx = hash.indexOf('?');
    if (queryIdx === -1) return new URLSearchParams();
    return new URLSearchParams(hash.slice(queryIdx + 1));
  }, []);

  const type = params.get('type') || 'query';
  const initialTitle = params.get('title') || 'Workspace';
  const connectionId = params.get('connectionId') || '';
  const initialSql = params.get('sql') || '';
  const initialTable = params.get('table') || '';

  // Initialize App Theme and Fonts
  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    applyAccent(localStorage.getItem('accent') || '#6366f1');
    applyBgColor(getSavedBgColor(savedTheme), savedTheme);
    initPersistedFonts();
    applySavedSqlTheme();
  }, []);

  // Initialize Connection and Tabs in Popout Store
  useEffect(() => {
    async function init() {
      if (connectionId) {
        await store.getState().connect(connectionId);
        if (initialTable) {
          await store.getState().openTable(initialTable);
        } else if (initialSql) {
          const tabId = store.getState().activeTabId;
          store.getState().setSql(initialSql);
          if (initialTitle) store.getState().renameTab(tabId, initialTitle);
        }
      }
    }
    void init();
  }, [connectionId, initialTable, initialSql, initialTitle, store]);

  const activeConnectionId = store((s) => s.activeConnectionId);
  const connections = store((s) => s.connections);
  const activeConn = connections.find((c) => c.id === activeConnectionId);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    void client.events.emit('canvabase:theme:set', next);
  };

  return (
    <div className="app-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Popout Custom Chrome Titlebar */}
      <header
        className="cb-popout-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logoUrl} alt="CanvaBase Logo" style={{ width: 18, height: 18, borderRadius: 4 }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
            CanvaBase Popout — {initialTitle}
          </span>
          {activeConn && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: 'var(--success)',
                fontWeight: 600,
              }}
            >
              ● {activeConn.name} ({activeConn.engine})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="cb-icon-button"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <button
            className="cb-icon-button"
            onClick={() => setSettingsOpen(true)}
            title="Appearance & Font Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {type === 'table' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ResultGrid store={store} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <QueryEditor store={store} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderTop: '1px solid var(--border)' }}>
              <ResultGrid store={store} />
            </div>
          </div>
        )}
      </main>

      {/* Status Bar */}
      <StatusBar store={store} />

      {/* Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          store={store}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
