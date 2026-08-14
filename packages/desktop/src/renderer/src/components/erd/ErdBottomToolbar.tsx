import { useState, type JSX } from 'react';

interface ErdBottomToolbarProps {
  zoomLevel: number; // e.g. 1.0 = 100%
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onRefresh: () => void;
  onTogglePanMode: (isPan: boolean) => void;
}

export function ErdBottomToolbar({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onFitView,
  onRefresh,
  onTogglePanMode,
}: ErdBottomToolbarProps): JSX.Element {
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');

  const zoomPercent = Math.round(zoomLevel * 100);

  const handleSelectTool = () => {
    setActiveTool('select');
    onTogglePanMode(false);
  };

  const handlePanTool = () => {
    setActiveTool('pan');
    onTogglePanMode(true);
  };

  return (
    <div className="erd-bottom-toolbar">
      {/* Tool Selection Group */}
      <div className="erd-tool-group">
        <button
          type="button"
          className={`erd-bottom-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={handleSelectTool}
          title="Selection Tool (Select & drag table nodes)"
        >
          ↖️ <span className="erd-btn-label">Select</span>
        </button>
        <button
          type="button"
          className={`erd-bottom-btn ${activeTool === 'pan' ? 'active' : ''}`}
          onClick={handlePanTool}
          title="Pan Tool (Drag canvas area)"
        >
          🖐️ <span className="erd-btn-label">Pan</span>
        </button>
      </div>

      <div className="cb-divider-sm" />

      {/* Canvas Refresh / Layout */}
      <button
        type="button"
        className="erd-bottom-btn"
        onClick={onRefresh}
        title="Refresh ERD Layout"
      >
        🔄 <span className="erd-btn-label">Refresh</span>
      </button>

      <div className="cb-divider-sm" />

      {/* Zoom Controls */}
      <div className="erd-zoom-group">
        <button
          type="button"
          className="erd-bottom-btn icon-only"
          onClick={onZoomOut}
          title="Zoom Out (-)"
        >
          ➖
        </button>
        <span className="erd-zoom-readout" title="Current Zoom Percentage">
          {zoomPercent}%
        </span>
        <button
          type="button"
          className="erd-bottom-btn icon-only"
          onClick={onZoomIn}
          title="Zoom In (+)"
        >
          ➕
        </button>
        <button
          type="button"
          className="erd-bottom-btn"
          onClick={onFitView}
          title="Fit Diagram to Canvas Window"
        >
          🔍 <span className="erd-btn-label">Fit</span>
        </button>
      </div>
    </div>
  );
}
