import { useState, type JSX } from 'react';
import type { AppStore } from '../../store';
import type { ErdNode } from '@canvabase/contracts';

interface ErdTopToolbarProps {
  store: AppStore;
  nodes: ErdNode[];
  selectedTable: string | null;
  onFocusTable: (tableName: string) => void;
  onAutoLayout: () => void;
  onExportPng: () => void;
  isExporting?: boolean;
}

export function ErdTopToolbar({
  store,
  nodes,
  selectedTable,
  onFocusTable,
  onAutoLayout,
  onExportPng,
  isExporting = false,
}: ErdTopToolbarProps): JSX.Element {
  const openTable = store((s) => s.openTable);
  const openDesigner = store((s) => s.openDesigner);
  const newDesigner = store((s) => s.newDesigner);
  const toolbarDisplayStyle = store((s) => s.toolbarDisplayStyle);

  const [query, setQuery] = useState('');

  const showIcon = toolbarDisplayStyle === 'both' || toolbarDisplayStyle === 'icon';
  const showText = toolbarDisplayStyle === 'both' || toolbarDisplayStyle === 'text';

  const handleOpenTable = () => {
    if (!selectedTable) return;
    void openTable(selectedTable);
  };

  const handleDesignTable = () => {
    if (!selectedTable) return;
    void openDesigner(selectedTable);
  };

  const handleNewTable = () => {
    newDesigner();
  };

  const handleDeleteTable = () => {
    if (!selectedTable) return;
    if (confirm(`Are you sure you want to drop table "${selectedTable}"?`)) {
      alert(`Delete table action triggered for: ${selectedTable}`);
    }
  };

  const handleOpenImport = () => {
    alert('Import Wizard: Select file format (CSV/SQL/JSON) to import into table');
  };

  const handleOpenExport = () => {
    alert('Export Wizard: Select format (CSV/SQL/JSON) to export table data');
  };

  return (
    <div className="erd-top-toolbar">
      {/* Title & Target Indicator */}
      <div className="erd-toolbar-brand">
        <span className="erd-brand-icon">📐</span>
        <span className="erd-brand-title">ERD Diagram</span>
        {selectedTable && (
          <span className="erd-selected-tag" title="Selected Table">
            {selectedTable}
          </span>
        )}
      </div>

      {/* Main Action Buttons */}
      <div className="erd-toolbar-actions">
        <button
          className="cb-action-btn"
          disabled={!selectedTable}
          onClick={handleOpenTable}
          title="Open selected table in Data Grid View"
        >
          {showIcon && <span className="cb-btn-icon">📂</span>}
          {showText && <span className="cb-btn-text">Open Table</span>}
        </button>

        <button
          className="cb-action-btn"
          disabled={!selectedTable}
          onClick={handleDesignTable}
          title="Open selected table in Table Designer"
        >
          {showIcon && <span className="cb-btn-icon">🛠️</span>}
          {showText && <span className="cb-btn-text">Design Table</span>}
        </button>

        <button
          className="cb-action-btn"
          onClick={handleNewTable}
          title="Create a new table schema"
        >
          {showIcon && <span className="cb-btn-icon">➕</span>}
          {showText && <span className="cb-btn-text">New Table</span>}
        </button>

        <button
          className="cb-action-btn cb-btn-danger"
          disabled={!selectedTable}
          onClick={handleDeleteTable}
          title="Drop selected table"
        >
          {showIcon && <span className="cb-btn-icon">🗑️</span>}
          {showText && <span className="cb-btn-text">Delete Table</span>}
        </button>

        <div className="cb-divider-sm" />

        <button
          className="cb-action-btn"
          onClick={handleOpenImport}
          title="Launch Data Import Wizard"
        >
          {showIcon && <span className="cb-btn-icon">📥</span>}
          {showText && <span className="cb-btn-text">Import Wizard</span>}
        </button>

        <button
          className="cb-action-btn"
          onClick={handleOpenExport}
          title="Launch Data Export Wizard"
        >
          {showIcon && <span className="cb-btn-icon">📤</span>}
          {showText && <span className="cb-btn-text">Export Wizard</span>}
        </button>

        <div className="cb-divider-sm" />

        {/* Focus Table Search Autocomplete */}
        <div className="erd-search-group">
          <input
            className="cb-input erd-focus-input"
            list="erd-table-autocomplete"
            placeholder="Focus table..."
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              onFocusTable(val);
            }}
          />
          <datalist id="erd-table-autocomplete">
            {nodes.map((n) => (
              <option key={n.id} value={n.name} />
            ))}
          </datalist>
        </div>

        <button className="cb-action-btn" onClick={onAutoLayout} title="Rearrange table nodes">
          {showIcon && <span className="cb-btn-icon">🔄</span>}
          {showText && <span className="cb-btn-text">Auto-layout</span>}
        </button>

        <button
          className="cb-action-btn cb-btn-primary"
          disabled={isExporting}
          onClick={onExportPng}
          title="Export ERD diagram to PNG image"
        >
          {showIcon && <span className="cb-btn-icon">📷</span>}
          {showText && <span className="cb-btn-text">{isExporting ? 'Exporting...' : 'Export PNG'}</span>}
        </button>
      </div>
    </div>
  );
}
