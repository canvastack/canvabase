import { useCallback, lazy, Suspense, useEffect, useState, useRef, type JSX, type MouseEvent as ReactMouseEvent } from 'react';
import { useClient } from './client-context';
import { createAppStore, type AppStore } from './store';
import { HeaderToolbar } from './components/HeaderToolbar';
import { UnifiedSidebarTree } from './components/UnifiedSidebarTree';
import { InspectorSidebar } from './components/InspectorSidebar';
import { QueryEditor } from './components/QueryEditor';
import { ResultGrid } from './components/ResultGrid';
import { TableDesigner } from './components/TableDesigner';
import { DatabaseDashboard } from './components/DatabaseDashboard';
import { StatusBar } from './components/StatusBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ConnectionModal } from './components/ConnectionModal';
import { ExportModal } from './components/ExportModal';
import { ImportModal } from './components/ImportModal';
import { SettingsModal, applyAccent, applyBgColor, getSavedBgColor, computeAutoHoverColor, applyAppOpacity } from './components/SettingsModal';
import { initPersistedFonts } from './lib/fontManager';
import { applySavedSqlTheme } from './lib/sqlTheme';
import type { ConnectionSummary } from '@canvabase/contracts';

import logoUrl from './assets/logo.png';

import { PopoutWorkspace } from './components/PopoutWorkspace';

const ErdScreen = lazy(() =>
  import('./components/ErdScreen').then((m) => ({ default: m.ErdScreen }))
);

export function App(): JSX.Element {
  const client = useClient();

  if (typeof window !== 'undefined' && window.location.hash.startsWith('#/popout')) {
    return <PopoutWorkspace client={client} />;
  }

  const [store] = useState<AppStore>(() => createAppStore(client));
  const activeView = store((s) => s.activeView);
  const activeConnectionId = store((s) => s.activeConnectionId);
  const tabs = store((s) => s.tabs);
  const leftSidebarOpen = store((s) => s.leftSidebarOpen);
  const leftSidebarWidth = store((s) => s.leftSidebarWidth);
  const setLeftSidebarWidth = store((s) => s.setLeftSidebarWidth);
  const toggleLeftSidebar = store((s) => s.toggleLeftSidebar);

  const rightSidebarOpen = store((s) => s.rightSidebarOpen);
  const rightSidebarWidth = store((s) => s.rightSidebarWidth);
  const setRightSidebarWidth = store((s) => s.setRightSidebarWidth);
  const toggleRightSidebar = store((s) => s.toggleRightSidebar);

  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeSplash(true);
      const fadeTimer = setTimeout(() => {
        setShowSplash(false);
      }, 300);
      return () => clearTimeout(fadeTimer);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Theme, Accent, Background, Opacity, Font & SQL Syntax Theme Initialization hook
  useEffect(() => {
    const theme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    try {
      void client.events.emit('canvabase:theme:set', theme);
    } catch {
      // ignore
    }

    const savedAccent = localStorage.getItem('cb_accent_color') || '#6366f1';
    const savedHover = localStorage.getItem('cb_accent_hover_color') || computeAutoHoverColor(savedAccent);
    applyAccent(savedAccent, savedHover);

    const savedBg = getSavedBgColor(theme);
    applyBgColor(savedBg, theme);

    const savedOpacity = localStorage.getItem('cb_app_opacity');
    if (savedOpacity) {
      applyAppOpacity(Number(savedOpacity));
    }

    // Initialize Fonts and SQL Syntax Colors
    void initPersistedFonts();
    applySavedSqlTheme();

    void store.getState().refreshConnections();
  }, [store]);

  const [isConnModalOpen, setIsConnModalOpen] = useState(false);
  const [editConnection, setEditConnection] = useState<ConnectionSummary | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const dragStartPos = useRef<number>(0);
  const dragStartWidth = useRef<number>(0);

  const handleOpenNewConn = () => {
    setEditConnection(null);
    setIsConnModalOpen(true);
  };

  const handleEditConn = (conn: ConnectionSummary) => {
    setEditConnection(conn);
    setIsConnModalOpen(true);
  };

  // Draggable Left Resizer logic
  const handleLeftResizerMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
    dragStartPos.current = e.clientX;
    dragStartWidth.current = leftSidebarWidth;
  };

  // Draggable Right Resizer logic
  const handleRightResizerMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
    dragStartPos.current = e.clientX;
    dragStartWidth.current = rightSidebarWidth;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizingLeft) {
        const delta = e.clientX - dragStartPos.current;
        const newWidth = dragStartWidth.current + delta;
        setLeftSidebarWidth(newWidth);
      } else if (isResizingRight) {
        const delta = dragStartPos.current - e.clientX;
        const newWidth = dragStartWidth.current + delta;
        setRightSidebarWidth(newWidth);
      }
    },
    [isResizingLeft, isResizingRight, setLeftSidebarWidth, setRightSidebarWidth]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
  }, []);

  useEffect(() => {
    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight, handleMouseMove, handleMouseUp]);

  return (
    <>
      {showSplash && (
        <div className={`cb-splash-screen${fadeSplash ? ' fade-out' : ''}`}>
          <div className="cb-splash-content">
            <img src={logoUrl} className="cb-splash-logo" alt="CanvaBase Logo" />
            <h1 className="cb-splash-title">CanvaBase</h1>
            <p className="cb-splash-subtitle">Database Management Desktop Client</p>
            <div className="cb-splash-loader">
              <div className="cb-splash-progress"></div>
            </div>
            <span className="cb-splash-version">v0.1.0</span>
          </div>
        </div>
      )}
      <div className={`app-shell ${isResizingLeft || isResizingRight ? 'is-resizing' : ''}`}>
      {/* Top Header & Action Toolbar */}
      <HeaderToolbar
        store={store}
        onOpenNewConnection={handleOpenNewConn}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      <div className="app-body">
        {/* Unified Navicat Sidebar (Connection -> Database -> Tables/Views Tree) */}
        {leftSidebarOpen && (
          <aside className="app-sidebar" style={{ width: `${leftSidebarWidth}px` }}>
            <UnifiedSidebarTree
              store={store}
              onOpenNewConnection={handleOpenNewConn}
              onEditConnection={handleEditConn}
            />
          </aside>
        )}

        {/* Floating Toggle Button when Left Sidebar is Collapsed */}
        {!leftSidebarOpen && (
          <button
            className="cb-collapsed-trigger-left"
            onClick={toggleLeftSidebar}
            title="Expand Left Sidebar"
          >
            <svg className="cb-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        )}

        {/* Left Resizer Drag Handle */}
        {leftSidebarOpen && (
          <div
            className={`cb-resizer cb-resizer-left ${isResizingLeft ? 'active' : ''}`}
            onMouseDown={handleLeftResizerMouseDown}
            onDoubleClick={toggleLeftSidebar}
            title="Drag to resize left sidebar, double click to collapse"
          />
        )}

        {/* Main Work Area based on Active View */}
        <main className="app-main">
          {!activeConnectionId &&
          activeView === 'query' &&
          tabs.length === 1 &&
          !tabs[0]?.sql &&
          !tabs[0]?.table &&
          tabs[0]?.rows?.length === 0 ? (
            <WelcomeScreen store={store} onOpenNewConnection={handleOpenNewConn} />
          ) : (
            <>
              {activeView === 'query' && (
                <div className="view-container query-view">
                  <QueryEditor store={store} />
                  <ResultGrid store={store} />
                </div>
              )}

              {activeView === 'designer' && (
                <div className="view-container designer-view">
                  <TableDesigner store={store} />
                </div>
              )}

              {activeView === 'erd' && (
                <div className="view-container erd-view">
                  <Suspense fallback={<div className="loading-fallback">Loading ERD Canvas...</div>}>
                    <ErdScreen store={store} />
                  </Suspense>
                </div>
              )}

              {activeView === 'database' && (
                <div className="view-container database-view">
                  <DatabaseDashboard store={store} />
                </div>
              )}
            </>
          )}
        </main>

        {/* Right Resizer Drag Handle */}
        {rightSidebarOpen && (
          <div
            className={`cb-resizer cb-resizer-right ${isResizingRight ? 'active' : ''}`}
            onMouseDown={handleRightResizerMouseDown}
            onDoubleClick={toggleRightSidebar}
            title="Drag to resize right sidebar, double click to collapse"
          />
        )}

        {/* Right Object & Connection Inspector Sidebar */}
        {rightSidebarOpen && (
          <aside className="app-right-sidebar" style={{ width: `${rightSidebarWidth}px` }}>
            <InspectorSidebar store={store} />
          </aside>
        )}
      </div>

      {/* Bottom Full-Width StatusBar (VS Code / Navicat style) */}
      <StatusBar store={store} />

      {/* Modals & Dialogs */}
      <ConnectionModal
        store={store}
        isOpen={isConnModalOpen}
        editConnection={editConnection}
        onClose={() => setIsConnModalOpen(false)}
      />

      <ExportModal
        store={store}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      <ImportModal
        store={store}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />

      <SettingsModal
        store={store}
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </div>
    </>
  );
}
