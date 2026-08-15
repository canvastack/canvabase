// packages/desktop/src/renderer/src/components/HistoryLog/HistoryLog.tsx
import { useState, useEffect, useRef, type JSX } from 'react';
import type { AppStore } from '../../store';
import type { QueryLogEntry, HistoryLogFilter } from './types';
import {
  filterLogEntries,
  exportLogsToCsv,
  exportLogsToJson,
} from './historyLogUtils';

interface HistoryLogProps {
  store: AppStore;
}

export function HistoryLog({ store }: HistoryLogProps): JSX.Element {
  const connections = store((s) => s.connections);
  const storeQueryLogs = store((s) => s.queryLogs);
  const clearStoreLogs = store((s) => s.clearQueryLogs);

  const [filter, setFilter] = useState<HistoryLogFilter>({
    serverTarget: 'ALL',
    search: '',
    errorsOnly: false,
    slowOnly: false,
    slowThresholdMs: 500,
    category: 'ALL',
  });
  const [wordWrap, setWordWrap] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date().toLocaleTimeString());
  const logScrollRef = useRef<HTMLDivElement>(null);

  // Live logs from store (only real executed queries, no seed/mock data)
  const allLogs: QueryLogEntry[] = storeQueryLogs;

  // Available server options for dropdown
  const serverOptions = [
    'ALL',
    'PostgreSQL',
    ...connections.map((c) => c.name).filter((name) => name !== 'PostgreSQL' && name !== 'ALL'),
  ];

  // Filtered logs
  const filtered = filterLogEntries(allLogs, filter);

  useEffect(() => {
    setLastRefreshTime(new Date().toLocaleTimeString());
  }, [allLogs.length]);

  const handleRefresh = (): void => {
    setLastRefreshTime(new Date().toLocaleTimeString());
  };

  const handleClear = (): void => {
    clearStoreLogs(filter.serverTarget);
  };

  const handleExportCsv = (): void => {
    const csv = exportLogsToCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvabase_query_history_${filter.serverTarget}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = (): void => {
    const json = exportLogsToJson(filtered);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvabase_query_history_${filter.serverTarget}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExplainInEditor = (sql: string): void => {
    store.getState().setSql(`EXPLAIN ANALYZE\n${sql}`);
    store.getState().setActiveView('query');
  };

  const handleCopySql = (sql: string): void => {
    void navigator.clipboard.writeText(sql);
  };

  return (
    <div className="role-mgr-container">
      {/* Top Toolbar matching Navicat Premium Screenshot */}
      <div className="role-mgr-toolbar">
        <div className="role-mgr-actions">
          {/* Target Server Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Server:</span>
            <select
              value={filter.serverTarget}
              onChange={(e) => setFilter((prev) => ({ ...prev, serverTarget: e.target.value }))}
              className="cb-select"
              style={{ padding: '3px 8px', fontSize: '11.5px', fontWeight: 600 }}
            >
              <option value="ALL">🌐 All Servers (Global)</option>
              {serverOptions
                .filter((s) => s !== 'ALL')
                .map((srv) => (
                  <option key={srv} value={srv}>
                    {srv === 'PostgreSQL' ? '🐘' : '🔌'} {srv}
                  </option>
                ))}
            </select>
          </div>

          <div className="role-mgr-divider" />

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            className="role-mgr-btn"
            title="Refresh history log"
          >
            <span>🔄</span>
            <span>Refresh</span>
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            className="role-mgr-btn"
            title="Clear log entries"
          >
            <span>🗑️</span>
            <span>Clear</span>
          </button>

          <div className="role-mgr-divider" />

          {/* Word Wrap Toggle */}
          <label className="role-form-checkbox-label" style={{ fontSize: '11.5px', gap: '5px' }}>
            <input
              type="checkbox"
              checked={wordWrap}
              onChange={(e) => setWordWrap(e.target.checked)}
            />
            <span>Word Wrap</span>
          </label>

          {/* Show Errors Only Toggle */}
          <label className="role-form-checkbox-label" style={{ fontSize: '11.5px', gap: '5px' }}>
            <input
              type="checkbox"
              checked={filter.errorsOnly}
              onChange={(e) => setFilter((prev) => ({ ...prev, errorsOnly: e.target.checked }))}
            />
            <span style={{ color: filter.errorsOnly ? 'var(--error)' : 'inherit' }}>⚠️ Show Errors Only</span>
          </label>

          {/* Slow Queries Only Toggle */}
          <label className="role-form-checkbox-label" style={{ fontSize: '11.5px', gap: '5px' }}>
            <input
              type="checkbox"
              checked={filter.slowOnly}
              onChange={(e) => setFilter((prev) => ({ ...prev, slowOnly: e.target.checked }))}
            />
            <span style={{ color: filter.slowOnly ? 'var(--accent)' : 'inherit' }}>⏱️ Slow (&gt;500ms)</span>
          </label>

          <div className="role-mgr-divider" />

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className={`role-mgr-btn ${isPaused ? 'role-mgr-btn-primary' : ''}`}
            title={isPaused ? 'Resume live logging' : 'Pause live logging'}
          >
            <span>{isPaused ? '▶️' : '⏸️'}</span>
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Export Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={handleExportCsv}
              className="role-mgr-btn"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              title="Export as CSV for compliance audit"
            >
              💾 CSV
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="role-mgr-btn"
              style={{ padding: '4px 8px', fontSize: '11px' }}
              title="Export as JSON"
            >
              💾 JSON
            </button>
          </div>
        </div>

        {/* Search Box on Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            placeholder="Search log history..."
            value={filter.search}
            onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
            className="role-mgr-search-input"
            style={{ width: '200px' }}
          />
        </div>
      </div>

      {/* Main Log Stream Console */}
      <div
        ref={logScrollRef}
        className="role-mgr-table-wrapper"
        style={{
          background: 'var(--bg-input)',
          padding: '10px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: '11.5px',
          lineHeight: '1.65',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No query logs recorded matching the current filter (Server: {filter.serverTarget}).
          </div>
        ) : (
          filtered.map((entry, idx) => {
            const isSlow = entry.durationMs >= 500;
            const isMedium = entry.durationMs >= 50 && entry.durationMs < 500;
            const durationSec = (entry.durationMs / 1000).toFixed(3);

            return (
              <div
                key={entry.id}
                style={{
                  marginBottom: '12px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid var(--border)',
                  position: 'relative',
                }}
              >
                {/* Header Tag Line */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', userSelect: 'none', width: '28px' }}>{idx + 1}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      [{entry.formattedTimestamp}][{entry.serverName}][{entry.pid}][{entry.dialectTag}]
                    </span>
                    <span
                      className="role-mgr-badge"
                      style={{
                        background:
                          entry.category === 'DML'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : entry.category === 'DDL'
                            ? 'rgba(168, 85, 247, 0.15)'
                            : 'rgba(100, 116, 139, 0.15)',
                        border: '1px solid var(--border)',
                        color:
                          entry.category === 'DML'
                            ? 'var(--sql-keyword-color)'
                            : entry.category === 'DDL'
                            ? 'var(--sql-operator-color)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {entry.category}
                    </span>
                  </div>

                  {/* Latency Tag & Quick Action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className="role-mgr-badge"
                      style={{
                        background: isSlow
                          ? 'rgba(239, 68, 68, 0.2)'
                          : isMedium
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(16, 185, 129, 0.15)',
                        color: isSlow ? 'var(--error)' : isMedium ? 'var(--accent)' : 'var(--success)',
                        fontWeight: 700,
                      }}
                    >
                      Time: {durationSec}s {isSlow ? '🚨 SLOW' : ''}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleExplainInEditor(entry.sql)}
                      className="role-mgr-btn"
                      style={{ padding: '1px 6px', fontSize: '10px' }}
                      title="Explain Analyze query in Query Editor"
                    >
                      ⚡ Explain
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopySql(entry.sql)}
                      className="role-mgr-btn"
                      style={{ padding: '1px 6px', fontSize: '10px' }}
                      title="Copy SQL to Clipboard"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                {/* SQL Code Block */}
                <div
                  style={{
                    marginTop: '4px',
                    color: entry.level === 'ERROR' ? 'var(--error)' : 'var(--text-primary)',
                    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                    wordBreak: wordWrap ? 'break-all' : 'normal',
                    overflowX: wordWrap ? 'hidden' : 'auto',
                  }}
                >
                  {entry.sql}
                </div>

                {/* Error Banner if any */}
                {entry.errorMessage && (
                  <div style={{ marginTop: '4px', color: 'var(--error)', fontSize: '11px' }}>
                    [ERROR] {entry.errorMessage}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Status Bar matching Screenshot 1 */}
      <div className="role-mgr-statusbar">
        <span>Last Refresh Time: {lastRefreshTime}</span>
        <span>
          Server Filter: <strong>{filter.serverTarget}</strong> | Showing {filtered.length} of {allLogs.length} entries {isPaused ? '(PAUSED)' : ''}
        </span>
      </div>
    </div>
  );
}
