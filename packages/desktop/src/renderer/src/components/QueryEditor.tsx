import { useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent, type MouseEvent } from 'react';
import type { Suggestion } from '@canvabase/contracts';
import type { AppStore } from '../store';
import { highlightSql } from '../lib/sqlHighlighter';
import { validateSql, type SqlDialect, type SqlDiagnostic } from '../lib/sqlValidator';
import { FloatingWindow } from './FloatingWindow';
import { ResultGrid } from './ResultGrid';

const SUGGEST_DEBOUNCE_MS = 120;

interface SuggestionState {
  items: Suggestion[];
  prefix: string;
  active: number;
}

function applySuggestion(
  sql: string,
  position: number,
  suggestion: Suggestion,
): { next: string; newPos: number } {
  const before = sql.slice(0, position);
  const match = /([\w$.]+)$/.exec(before);
  const start = match ? before.length - match[0].length : before.length;
  const replaceText = suggestion.replaceText ?? suggestion.label;
  const next = sql.slice(0, start) + replaceText + sql.slice(position);
  const newPos = start + replaceText.length;
  return { next, newPos };
}

export function QueryEditor({ store }: { store: AppStore }): JSX.Element {
  const tabs = store((s) => s.tabs);
  const activeTabId = store((s) => s.activeTabId);
  const activeConnectionId = store((s) => s.activeConnectionId);
  const connections = store((s) => s.connections);
  const client = store((s) => s.client);
  const runQuery = store((s) => s.runQuery);
  const cancelQuery = store((s) => s.cancelQuery);
  const setSql = store((s) => s.setSql);
  const newTab = store((s) => s.newTab);
  const closeTab = store((s) => s.closeTab);
  const activateTab = store((s) => s.activateTab);
  const renameTab = store((s) => s.renameTab);
  const savedQueries = store((s) => s.savedQueries);
  const loadSavedQueries = store((s) => s.loadSavedQueries);
  const saveQuery = store((s) => s.saveQuery);
  const deleteSavedQuery = store((s) => s.deleteSavedQuery);

  const toolbarDisplayStyle = store((s) => s.toolbarDisplayStyle);
  const showIcon = toolbarDisplayStyle === 'both' || toolbarDisplayStyle === 'icon';
  const showText = toolbarDisplayStyle === 'both' || toolbarDisplayStyle === 'text';

  const tab = (tabs.find((t) => t.id === activeTabId) ?? tabs[0])!;
  const running = tab.running;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggest, setSuggest] = useState<SuggestionState | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [runError, setRunError] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Fullscreen / Detached Floating Window State (Requirement 3.1)
  const [isDetached, setIsDetached] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResultsInDetached, setShowResultsInDetached] = useState(true);
  const [detachedSplitRatio, setDetachedSplitRatio] = useState(48);
  const isResizingDetachedRef = useRef(false);

  const handleSplitMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isResizingDetachedRef.current = true;

    const handleMouseMove = (ev: globalThis.MouseEvent) => {
      if (!isResizingDetachedRef.current) return;
      const container = document.querySelector('.cb-detached-workspace');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(20, Math.min(80, ((ev.clientY - rect.top) / rect.height) * 100));
      setDetachedSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      isResizingDetachedRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Active Connection Dialect
  const activeConn = connections.find((c) => c.id === activeConnectionId);
  const dialect: SqlDialect = (activeConn?.engine as SqlDialect) || 'mysql';

  // Dialect-aware SQL Syntax Validation (Requirement 3.2)
  const diagnostics: SqlDiagnostic[] = useMemo(() => {
    return validateSql(tab.sql, dialect);
  }, [tab.sql, dialect]);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  useEffect(() => {
    void loadSavedQueries();
  }, [loadSavedQueries]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [tab.id]);

  const positionToCoords = (): { top: number; left: number } => {
    const el = textareaRef.current;
    const base = { top: 0, left: 0 };
    if (!el) return base;
    const value = el.value;
    const pos = el.selectionStart ?? 0;
    const before = value.slice(0, pos);
    const lines = before.split('\n');
    const line = lines[lines.length - 1] ?? '';
    const lineHeight = 18;
    const top = (lines.length - 1) * lineHeight + 8;
    const left = line.length * 7.5 + 12;
    return { top, left };
  };

  const triggerSuggest = (sql: string): void => {
    if (!activeConnectionId) return;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const el = textareaRef.current;
      const position = el?.selectionStart ?? sql.length;
      void client.query.suggest({ connectionId: activeConnectionId, sql, position }).then((result) => {
        if (!result.ok || result.data.length === 0) {
          setSuggest(null);
          return;
        }
        const before = sql.slice(0, position);
        const match = /([\w$.]+)$/.exec(before);
        const prefix = match ? (match[0].split('.').pop() ?? '') : '';
        setSuggest({ items: result.data, prefix, active: 0 });
      });
    }, SUGGEST_DEBOUNCE_MS);
  };

  const onChange = (sql: string): void => {
    setSql(sql);
    setSuggest(null);
    setRunError(null);
    triggerSuggest(sql);
  };

  const handleRun = (): void => {
    if (!activeConnectionId) {
      setRunError('⚠️ Please select and connect to a database connection first before running SQL queries.');
      return;
    }
    setRunError(null);
    void runQuery();
  };

  const onSelectSuggestion = (index: number): void => {
    const el = textareaRef.current;
    const position = el?.selectionStart ?? tab.sql.length;
    const item = suggest?.items[index];
    if (!item) return;
    const { next, newPos } = applySuggestion(tab.sql, position, item);
    setSql(next);
    setSuggest(null);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(newPos, newPos);
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
      return;
    }

    if (suggest && suggest.items.length > 0) {
      const el = textareaRef.current;
      const position = el?.selectionStart ?? 0;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggest((s) => (s ? { ...s, active: (s.active + 1) % s.items.length } : s));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggest((s) =>
          s ? { ...s, active: (s.active - 1 + s.items.length) % s.items.length } : s,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const item = suggest.items[suggest.active];
        if (item) {
          e.preventDefault();
          const { next, newPos } = applySuggestion(tab.sql, position, item);
          setSql(next);
          setSuggest(null);
          requestAnimationFrame(() => {
            if (el) {
              el.focus();
              el.setSelectionRange(newPos, newPos);
            }
          });
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggest(null);
      }
    }

    if (e.key === 'Escape') {
      setSavedOpen(false);
    }
  };

  const onSave = async (): Promise<void> => {
    const name = saveName.trim() || tab.title;
    if (await saveQuery(name)) {
      setSaveName('');
      setSavedOpen(false);
    }
  };

  const openTabMenu = (e: MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setTabContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const coords = positionToCoords();
  const highlighted = highlightSql(tab.sql);

  const renderEditorBody = () => (
    <div className={`query-editor ${isDetached ? 'is-detached' : ''}`} onClick={() => setTabContextMenu(null)}>
      {/* Tab Navigation */}
      <div className="query-tabs">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`query-tab${t.id === activeTabId ? ' active' : ''}`}
            onClick={() => activateTab(t.id)}
            onContextMenu={(e) => openTabMenu(e, t.id)}
          >
            {editingTabId === t.id ? (
              <input
                className="query-tab-title-input"
                value={editTitle}
                autoFocus
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => {
                  if (editTitle.trim()) renameTab(t.id, editTitle.trim());
                  setEditingTabId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editTitle.trim()) renameTab(t.id, editTitle.trim());
                    setEditingTabId(null);
                  } else if (e.key === 'Escape') {
                    setEditingTabId(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="query-tab-title"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTabId(t.id);
                  setEditTitle(t.title);
                }}
                title="Double-click or Right-click to Rename Tab"
              >
                {t.title}
              </span>
            )}
            <button
              className="query-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(t.id);
              }}
              aria-label="Close tab"
            >
              ×
            </button>
          </div>
        ))}
        <button className="query-tab-new" onClick={newTab} title="Create New Query Tab">
          +
        </button>

        {/* Fullscreen / Detach / Results Toggle / New Window Buttons in Tab Bar */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8 }}>
          {isDetached && (
            <button
              className={`cb-action-btn ${showResultsInDetached ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: 11 }}
              onClick={() => setShowResultsInDetached((v) => !v)}
              title={showResultsInDetached ? 'Hide Result Grid (Full Height Editor)' : 'Show Live Query Results Grid'}
            >
              {showResultsInDetached ? '🗖 Hide Results' : '📊 Show Results'}
            </button>
          )}
          <button
            className="cb-action-btn"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => {
              void client.window?.openPopout({
                type: 'query',
                title: tab.title,
                connectionId: activeConnectionId || '',
                tabId: tab.id,
                sql: tab.sql,
              });
            }}
            title="Open in a Separate Real Native OS Window (Taskbar Separated / Monitor 2)"
          >
            🗗 New Window
          </button>
          <button
            className="cb-action-btn"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={() => {
              setIsDetached((v) => !v);
              setIsFullscreen(true);
            }}
            title={isDetached ? 'Dock back to main GUI layout' : 'Maximize / Fullscreen In-App'}
          >
            {isDetached ? '🗗 Dock' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      {/* Code Textarea & Autocomplete */}
      <div
        className="sql-editor-wrap"
        style={
          isDetached
            ? {
                flex: 1,
                minHeight: 140,
                height: '100%',
                maxHeight: 'none',
                display: 'flex',
                flexDirection: 'column',
              }
            : undefined
        }
      >
        <pre className="sql-highlight" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlighted }} />
        <textarea
          ref={textareaRef}
          className="sql-input"
          style={isDetached ? { flex: 1, height: '100%', maxHeight: 'none', resize: 'none' } : undefined}
          value={tab.sql}
          placeholder="-- Type your SQL query here (e.g. SELECT * FROM users LIMIT 100;)"
          spellCheck={false}
          disabled={false}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => onKeyDown(e)}
          onScroll={() => {
            const el = textareaRef.current;
            const pre = el?.parentElement?.querySelector('.sql-highlight');
            if (el && pre) {
              pre.scrollTop = el.scrollTop;
              pre.scrollLeft = el.scrollLeft;
            }
          }}
        />
        {suggest && suggest.items.length > 0 && (
          <div className="suggest-popup" style={{ top: coords.top + 28, left: coords.left }}>
            {suggest.items.map((item, index) => (
              <button
                key={`${item.kind}-${item.label}-${index}`}
                className={`suggest-item${index === suggest.active ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectSuggestion(index);
                }}
              >
                <span className={`suggest-kind suggest-${item.kind}`}>{item.kind}</span>
                <span className="suggest-label">{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Real-Time SQL Dialect Syntax Diagnostics Bar (Requirement 3.2) */}
      <div className="sql-diagnostics-bar">
        <div className="sql-diag-summary">
          <span className="sql-dialect-tag" title="Target Database Dialect">
            {dialect}
          </span>
          {errorCount > 0 ? (
            <span className="sql-diag-badge is-error">
              ❌ {errorCount} Error{errorCount > 1 ? 's' : ''}
            </span>
          ) : warningCount > 0 ? (
            <span className="sql-diag-badge is-warning">
              ⚠️ {warningCount} Warning{warningCount > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="sql-diag-badge is-ok">
              ✓ Syntax Valid
            </span>
          )}
          {diagnostics.length > 0 && (
            <span className="sql-diag-msg-preview" title={diagnostics[0]?.message}>
              Ln {diagnostics[0]?.line}, Col {diagnostics[0]?.column}: {diagnostics[0]?.message}
            </span>
          )}
        </div>
        <span className="text-xs text-muted">
          {tab.sql.length} chars | {tab.sql.split('\n').length} lines
        </span>
      </div>

      {runError && <div className="cb-alert cb-alert-warn">{runError}</div>}

      {/* Query Bar Actions */}
      <div className={`query-actions toolbar-style-${toolbarDisplayStyle}`}>
        <button
          className="cb-action-btn cb-action-btn-primary"
          disabled={running || tab.sql.trim().length === 0}
          onClick={handleRun}
          title="Run Query (Ctrl+Enter)"
        >
          {showIcon && (
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          )}
          {showText && <span>{running ? 'Running…' : 'Run Query'}</span>}
        </button>

        <button
          className="cb-action-btn cb-action-btn-danger"
          disabled={!running}
          onClick={() => void cancelQuery()}
          title="Stop Execution"
        >
          {showIcon && (
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="1.5"></rect></svg>
          )}
          {showText && <span>Stop</span>}
        </button>

        <button
          className="cb-action-btn"
          onClick={() => void onSave()}
          disabled={tab.sql.trim().length === 0}
          title="Save Query Snippet"
        >
          {showIcon && (
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          )}
          {showText && <span>Save Snippet</span>}
        </button>

        <button
          className={`cb-action-btn ${savedOpen ? 'active' : ''}`}
          onClick={() => setSavedOpen((v) => !v)}
          title="Saved Query Snippets"
        >
          {showIcon && (
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          )}
          {showText && <span>Saved Queries</span>}
        </button>

        <span className="keyboard-hint">Shortcut: Ctrl/⌘ + Enter to execute | Tab / Enter for Autocomplete</span>
      </div>

      {/* Saved Snippets */}
      {savedOpen && (
        <div className="saved-panel">
          <div className="saved-save-row">
            <input
              className="cb-input"
              placeholder="Query name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSave();
              }}
            />
            <button className="cb-button cb-button-primary" onClick={() => void onSave()}>
              Save Snippet
            </button>
          </div>
          <div className="saved-list">
            {savedQueries.length === 0 && <div className="empty-hint">No saved queries yet</div>}
            {savedQueries.map((q) => (
              <div key={q.id} className="saved-item">
                <button
                  className="saved-item-load"
                  onClick={() => {
                    setSql(q.sql);
                    setSavedOpen(false);
                  }}
                >
                  <span className="saved-item-name">{q.name}</span>
                  <span className="saved-item-preview">{q.sql.slice(0, 40)}</span>
                </button>
                <button
                  className="saved-item-delete"
                  onClick={() => void deleteSavedQuery(q.id)}
                  aria-label={`Delete ${q.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context Menu for Tabs */}
      {tabContextMenu && (
        <div
          className="cb-context-menu"
          style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="cb-context-item"
            onClick={() => {
              const targetTab = tabs.find((t) => t.id === tabContextMenu.tabId);
              if (targetTab) {
                setEditingTabId(targetTab.id);
                setEditTitle(targetTab.title);
              }
              setTabContextMenu(null);
            }}
          >
            ✏️ Rename Query Tab
          </button>
          <button
            className="cb-context-item"
            onClick={() => {
              newTab();
              setTabContextMenu(null);
            }}
          >
            ➕ New Query Tab
          </button>
          <button
            className="cb-context-item cb-context-danger"
            onClick={() => {
              closeTab(tabContextMenu.tabId);
              setTabContextMenu(null);
            }}
          >
            ❌ Close Tab
          </button>
        </div>
      )}
    </div>
  );

  if (isDetached) {
    return (
      <FloatingWindow
        title={`SQL Query Workspace — ${tab.title}`}
        icon="📝"
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((v) => !v)}
        onDock={() => {
          setIsDetached(false);
          setIsFullscreen(false);
        }}
        initialWidth={1080}
        initialHeight={720}
      >
        <div className="cb-detached-workspace">
          <div
            style={{
              flex: showResultsInDetached ? `0 0 ${detachedSplitRatio}%` : '1 1 100%',
              minHeight: 140,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {renderEditorBody()}
          </div>

          {showResultsInDetached && (
            <>
              <div
                className="cb-detached-split-handle"
                onMouseDown={handleSplitMouseDown}
                title="Drag vertically to resize Editor / Results split"
              />
              <div className="cb-detached-result-wrap">
                <ResultGrid store={store} />
              </div>
            </>
          )}
        </div>
      </FloatingWindow>
    );
  }

  return renderEditorBody();
}
