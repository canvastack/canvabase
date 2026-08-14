import { useState, type JSX } from 'react';
import type { AppStore } from '../store';
import type { ExportFormat } from '@canvabase/contracts';

interface ExportModalProps {
  store: AppStore;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ store, isOpen, onClose }: ExportModalProps): JSX.Element | null {
  const exportTable = store((s) => s.exportTable);
  const transfer = store((s) => s.transfer);
  const tabs = store((s) => s.tabs);
  const activeTabId = store((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setStep(3);
    setExporting(true);
    const ok = await exportTable(format);
    setExporting(false);
    if (!ok && !transfer.error) {
      setStep(2);
    }
  };

  const handleResetClose = () => {
    setStep(1);
    setExporting(false);
    onClose();
  };

  return (
    <div className="cb-modal-overlay" onClick={handleResetClose}>
      <div className="cb-modal cb-modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="cb-modal-header">
          <div className="cb-modal-title">📤 Export Wizard — Step {step} of 3</div>
          <button className="cb-close-btn" onClick={handleResetClose}>
            ×
          </button>
        </div>

        {/* Wizard Step Indicator */}
        <div className="cb-wizard-steps">
          <div className={`cb-wizard-step ${step >= 1 ? 'active' : ''}`}>1. Select Format</div>
          <div className={`cb-wizard-step ${step >= 2 ? 'active' : ''}`}>2. Confirm Target</div>
          <div className={`cb-wizard-step ${step >= 3 ? 'active' : ''}`}>3. Exporting</div>
        </div>

        <div className="cb-modal-body">
          {step === 1 && (
            <div className="cb-wizard-body">
              <label className="cb-label">Choose Export Format</label>
              <div className="cb-format-grid">
                <div
                  className={`cb-format-card ${format === 'csv' ? 'selected' : ''}`}
                  onClick={() => setFormat('csv')}
                >
                  <span className="cb-format-icon">📄</span>
                  <span className="cb-format-title">CSV File</span>
                  <span className="cb-format-desc">Standard comma-separated text values</span>
                </div>

                <div
                  className={`cb-format-card ${format === 'sql' ? 'selected' : ''}`}
                  onClick={() => setFormat('sql')}
                >
                  <span className="cb-format-icon">⚡</span>
                  <span className="cb-format-title">SQL Dump</span>
                  <span className="cb-format-desc">Parameterized INSERT SQL statements</span>
                </div>

                <div
                  className={`cb-format-card ${format === 'json' ? 'selected' : ''}`}
                  onClick={() => setFormat('json')}
                >
                  <span className="cb-format-icon">📦</span>
                  <span className="cb-format-title">JSON Dataset</span>
                  <span className="cb-format-desc">Structured JSON array format</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="cb-wizard-body">
              <div className="cb-info-card">
                <div className="cb-info-row">
                  <span className="cb-label">Source Object:</span>
                  <span className="cb-value font-bold">{activeTab?.table || 'Current Query Result'}</span>
                </div>
                <div className="cb-info-row">
                  <span className="cb-label">Output Format:</span>
                  <span className="cb-value uppercase font-bold text-accent">{format}</span>
                </div>
                <div className="cb-info-row">
                  <span className="cb-label">Row Count:</span>
                  <span className="cb-value">{(activeTab?.rows.length || 0).toLocaleString()} rows loaded</span>
                </div>
              </div>
              <p className="text-xs text-muted mt-2">
                Clicking <strong>Start Export</strong> will prompt you to select the save destination file path.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="cb-wizard-body">
              {transfer.active || exporting ? (
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
                    Exporting {format.toUpperCase()} records… ({(transfer.processed || 0).toLocaleString()} rows processed)
                  </div>
                </div>
              ) : transfer.error ? (
                <div className="cb-alert cb-alert-error">{transfer.error}</div>
              ) : (
                <div className="cb-alert cb-alert-success">
                  ✅ Export completed successfully! {(transfer.processed || 0).toLocaleString()} records written.
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
              onClick={() => void handleExport()}
              disabled={exporting}
            >
              Start Export
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
