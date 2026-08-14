import type { JSX } from 'react';
import type { AppStore } from '../store';

export function StatusBar({ store }: { store: AppStore }): JSX.Element {
  const tabs = store((s) => s.tabs);
  const activeTabId = store((s) => s.activeTabId);
  const connections = store((s) => s.connections);
  const activeView = store((s) => s.activeView);
  const selectedTarget = store((s) => s.selectedTarget);
  const gridDisplayMode = store((s) => s.gridDisplayMode);
  const setGridDisplayMode = store((s) => s.setGridDisplayMode);
  const objectViewMode = store((s) => s.objectViewMode);
  const setObjectViewMode = store((s) => s.setObjectViewMode);

  const setGridPageSize = store((s) => s.setGridPageSize);
  const firstGridPage = store((s) => s.firstGridPage);
  const prevGridPage = store((s) => s.prevGridPage);
  const nextGridPage = store((s) => s.nextGridPage);
  const lastGridPage = store((s) => s.lastGridPage);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const running = activeTab?.running ?? false;
  const connected = connections.filter((c) => c.status === 'connected').length;

  const totalRows = activeTab?.rows.length ?? 0;
  const page = activeTab?.page || 1;
  const pageSize = activeTab?.pageSize || 500;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIndex = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(totalRows, page * pageSize);

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item">
          <span className={`status-dot ${running ? 'running' : connected > 0 ? 'connected' : ''}`} />
          <span>{running ? 'Running…' : connected > 0 ? `${connected} connected` : 'Ready'}</span>
        </span>
        {activeTab?.table && activeView === 'query' && (
          <span className="status-item font-medium">
            <span>Table:</span> <span className="highlight-text">{activeTab.table}</span>
          </span>
        )}
        {selectedTarget && activeView !== 'query' && (
          <span className="status-item font-medium">
            <span>Selected:</span> <span className="highlight-text">{selectedTarget.name}</span>{' '}
            <span className="text-muted text-xs">({selectedTarget.type})</span>
          </span>
        )}
      </div>

      <div className="status-right">
        {activeView === 'query' && (
          <>
            {/* Record Position Indicator */}
            <span className="status-item status-record-indicator">
              {totalRows > 0
                ? `${startIndex.toLocaleString()} - ${endIndex.toLocaleString()} of ${totalRows.toLocaleString()} rows`
                : '0 Records'}
            </span>

            {/* Pagination Controls */}
            <div className="status-pagination">
              <button
                className="status-page-btn"
                title="First Page"
                disabled={page <= 1 || totalRows === 0}
                onClick={firstGridPage}
              >
                ⏮️
              </button>
              <button
                className="status-page-btn"
                title="Previous Page"
                disabled={page <= 1 || totalRows === 0}
                onClick={prevGridPage}
              >
                ◀️
              </button>
              <span className="status-page-label">
                {page} / {totalPages}
              </span>
              <button
                className="status-page-btn"
                title="Next Page"
                disabled={page >= totalPages || totalRows === 0}
                onClick={nextGridPage}
              >
                ▶️
              </button>
              <button
                className="status-page-btn"
                title="Last Page"
                disabled={page >= totalPages || totalRows === 0}
                onClick={lastGridPage}
              >
                ⏭️
              </button>
            </div>

            {/* Page Size Selector */}
            <div className="status-pagesize">
              <select
                className="cb-select status-pagesize-select"
                value={pageSize}
                onChange={(e) => setGridPageSize(Number(e.target.value))}
                title="Rows per page"
              >
                <option value={100}>100 / page</option>
                <option value={200}>200 / page</option>
                <option value={500}>500 / page</option>
                <option value={1000}>1000 / page</option>
                <option value={5000}>5000 / page</option>
              </select>
            </div>

            <div className="cb-divider-sm" />

            {/* Grid View vs Form View Toggle */}
            <div className="status-view-toggle">
              <button
                className={`status-toggle-btn ${gridDisplayMode === 'grid' ? 'active' : ''}`}
                onClick={() => setGridDisplayMode('grid')}
                title="Grid View (Table Format)"
              >
                📊 Grid
              </button>
              <button
                className={`status-toggle-btn ${gridDisplayMode === 'form' ? 'active' : ''}`}
                onClick={() => setGridDisplayMode('form')}
                title="Form View (Single Record Format)"
              >
                📋 Form
              </button>
            </div>
          </>
        )}

        {activeView === 'database' && (
          <div className="status-view-toggle">
            <button
              className={`status-toggle-btn ${objectViewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setObjectViewMode('cards')}
              title="Card Grid View"
            >
              🎴 Cards
            </button>
            <button
              className={`status-toggle-btn ${objectViewMode === 'list' ? 'active' : ''}`}
              onClick={() => setObjectViewMode('list')}
              title="Dense List View"
            >
              📋 List
            </button>
            <button
              className={`status-toggle-btn ${objectViewMode === 'details' ? 'active' : ''}`}
              onClick={() => setObjectViewMode('details')}
              title="Details Table View"
            >
              📑 Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

