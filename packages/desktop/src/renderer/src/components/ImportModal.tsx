import { useState, type JSX } from 'react';
import type { AppStore } from '../store';
import type { ExportFormat, ImportMode } from '@canvabase/contracts';

interface ImportModalProps {
  store: AppStore;
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ store, isOpen, onClose }: ImportModalProps): JSX.Element | null {
  const importData = store((s) => s.importData);
  const transfer = store((s) => s.transfer);
  const tabs = store((s) => s.tabs);
  const activeTabId = store((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [mode, setMode] = useState<ImportMode>('insert');
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    setStep(3);
    setImporting(true);
    const ok = await importData(format, mode);
    setImporting(false);
    if (!ok && !transfer.error) {
      setStep(2);
    }
  };

  const handleResetClose = () => {
    setStep(1);
    setImporting(false);
    onClose();
  };

  return (
    <div className="cb-modal-overlay" onClick={handleResetClose}>
      <div className="cb-modal cb-modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="cb-modal-header">
          <div className="cb-modal-title">📥 Import Wizard — Step {step} of 3</div>
          <button className="cb-close-btn" onClick={handleResetClose}>
            ×
          </button>
        </div>

        {/* Wizard Step Indicator */}
        <div className="cb-wizard-steps">
          <div className={`cb-wizard-step ${step >= 1 ? 'active' : ''}`}>1. Select Format</div>
          <div className={`cb-wizard-step ${step >= 2 ? 'active' : ''}`}>2. Import Mode</div>
          <div className={`cb-wizard-step ${step >= 3 ? 'active' : ''}`}>3. Importing</div>
        </div>

        <div className="cb-modal-body">
          {step === 1 && (
            <div className="cb-wizard-body">
              <label className="cb-label">Choose Source File Format</label>
              <div className="cb-format-grid">
                <div
                  className={`cb-format-card ${format === 'csv' ? 'selected' : ''}`}
                  onClick={() => setFormat('csv')}
                >
                  <span className="cb-format-icon">📄</span>
                  <span className="cb-format-title">CSV File</span>
                  <span className="cb-format-desc">Import records from delimited text / CSV file</span>
                </div>

                <div
                  className={`cb-format-card ${format === 'json' ? 'selected' : ''}`}
                  onClick={() => setFormat('json')}
                >
                  <span className="cb-format-icon">📦</span>
                  <span className="cb-format-title">JSON Dataset</span>
                  <span className="cb-format-desc">Import records from JSON document array</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="cb-wizard-body">
              <div className="cb-info-card">
                <div className="cb-info-row">
                  <span className="cb-label">Target Table:</span>
                  <span className="cb-value font-bold">{activeTab?.table || 'Active Table'}</span>
                </div>
                <div className="cb-info-row">
                  <span className="cb-label">Source Format:</span>
                  <span className="cb-value uppercase font-bold text-accent">{format}</span>
                </div>
              </div>

              <div className="cb-form-group mt-3">
                <label className="cb-label">Select Import Execution Mode</label>
                <select
                  className="cb-select"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as ImportMode)}
                >
                  <option value="insert">➕ Insert Mode (Append new rows to table)</option>
                  <option value="replace">🔄 Replace Mode (Delete existing & overwrite rows)</option>
                </select>
              </div>

              <p className="text-xs text-muted mt-2">
                Clicking <strong>Start Import</strong> will prompt you to browse the input file on your system.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="cb-wizard-body">
              {transfer.active || importing ? (
                <div className="cb-progress-container">
                  <div className="cb-progress-bar">
                    <div
                      className="cb-progress-fill"
                      style={{
                        width: `${
                          transfer.total && transfer.processed
                            ? Math.min(100, Math.round((transfer.processed / transfer.total) * 100))
                            : transfer.processed
                              ? 60
                              : 20
                        }%`,
                      }}
                    />
                  </div>
                  <div className="cb-progress-text">
                    Importing {format.toUpperCase()} records… ({(transfer.processed || 0).toLocaleString()} rows processed)
                  </div>
                </div>
              ) : transfer.error ? (
                <div className="cb-alert cb-alert-error">{transfer.error}</div>
              ) : (
                <div className="cb-alert cb-alert-success">
                  ✅ Import completed successfully! {(transfer.processed || 0).toLocaleString()} records imported into table.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="cb-modal-footer">
          {step > 1 && step < 3 && (
            <button className="cb-button" onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}>
              Back
            </button>
          )}
          {step === 1 && (
            <button className="cb-button cb-button-primary" onClick={() => setStep(2)}>
              Next Step →
            </button>
          )}
          {step === 2 && (
            <button
              className="cb-button cb-button-primary"
              onClick={() => void handleImport()}
              disabled={importing}
            >
              Start Import
            </button>
          )}
          {step === 3 && (
            <button className="cb-button cb-button-primary" onClick={handleResetClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
