import { useRef, useState, type JSX } from 'react';
import type { AppStore } from '../store';
import { ErdCanvas, type ErdCanvasHandle } from './ErdCanvas';
import { ErdTopToolbar } from './erd/ErdTopToolbar';

export function ErdScreen({ store }: { store: AppStore }): JSX.Element {
  const erd = store((s) => s.erd);
  const openErd = store((s) => s.openErd);
  const setErdFocus = store((s) => s.setErdFocus);
  const exportErdImage = store((s) => s.exportErdImage);
  const canvasRef = useRef<ErdCanvasHandle | null>(null);

  const [exporting, setExporting] = useState(false);

  if (!erd.open) return <></>;

  const refresh = (): void => {
    void openErd();
  };

  const handleFocusTable = (tableName: string): void => {
    if (!erd.graph || tableName.trim().length === 0) {
      setErdFocus(null);
      return;
    }
    const match = erd.graph.nodes.find(
      (n) => n.name.toLowerCase() === tableName.trim().toLowerCase()
    );
    setErdFocus(match ? match.name : null);
  };

  const handleExportPng = async (): Promise<void> => {
    if (!canvasRef.current) return;
    setExporting(true);
    const dataUrl = await canvasRef.current.getDataUrl();
    const defaultName = erd.graph ? `erd-${erd.graph.nodes.length}-tables` : 'erd';
    await exportErdImage(dataUrl, defaultName);
    setExporting(false);
  };

  return (
    <div className="erd-panel">
      {/* Top ERD Action Toolbar */}
      <ErdTopToolbar
        store={store}
        nodes={erd.graph?.nodes || []}
        selectedTable={erd.focusTable}
        onFocusTable={handleFocusTable}
        onAutoLayout={refresh}
        onExportPng={() => void handleExportPng()}
        isExporting={exporting}
      />

      {erd.error && <div className="error-banner">{erd.error}</div>}
      {erd.loading && <div className="erd-empty">Generating ERD Diagram...</div>}
      {!erd.loading && !erd.graph && !erd.error && <div className="erd-empty">Nothing to show.</div>}

      {erd.graph && (
        <ErdCanvas
          ref={canvasRef}
          graph={erd.graph}
          focusTable={erd.focusTable}
          onSelect={setErdFocus}
          onRefreshLayout={refresh}
        />
      )}
    </div>
  );
}
