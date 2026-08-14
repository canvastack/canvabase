import { useCallback, useEffect, useRef, useState, type JSX, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';

interface FloatingWindowProps {
  title: ReactNode;
  icon?: ReactNode;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onDock: () => void; // Minimize / Dock back to GUI
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export function FloatingWindow({
  title,
  icon,
  isFullscreen,
  onToggleFullscreen,
  onDock,
  children,
  initialWidth = 900,
  initialHeight = 620,
}: FloatingWindowProps): JSX.Element {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const w = Math.min(window.innerWidth - 60, initialWidth);
    const h = Math.min(window.innerHeight - 60, initialHeight);
    return {
      x: Math.max(20, Math.round((window.innerWidth - w) / 2)),
      y: Math.max(20, Math.round((window.innerHeight - h) / 2)),
    };
  });

  const [size, setSize] = useState<{ w: number; h: number }>(() => ({
    w: Math.min(window.innerWidth - 40, initialWidth),
    h: Math.min(window.innerHeight - 40, initialHeight),
  }));

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const isResizingRef = useRef(false);
  const resizeDirRef = useRef<ResizeDirection | null>(null);
  const resizeStartRef = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0, startW: 0, startH: 0 });

  // Handle Dragging
  const handleTitleMouseDown = (e: ReactMouseEvent) => {
    if (isFullscreen) return;
    if ((e.target as HTMLElement).closest('.cb-floating-btn')) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
  };

  // Handle Resizing
  const handleResizeMouseDown = (e: ReactMouseEvent, dir: ResizeDirection) => {
    if (isFullscreen) return;
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeDirRef.current = dir;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      startW: size.w,
      startH: size.h,
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingRef.current) {
      const nextX = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragOffsetRef.current.y));
      setPos({ x: nextX, y: nextY });
    } else if (isResizingRef.current && resizeDirRef.current) {
      const { mouseX, mouseY, startX, startY, startW, startH } = resizeStartRef.current;
      const dx = e.clientX - mouseX;
      const dy = e.clientY - mouseY;
      const dir = resizeDirRef.current;

      let newW = startW;
      let newH = startH;
      let newX = startX;
      let newY = startY;

      if (dir.includes('e')) newW = Math.max(400, startW + dx);
      if (dir.includes('s')) newH = Math.max(300, startH + dy);
      if (dir.includes('w')) {
        const potentialW = startW - dx;
        if (potentialW >= 400) {
          newW = potentialW;
          newX = startX + dx;
        }
      }
      if (dir.includes('n')) {
        const potentialH = startH - dy;
        if (potentialH >= 300) {
          newH = potentialH;
          newY = startY + dy;
        }
      }

      setSize({ w: newW, h: newH });
      setPos({ x: newX, y: newY });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    isResizingRef.current = false;
    resizeDirRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div className={`cb-floating-overlay ${isFullscreen ? 'is-fullscreen' : 'is-windowed'}`}>
      <div
        className={`cb-floating-window ${isFullscreen ? 'fullscreen-mode' : 'windowed-mode'}`}
        style={
          isFullscreen
            ? undefined
            : {
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${size.w}px`,
                height: `${size.h}px`,
              }
        }
      >
        {/* Title Bar with Drag Handle */}
        <div
          className="cb-floating-titlebar"
          onMouseDown={handleTitleMouseDown}
          onDoubleClick={onToggleFullscreen}
          title={isFullscreen ? 'Double-click to restore window' : 'Drag to move, double-click to maximize'}
        >
          <div className="cb-floating-title-content">
            {icon && <span className="cb-floating-icon">{icon}</span>}
            <span className="cb-floating-title-text">{title}</span>
          </div>

          <div className="cb-floating-controls">
            <button
              className="cb-floating-btn cb-floating-minimize"
              onClick={onDock}
              title="Minimize / Dock back to Main GUI"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <button
              className="cb-floating-btn cb-floating-maximize"
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Restore Window Size' : 'Maximize to Fullscreen'}
            >
              {isFullscreen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                  <line x1="14" y1="10" x2="21" y2="3" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              )}
            </button>

            <button
              className="cb-floating-btn cb-floating-close"
              onClick={onDock}
              title="Close / Dock Window"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Window Content */}
        <div className="cb-floating-body">{children}</div>

        {/* 8-Direction Resize Handles for Windowed Mode */}
        {!isFullscreen && (
          <>
            <div className="cb-resize-handle resize-n" onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
            <div className="cb-resize-handle resize-s" onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
            <div className="cb-resize-handle resize-e" onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
            <div className="cb-resize-handle resize-w" onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
            <div className="cb-resize-handle resize-ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
            <div className="cb-resize-handle resize-nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
            <div className="cb-resize-handle resize-se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
            <div className="cb-resize-handle resize-sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
          </>
        )}
      </div>
    </div>
  );
}
