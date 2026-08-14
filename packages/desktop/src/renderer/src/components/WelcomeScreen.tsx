import type { JSX } from 'react';
import type { AppStore } from '../store';
import logoUrl from '../assets/logo.png';

interface WelcomeScreenProps {
  store: AppStore;
  onOpenNewConnection: () => void;
}

export function WelcomeScreen({ store, onOpenNewConnection }: WelcomeScreenProps): JSX.Element {
  const connections = store((s) => s.connections);
  const connect = store((s) => s.connect);
  const setActiveView = store((s) => s.setActiveView);
  const newTab = store((s) => s.newTab);

  const handleConnect = async (id: string) => {
    const res = await connect(id);
    if (res.ok) {
      setActiveView('database');
    }
  };

  const handleStartQuery = () => {
    newTab();
    setActiveView('query');
  };

  return (
    <div className="cb-welcome-screen">
      <div className="cb-welcome-container">
        {/* Hero Header */}
        <div className="cb-welcome-hero">
          <img src={logoUrl} className="cb-welcome-logo" alt="CanvaBase Logo" />
          <div className="cb-welcome-hero-text">
            <div className="cb-welcome-title-row">
              <h1 className="cb-welcome-title">CanvaBase</h1>
              <span className="cb-welcome-badge">v0.1.0-mvp</span>
            </div>
            <p className="cb-welcome-desc">
              High-performance modern database desktop client & ERD modeler for MySQL, PostgreSQL, and SQLite.
            </p>
          </div>
        </div>

        {/* Main Grid Content */}
        <div className="cb-welcome-grid">
          {/* Column 1: Start Actions */}
          <div className="cb-welcome-card">
            <h2 className="cb-welcome-section-title">
              <span className="cb-welcome-section-icon">⚡</span> Start
            </h2>
            <div className="cb-welcome-actions">
              <button className="cb-welcome-action-btn" onClick={onOpenNewConnection}>
                <span className="cb-welcome-action-icon">➕</span>
                <div className="cb-welcome-action-info">
                  <span className="cb-welcome-action-title">New Connection</span>
                  <span className="cb-welcome-action-desc">Connect to MySQL, PostgreSQL, or SQLite</span>
                </div>
              </button>

              <button className="cb-welcome-action-btn" onClick={handleStartQuery}>
                <span className="cb-welcome-action-icon">📝</span>
                <div className="cb-welcome-action-info">
                  <span className="cb-welcome-action-title">New Query Editor</span>
                  <span className="cb-welcome-action-desc">Write SQL with smart autocomplete</span>
                </div>
              </button>

              <button className="cb-welcome-action-btn" onClick={() => setActiveView('erd')}>
                <span className="cb-welcome-action-icon">🗺️</span>
                <div className="cb-welcome-action-info">
                  <span className="cb-welcome-action-title">ERD Diagram Canvas</span>
                  <span className="cb-welcome-action-desc">Visualize database schema & relationships</span>
                </div>
              </button>
            </div>

            {/* Quick Connections List */}
            <h3 className="cb-welcome-subtitle">Saved Connections</h3>
            {connections.length === 0 ? (
              <div className="cb-welcome-empty-conn">
                <p>No connections configured yet.</p>
                <button className="cb-button cb-button-primary cb-welcome-small-btn" onClick={onOpenNewConnection}>
                  Create First Connection
                </button>
              </div>
            ) : (
              <div className="cb-welcome-conn-list">
                {connections.map((conn) => (
                  <div key={conn.id} className="cb-welcome-conn-item">
                    <div className="cb-welcome-conn-info">
                      <span className="cb-welcome-conn-name">{conn.name}</span>
                      <span className="cb-welcome-conn-meta">
                        <span className="engine-badge">{conn.engine}</span>
                        {conn.host ? `${conn.host}:${conn.port}` : conn.database || 'local file'}
                      </span>
                    </div>
                    <button
                      className={`cb-button ${conn.status === 'connected' ? 'cb-button-primary' : ''}`}
                      onClick={() => void handleConnect(conn.id)}
                    >
                      {conn.status === 'connected' ? 'Open' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: User Guide & Shortcuts */}
          <div className="cb-welcome-card">
            <h2 className="cb-welcome-section-title">
              <span className="cb-welcome-section-icon">📖</span> User Guide & Shortcuts
            </h2>

            <div className="cb-welcome-guide-section">
              <h3 className="cb-welcome-subtitle">Essential Shortcuts</h3>
              <div className="cb-welcome-shortcut-list">
                <div className="cb-welcome-shortcut-row">
                  <span className="cb-welcome-shortcut-desc">Execute SQL Query</span>
                  <kbd className="cb-kbd">Ctrl</kbd> + <kbd className="cb-kbd">Enter</kbd>
                </div>
                <div className="cb-welcome-shortcut-row">
                  <span className="cb-welcome-shortcut-desc">SQL Autocomplete</span>
                  <kbd className="cb-kbd">Ctrl</kbd> + <kbd className="cb-kbd">Space</kbd> / <kbd className="cb-kbd">Tab</kbd>
                </div>
                <div className="cb-welcome-shortcut-row">
                  <span className="cb-welcome-shortcut-desc">New Query Tab</span>
                  <kbd className="cb-kbd">+</kbd> Tab Header Button
                </div>
                <div className="cb-welcome-shortcut-row">
                  <span className="cb-welcome-shortcut-desc">Edit Table Data</span>
                  <span className="cb-welcome-shortcut-val">Double-click Grid Cell</span>
                </div>
                <div className="cb-welcome-shortcut-row">
                  <span className="cb-welcome-shortcut-desc">Table Actions & DDL</span>
                  <span className="cb-welcome-shortcut-val">Right-click Table Node</span>
                </div>
              </div>
            </div>

            <div className="cb-welcome-guide-section">
              <h3 className="cb-welcome-subtitle">Core Features</h3>
              <ul className="cb-welcome-feature-list">
                <li>
                  <strong>Object Browser:</strong> Deep tree exploration for Tables, Views, Procedures, Triggers, and Roles.
                </li>
                <li>
                  <strong>High-Speed Grid:</strong> Virtualized rendering capable of smoothly scrolling 1M+ rows.
                </li>
                <li>
                  <strong>Table Designer:</strong> Visual column, index, and foreign key schema management with DDL preview.
                </li>
                <li>
                  <strong>Import / Export:</strong> Streamed CSV, SQL dump, and JSON transfer with progress indicators.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
