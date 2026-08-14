import { useEffect, useMemo, useRef, useState, type JSX, type MouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ExportFormat } from '@canvabase/contracts';
import { filterRows, sortRows, stringifyCell } from '../lib/gridOps';
import type { AppStore } from '../store';

const ROW_HEIGHT = 28;
const OVERSCAN = 10;

interface EditingCell {
  rowIndex: number;
  column: string;
  value: string;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return JSON.stringify(value);
}

export function ResultGrid({ store }: { store: AppStore }): JSX.Element {
  const tabs = store((s) => s.tabs);
  const activeTabId = store((s) => s.activeTabId);
  const setSort = store((s) => s.setSort);
  const setFilter = store((s) => s.setFilter);
  const updateCell = store((s) => s.updateCell);
  const deleteRowAt = store((s) => s.deleteRowAt);
  const insertRow = store((s) => s.insertRow);
  const openDesigner = store((s) => s.openDesigner);
  const newDesigner = store((s) => s.newDesigner);
  const setActiveView = store((s) => s.setActiveView);
  const exportTable = store((s) => s.exportTable);
  const importData = store((s) => s.importData);
  const transfer = store((s) => s.transfer);
  const [transferFormat, setTransferFormat] = useState<ExportFormat>('csv');
  const [importReplace, setImportReplace] = useState(false);
  const gridDisplayMode = store((s) => s.gridDisplayMode);
  const [formRowIdx, setFormRowIdx] = useState(0);

  const tab = (tabs.find((t) => t.id === activeTabId) ?? tabs[0])!;
  const { columns, rows, hasMore, running, error, table, schema, sort, filters } = tab;
  const parentRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const lastSelectedIdxRef = useRef<number | null>(null);

  const page = tab.page || 1;
  const pageSize = tab.pageSize || 500;

  useEffect(() => {
    setSelectedRows(new Set());
    lastSelectedIdxRef.current = null;
  }, [activeTabId]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIndex: number;
    column: string;
    value: unknown;
    row: Record<string, unknown>;
  } | null>(null);

  const editable = table !== null && schema.length > 0;
  const hasPk = schema.some((c) => c.primaryKey);
  const newRowEnabled = editable && hasPk && adding;

  const columnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    for (const col of columns) {
      let maxLen = col.name.length;
      for (let i = 0; i < Math.min(30, rows.length); i++) {
        const val = rows[i]?.[col.name];
        if (val !== null && val !== undefined) {
          const str = stringifyCell(val);
          if (str.length > maxLen) maxLen = str.length;
        }
      }
      widths[col.name] = Math.max(140, Math.min(450, maxLen * 9 + 40));
    }
    return widths;
  }, [columns, rows]);

  const totalGridWidth = useMemo(() => {
    return (
      (editable ? 32 : 0) +
      columns.reduce((acc, col) => acc + (columnWidths[col.name] ?? 140), 0)
    );
  }, [columns, columnWidths, editable]);

  const visibleRows = useMemo(
    () => filterRows(sortRows(rows, sort), filters),
    [rows, sort, filters],
  );

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(visibleRows.length, page * pageSize);

  const pagedRows = useMemo(() => {
    return visibleRows.slice(startIndex, endIndex);
  }, [visibleRows, startIndex, endIndex]);

  const rowVirtualizer = useVirtualizer({
    count: pagedRows.length + 2 + (newRowEnabled ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => (index === 0 || index === 1 ? 32 : ROW_HEIGHT),
    overscan: OVERSCAN,
  });

  // Auto-fetch scroll listener removed in favor of manual pagination footer controls

  useEffect(() => {
    rowVirtualizer.measure();
  }, [columns, tabs, activeTabId, rowVirtualizer, newRowEnabled]);

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
  }, [editing]);

  const commitEdit = (): void => {
    if (!editing) return;
    const { rowIndex, column, value } = editing;
    const row = rows[rowIndex];
    if (!row) return;
    const raw = row[column];
    const current = raw === null || raw === undefined ? '' : stringifyCell(raw);
    if (current.trim() !== value.trim()) {
      void updateCell(rowIndex, column, value);
    }
    setEditing(null);
  };

  const startEdit = (rowIndex: number, column: string): void => {
    if (!editable || !hasPk) return;
    const row = rows[rowIndex];
    if (!row) return;
    setEditing({ rowIndex, column, value: formatCell(row[column]) });
  };

  const handleCellContextMenu = (
    e: MouseEvent,
    rowIndex: number,
    column: string,
    value: unknown,
    row: Record<string, unknown>,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, rowIndex, column, value, row });
  };

  const copyAsInsertSql = (row: Record<string, unknown>) => {
    const tableName = table || 'table';
    const cols = columns.map((c) => `"${c.name}"`).join(', ');
    const vals = columns
      .map((c) => {
        const v = row[c.name];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number' || typeof v === 'boolean') return String(v);
        const valStr = stringifyCell(v);
        return `'${valStr.replace(/'/g, "''")}'`;
      })
      .join(', ');
    return `INSERT INTO "${tableName}" (${cols}) VALUES (${vals});`;
  };

  const copyAsUpdateSql = (row: Record<string, unknown>) => {
    const tableName = table || 'table';
    const sets = columns
      .map((c) => {
        const v = row[c.name];
        const rawStr =
          v === null || v === undefined
            ? 'NULL'
            : typeof v === 'number' || typeof v === 'boolean'
              ? String(v)
              : stringifyCell(v);
        const valStr = rawStr === 'NULL' ? rawStr : `'${rawStr.replace(/'/g, "''")}'`;
        return `"${c.name}" = ${valStr}`;
      })
      .join(', ');

    const pkCols = schema.filter((s) => s.primaryKey);
    let whereClause = '';
    if (pkCols.length > 0) {
      whereClause =
        ' WHERE ' +
        pkCols
          .map((pk) => {
            const v = row[pk.name];
            return `"${pk.name}" = ${typeof v === 'number' ? v : `'${String(v)}'`}`;
          })
          .join(' AND ');
    }
    return `UPDATE "${tableName}" SET ${sets}${whereClause};`;
  };

  const commitNewRow = (): void => {
    const values: Array<{ column: string; value: string }> = [];
    for (const c of columns) {
      const col = schema.find((s) => s.name === c.name);
      const value = newRow[c.name];
      if (col && !col.autoIncrement && value !== undefined && value.trim().length > 0) {
        values.push({ column: c.name, value });
      }
    }
    if (values.length === 0) {
      setNewRow({});
      setAdding(false);
      return;
    }
    void insertRow(values);
    setNewRow({});
    setAdding(false);
  };

  const sortHeader = (column: string): string => {
    if (sort?.column !== column) return '';
    return sort.direction === 'asc' ? ' ↑' : ' ↓';
  };

  if (error) return <div className="result-error">{error}</div>;
  if (columns.length === 0 && !running) {
    return <div className="result-empty">Run a query to see results</div>;
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="result-grid" onClick={() => setContextMenu(null)}>
      {gridDisplayMode === 'form' ? (
        <div className="cb-form-view-container">
          <div className="cb-form-view-header">
            <div className="cb-form-nav">
              <button
                className="cb-button cb-btn-sm"
                disabled={formRowIdx <= 0}
                onClick={() => setFormRowIdx(0)}
                title="First Record"
              >
                ⏮️ First
              </button>
              <button
                className="cb-button cb-btn-sm"
                disabled={formRowIdx <= 0}
                onClick={() => setFormRowIdx((i) => Math.max(0, i - 1))}
                title="Previous Record"
              >
                ◀️ Previous
              </button>
              <span className="cb-form-record-label">
                Record <strong className="highlight-text">{visibleRows.length > 0 ? formRowIdx + 1 : 0}</strong> of <strong>{visibleRows.length.toLocaleString()}</strong>
              </span>
              <button
                className="cb-button cb-btn-sm"
                disabled={formRowIdx >= visibleRows.length - 1}
                onClick={() => setFormRowIdx((i) => Math.min(visibleRows.length - 1, i + 1))}
                title="Next Record"
              >
                Next ▶️
              </button>
              <button
                className="cb-button cb-btn-sm"
                disabled={formRowIdx >= visibleRows.length - 1}
                onClick={() => setFormRowIdx(visibleRows.length - 1)}
                title="Last Record"
              >
                Last ⏭️
              </button>
            </div>
            {table && <span className="active-badge font-bold">Table: {table}</span>}
          </div>

          {visibleRows.length === 0 ? (
            <div className="result-empty">No records to display in Form View</div>
          ) : (
            <div className="cb-form-card">
              {columns.map((col) => {
                const currentRow = visibleRows[formRowIdx] || {};
                const val = currentRow[col.name];
                const colSchema = schema.find((s) => s.name === col.name);

                return (
                  <div key={col.name} className="cb-form-field-row">
                    <label className="cb-form-field-label">
                      {colSchema?.primaryKey && <span className="pk-badge">🔑 </span>}
                      {col.name}
                      <span className="cb-form-field-type font-mono">({colSchema?.type || 'text'})</span>
                    </label>
                    <input
                      className="cb-input cb-form-field-input"
                      value={formatCell(val)}
                      readOnly={!editable}
                      onChange={(e) => {
                        if (editable) {
                          void updateCell(formRowIdx, col.name, e.target.value);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="result-header">
            <span className="row-count">
              {rows.length.toLocaleString()} rows{hasMore ? ' (fetching more…)' : ''}
            </span>
        {editable && (
          <>
            <span className="table-name">{table}</span>
            <button className="cb-button" onClick={() => {
              void openDesigner(table);
              setActiveView('designer');
            }}>
              Design
            </button>
            <button className="cb-button" onClick={() => {
              newDesigner();
              setActiveView('designer');
            }}>
              + New Table
            </button>
            {hasPk ? (
              <button className="cb-button cb-button-primary" onClick={() => setAdding((a) => !a)}>
                + Add row
              </button>
            ) : null}
          </>
        )}
        {editable && (
          <span className="transfer-group">
            <select
              className="cb-select"
              value={transferFormat}
              onChange={(e) => setTransferFormat(e.target.value as ExportFormat)}
              title="Format export/import"
            >
              <option value="csv">CSV</option>
              <option value="sql">SQL</option>
              <option value="json">JSON</option>
            </select>
            <button
              className="cb-button"
              disabled={transfer.active || columns.length === 0}
              onClick={() => void exportTable(transferFormat)}
            >
              Export
            </button>
            <button className="cb-button" disabled={transfer.active} onClick={() => void importData(transferFormat, importReplace ? 'replace' : 'insert')}>
              Import
            </button>
            <label className="cb-check" title="Replace existing rows instead of inserting">
              <input type="checkbox" checked={importReplace} onChange={(e) => setImportReplace(e.target.checked)} />
              replace
            </label>
          </span>
        )}
        {transfer.active && (
          <span className="transfer-status" data-direction={transfer.direction ?? undefined}>
            {transfer.direction === 'export' ? 'Exporting' : 'Importing'} ({transfer.format?.toUpperCase()}) —{' '}
            {(transfer.processed ?? 0).toLocaleString()}
            {transfer.total != null ? ` / ${transfer.total.toLocaleString()}` : ''} rows…
          </span>
        )}
        {transfer.error && <span className="transfer-status transfer-error">{transfer.error}</span>}
      </div>
      <div className="grid-scroller" ref={parentRef}>
        <div
          className="grid-canvas"
          style={{ height: rowVirtualizer.getTotalSize(), width: Math.max(totalGridWidth, parentRef.current?.clientWidth ?? 0) }}
        >
          {virtualItems.map((virtualRow) => {
            const idx = virtualRow.index;
            if (idx === 0) {
              return (
                <div
                  key="header"
                  className="grid-row grid-header"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                >
                  {editable && <span className="grid-cell header-cell row-handle" style={{ width: 32, minWidth: 32, maxWidth: 32 }} />}
                  {columns.map((col) => {
                    const w = columnWidths[col.name] ?? 140;
                    return (
                      <span
                        key={col.name}
                        className={`grid-cell header-cell${sort?.column === col.name ? ' sorted' : ''}`}
                        style={{ width: w, minWidth: w, maxWidth: w }}
                        title={col.type}
                        onClick={() => setSort(col.name)}
                      >
                        {col.name}
                        {sortHeader(col.name)}
                      </span>
                    );
                  })}
                </div>
              );
            }
            if (idx === 1) {
              return (
                <div
                  key="filter-row"
                  className="grid-row grid-filter"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                >
                  {editable && <span className="grid-cell row-handle" style={{ width: 32, minWidth: 32, maxWidth: 32 }} />}
                  {columns.map((col) => {
                    const w = columnWidths[col.name] ?? 140;
                    return (
                      <input
                        key={col.name}
                        className="grid-cell filter-cell"
                        style={{ width: w, minWidth: w, maxWidth: w }}
                        placeholder="filter…"
                        value={filters[col.name] ?? ''}
                        onChange={(e) => setFilter(col.name, e.target.value)}
                      />
                    );
                  })}
                </div>
              );
            }
            const rowIndex = idx - 2;
            if (rowIndex === visibleRows.length) {
              return (
                <div
                  key="new-row"
                  className="grid-row new-row"
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                >
                  {editable && <span className="grid-cell row-handle" style={{ width: 32, minWidth: 32, maxWidth: 32 }}>+</span>}
                  {columns.map((col) => {
                    const w = columnWidths[col.name] ?? 140;
                    const meta = schema.find((s) => s.name === col.name);
                    const disabled = !meta || meta.autoIncrement || meta.primaryKey;
                    return (
                      <input
                        key={col.name}
                        className="grid-cell new-cell"
                        style={{ width: w, minWidth: w, maxWidth: w }}
                        disabled={disabled}
                        placeholder={disabled ? '' : '…'}
                        value={newRow[col.name] ?? ''}
                        onChange={(e) => setNewRow((prev) => ({ ...prev, [col.name]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitNewRow();
                        }}
                      />
                    );
                  })}
                </div>
              );
            }
            const row = pagedRows[rowIndex];
            if (!row) return null;
            const actualIndex = rows.indexOf(row);
            const isRowSelected = selectedRows.has(actualIndex);

            const handleRowClick = (e: MouseEvent) => {
              if ((e.target as HTMLElement).tagName === 'INPUT' || editing) return;
              setSelectedRows((prev) => {
                const next = new Set(prev);
                if (e.ctrlKey || e.metaKey) {
                  if (next.has(actualIndex)) {
                    next.delete(actualIndex);
                  } else {
                    next.add(actualIndex);
                  }
                  lastSelectedIdxRef.current = actualIndex;
                } else if (e.shiftKey && lastSelectedIdxRef.current !== null) {
                  const start = Math.min(lastSelectedIdxRef.current, actualIndex);
                  const end = Math.max(lastSelectedIdxRef.current, actualIndex);
                  next.clear();
                  for (let i = start; i <= end; i++) {
                    next.add(i);
                  }
                } else {
                  next.clear();
                  next.add(actualIndex);
                  lastSelectedIdxRef.current = actualIndex;
                }
                return next;
              });
            };

            return (
              <div
                key={virtualRow.key}
                className={`grid-row${isRowSelected ? ' selected-row' : ''}`}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                onClick={handleRowClick}
              >
                {editable && (
                  <span
                    className="grid-cell row-handle"
                    style={{ width: 32, minWidth: 32, maxWidth: 32 }}
                    onClick={() => {
                      if (hasPk && window.confirm(`Delete this row from ${table}?`)) {
                        void deleteRowAt(actualIndex);
                      }
                    }}
                    title={hasPk ? 'Delete row' : ''}
                  >
                    ✕
                  </span>
                )}
                {columns.map((col) => {
                  const w = columnWidths[col.name] ?? 140;
                  const isEditing =
                    editing?.rowIndex === actualIndex && editing.column === col.name;
                  const meta = schema.find((s) => s.name === col.name);
                  if (isEditing) {
                    return (
                      <input
                        key={col.name}
                        ref={editInputRef}
                        className="grid-cell editing-cell"
                        style={{ width: w, minWidth: w, maxWidth: w }}
                        value={editing.value}
                        onChange={(e) => setEditing((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    );
                  }
                  return (
                    <span
                      key={col.name}
                      className={`grid-cell${meta?.primaryKey ? ' pk-cell' : ''}`}
                      style={{ width: w, minWidth: w, maxWidth: w }}
                      onDoubleClick={() => startEdit(actualIndex, col.name)}
                      onContextMenu={(e) => handleCellContextMenu(e, actualIndex, col.name, row?.[col.name], row)}
                      title={editable && hasPk ? 'Double-click to edit | Right-click for options' : 'Right-click for options'}
                    >
                      {formatCell(row?.[col.name])}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Cell / Row Context Menu */}
      {contextMenu && (
        <div
          className="cb-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="cb-context-item"
            onClick={() => {
              void navigator.clipboard.writeText(formatCell(contextMenu.value));
              setContextMenu(null);
            }}
          >
            📋 Copy Cell Value
          </button>
          <button
            className="cb-context-item"
            onClick={() => {
              const tsv = columns.map((c) => formatCell(contextMenu.row[c.name])).join('\t');
              void navigator.clipboard.writeText(tsv);
              setContextMenu(null);
            }}
          >
            📄 Copy Entire Row (TSV)
          </button>
          <button
            className="cb-context-item"
            onClick={() => {
              const insertSql = copyAsInsertSql(contextMenu.row);
              void navigator.clipboard.writeText(insertSql);
              setContextMenu(null);
            }}
          >
            📝 Copy Row as SQL INSERT
          </button>
          <button
            className="cb-context-item"
            onClick={() => {
              const updateSql = copyAsUpdateSql(contextMenu.row);
              void navigator.clipboard.writeText(updateSql);
              setContextMenu(null);
            }}
          >
            📝 Copy Row as SQL UPDATE
          </button>
          <button
            className="cb-context-item"
            onClick={() => {
              void navigator.clipboard.writeText(contextMenu.column);
              setContextMenu(null);
            }}
          >
            🏷️ Copy Column Name ({contextMenu.column})
          </button>
          {editable && hasPk && (
            <button
              className="cb-context-item cb-context-danger"
              onClick={() => {
                void (async () => {
                  const count = selectedRows.size > 0 ? selectedRows.size : 1;
                  if (window.confirm(`Delete ${count} row(s) from ${table} permanently?`)) {
                    const targets = selectedRows.size > 0 ? Array.from(selectedRows) : [contextMenu.rowIndex];
                    const sortedTargets = [...targets].sort((a, b) => b - a);
                    for (const idx of sortedTargets) {
                      await deleteRowAt(idx);
                    }
                    setSelectedRows(new Set());
                  }
                  setContextMenu(null);
                })();
              }}
            >
              🗑️ Delete {selectedRows.size > 1 ? `${selectedRows.size} Selected Rows` : 'Row'}
            </button>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
