import { useState, type JSX } from 'react';
import type { DesignerColumn, TableDraft } from '@canvabase/contracts';
import type { AppStore } from '../store';

function splitColumns(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function TableDesigner({ store }: { store: AppStore }): JSX.Element {
  const designer = store((s) => s.designer);
  const updateDraft = store((s) => s.updateDesignerDraft);
  const previewDdl = store((s) => s.previewDesignerDdl);
  const applyDesigner = store((s) => s.applyDesigner);
  const dropDesignerTable = store((s) => s.dropDesignerTable);
  const closeDesigner = store((s) => s.closeDesigner);
  const designerSection = store((s) => s.designerSection);
  const setDesignerSection = store((s) => s.setDesignerSection);
  const [busy, setBusy] = useState(false);

  if (!designer.open) return <></>;
  if (designer.loading) {
    return <div className="designer-panel designer-empty">Loading table definition…</div>;
  }
  const draft = designer.draft;
  if (!draft) {
    return (
      <div className="designer-panel">
        <div className="designer-empty">{designer.error ?? 'Table definition unavailable'}</div>
        <div className="designer-toolbar">
          <button className="cb-button" onClick={closeDesigner}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const creating = designer.creating;

  const setDraft = (next: TableDraft): void => updateDraft(next);

  const setCol = (index: number, patch: Partial<DesignerColumn>): void => {
    setDraft({
      ...draft,
      columns: draft.columns.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });
  };

  const addCol = (): void => {
    setDraft({
      ...draft,
      columns: [
        ...draft.columns,
        {
          name: '',
          type: 'TEXT',
          nullable: true,
          default: null,
          autoIncrement: false,
          isPrimaryKey: false,
        },
      ],
    });
  };

  const removeCol = (index: number): void => {
    setDraft({ ...draft, columns: draft.columns.filter((_, i) => i !== index) });
  };

  const runApply = async (): Promise<void> => {
    setBusy(true);
    await applyDesigner();
    setBusy(false);
  };

  const runDrop = async (): Promise<void> => {
    if (!window.confirm(`Drop table ${draft.name} permanently?`)) return;
    setBusy(true);
    await dropDesignerTable();
    setBusy(false);
  };

  return (
    <div className="designer-panel">
      <div className="designer-toolbar">
        <span className="designer-title">{creating ? 'New table' : draft.name}</span>
        
        {/* Designer Section Navigation Tabs */}
        <div className="designer-nav-tabs">
          <button
            className={`designer-tab-btn ${designerSection === 'columns' ? 'active' : ''}`}
            onClick={() => setDesignerSection('columns')}
          >
            🏷️ Fields ({draft.columns.length})
          </button>
          <button
            className={`designer-tab-btn ${designerSection === 'indexes' ? 'active' : ''}`}
            onClick={() => setDesignerSection('indexes')}
          >
            ⚡ Indexes ({draft.indexes.length})
          </button>
          <button
            className={`designer-tab-btn ${designerSection === 'foreignKeys' ? 'active' : ''}`}
            onClick={() => setDesignerSection('foreignKeys')}
          >
            🔗 Foreign Keys ({draft.foreignKeys.length})
          </button>
        </div>

        <button
          className="cb-button"
          disabled={busy || !draft.name}
          onClick={() => void previewDdl()}
        >
          Preview DDL
        </button>
        {creating ? (
          <button
            className="cb-button cb-button-primary"
            disabled={busy || draft.name.trim().length === 0 || draft.columns.length === 0}
            onClick={() => void runApply()}
          >
            Create table
          </button>
        ) : (
          <>
            <span className="designer-note">Edit existing table (ALTER) — v1.1</span>
            <button className="cb-button danger" disabled={busy} onClick={() => void runDrop()}>
              Drop
            </button>
          </>
        )}
        <button className="cb-button" disabled={busy} onClick={closeDesigner}>
          Close
        </button>
      </div>

      {designer.error && <div className="error-banner">{designer.error}</div>}

      <div className="designer-body">
        <div className="designer-left">
          {creating && (
            <div className="designer-name-row">
              <label className="designer-label">Table name</label>
              <input
                className="cb-input"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
          )}

          {designerSection === 'columns' && (
            <div className="designer-section">
              <div className="designer-section-head">
                <span className="designer-label">Columns (Fields)</span>
                {creating && (
                  <button className="cb-button" onClick={addCol}>
                    + Add column
                  </button>
                )}
              </div>
              <div className="designer-cols">
                <div className="designer-cols-head">
                  <span>Name</span>
                  <span>Type</span>
                  <span>Default</span>
                  <span>Null</span>
                  <span>AI</span>
                  <span>PK</span>
                  <span />
                </div>
                {draft.columns.map((col, i) => (
                  <div className="designer-cols-row" key={i}>
                    <input
                      className="cb-input"
                      value={col.name}
                      disabled={!creating}
                      onChange={(e) => setCol(i, { name: e.target.value })}
                    />
                    <input
                      className="cb-input"
                      value={col.type}
                      disabled={!creating}
                      onChange={(e) => setCol(i, { type: e.target.value })}
                    />
                    <input
                      className="cb-input"
                      value={col.default ?? ''}
                      disabled={!creating}
                      placeholder="NULL"
                      onChange={(e) =>
                        setCol(i, { default: e.target.value.length > 0 ? e.target.value : null })
                      }
                    />
                    <input
                      type="checkbox"
                      checked={col.nullable}
                      disabled={!creating}
                      onChange={(e) => setCol(i, { nullable: e.target.checked })}
                    />
                    <input
                      type="checkbox"
                      checked={col.autoIncrement}
                      disabled={!creating}
                      onChange={(e) => setCol(i, { autoIncrement: e.target.checked })}
                    />
                    <input
                      type="checkbox"
                      checked={col.isPrimaryKey}
                      disabled={!creating}
                      onChange={(e) => setCol(i, { isPrimaryKey: e.target.checked })}
                    />
                    {creating && (
                      <button className="designer-remove" onClick={() => removeCol(i)}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {designerSection === 'indexes' && (
            <IndexEditor draft={draft} setDraft={setDraft} creating={creating} />
          )}

          {designerSection === 'foreignKeys' && (
            <FkEditor draft={draft} setDraft={setDraft} creating={creating} />
          )}
        </div>

        <div className="designer-right">
          <div className="designer-label">DDL Preview</div>
          <pre className="ddl-preview">{designer.preview ?? 'Edit lalu klik Preview DDL…'}</pre>
        </div>
      </div>
    </div>
  );
}

function IndexEditor({
  draft,
  setDraft,
  creating = false,
}: {
  draft: TableDraft;
  setDraft: (draft: TableDraft) => void;
  creating?: boolean;
}): JSX.Element {
  return (
    <div className="designer-section">
      <div className="designer-section-head">
        <span className="designer-label">Indexes</span>
        {creating && (
          <button
            className="cb-button"
            onClick={() =>
              setDraft({
                ...draft,
                indexes: [...draft.indexes, { name: '', unique: false, columns: [] }],
              })
            }
          >
            + Add index
          </button>
        )}
      </div>
      {draft.indexes.length === 0 && <div className="designer-empty">No indexes defined</div>}
      {draft.indexes.map((idx, i) => (
        <div className="designer-index-row" key={i}>
          <input
            className="cb-input"
            placeholder="name"
            value={idx.name}
            disabled={!creating}
            onChange={(e) =>
              setDraft({
                ...draft,
                indexes: draft.indexes.map((x, xi) =>
                  xi === i ? { ...x, name: e.target.value } : x,
                ),
              })
            }
          />
          <label className="designer-check">
            <input
              type="checkbox"
              checked={idx.unique}
              disabled={!creating}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  indexes: draft.indexes.map((x, xi) =>
                    xi === i ? { ...x, unique: e.target.checked } : x,
                  ),
                })
              }
            />
            unique
          </label>
          <input
            className="cb-input"
            placeholder="col1, col2"
            value={idx.columns.join(', ')}
            onChange={(e) =>
              setDraft({
                ...draft,
                indexes: draft.indexes.map((x, xi) =>
                  xi === i ? { ...x, columns: splitColumns(e.target.value) } : x,
                ),
              })
            }
          />
          <button
            className="designer-remove"
            onClick={() =>
              setDraft({ ...draft, indexes: draft.indexes.filter((_, xi) => xi !== i) })
            }
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function FkEditor({
  draft,
  setDraft,
  creating = false,
}: {
  draft: TableDraft;
  setDraft: (draft: TableDraft) => void;
  creating?: boolean;
}): JSX.Element {
  return (
    <div className="designer-section">
      <div className="designer-section-head">
        <span className="designer-label">Foreign keys</span>
        {creating && (
          <button
            className="cb-button"
            onClick={() =>
              setDraft({
                ...draft,
                foreignKeys: [
                  ...draft.foreignKeys,
                  { name: '', columns: [], refTable: '', refColumns: [], onDelete: null },
                ],
              })
            }
          >
            + Add FK
          </button>
        )}
      </div>
      {draft.foreignKeys.length === 0 && <div className="designer-empty">No foreign keys defined</div>}
      {draft.foreignKeys.map((fk, i) => (
        <div className="designer-fk-row" key={i}>
          <input
            className="cb-input"
            placeholder="name"
            value={fk.name}
            disabled={!creating}
            onChange={(e) =>
              setDraft({
                ...draft,
                foreignKeys: draft.foreignKeys.map((x, xi) =>
                  xi === i ? { ...x, name: e.target.value } : x,
                ),
              })
            }
          />
          <input
            className="cb-input"
            placeholder="columns"
            value={fk.columns.join(', ')}
            onChange={(e) =>
              setDraft({
                ...draft,
                foreignKeys: draft.foreignKeys.map((x, xi) =>
                  xi === i ? { ...x, columns: splitColumns(e.target.value) } : x,
                ),
              })
            }
          />
          <input
            className="cb-input"
            placeholder="refTable"
            value={fk.refTable}
            onChange={(e) =>
              setDraft({
                ...draft,
                foreignKeys: draft.foreignKeys.map((x, xi) =>
                  xi === i ? { ...x, refTable: e.target.value } : x,
                ),
              })
            }
          />
          <input
            className="cb-input"
            placeholder="refColumns"
            value={fk.refColumns.join(', ')}
            onChange={(e) =>
              setDraft({
                ...draft,
                foreignKeys: draft.foreignKeys.map((x, xi) =>
                  xi === i ? { ...x, refColumns: splitColumns(e.target.value) } : x,
                ),
              })
            }
          />
          <input
            className="cb-input"
            placeholder="ON DELETE"
            value={fk.onDelete ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                foreignKeys: draft.foreignKeys.map((x, xi) =>
                  xi === i
                    ? { ...x, onDelete: e.target.value.length > 0 ? e.target.value : null }
                    : x,
                ),
              })
            }
          />
          <button
            className="designer-remove"
            onClick={() =>
              setDraft({ ...draft, foreignKeys: draft.foreignKeys.filter((_, xi) => xi !== i) })
            }
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
