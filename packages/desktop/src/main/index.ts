import { app, BrowserWindow, session, shell, nativeTheme, ipcMain, Menu } from 'electron';
import { join } from 'node:path';
import type { TransferProgress } from '@canvabase/contracts';
import { ConnectionManager } from './services/ConnectionManager.js';
import { createBuiltinRegistry } from './services/DialectRegistry.js';
import { QueryEngine } from './services/QueryEngine.js';
import { ObjectBrowserService } from './services/ObjectBrowserService.js';
import { DataService } from './services/DataService.js';
import { TableDesignerService } from './services/TableDesignerService.js';
import { ErdService } from './services/ErdService.js';
import { TransferService } from './services/TransferService.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { IPC_CHANNELS } from '../ipc/channels.js';
import { APP_NAME } from '../constants.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

function hardenSession(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
        'X-Content-Type-Options': ['nosniff'],
      },
    });
  });
}

function createWindow(): void {
  // Remove redundant black native menu bar (File, Edit, View, Window, Help)
  Menu.setApplicationMenu(null);

  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    title: APP_NAME,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1222',
    titleBarStyle: isWindows || isMac ? 'hidden' : 'default',
    ...(isWindows
      ? {
          titleBarOverlay: {
            color: '#0f1222',
            symbolColor: '#e6e8f2',
            height: 48,
          },
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const showWindow = () => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      win.focus();
    }
  };

  win.once('ready-to-show', showWindow);
  win.webContents.on('did-finish-load', showWindow);
  setTimeout(showWindow, 1000);

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer gone]', JSON.stringify(details));
  });
  win.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[did-fail-load]', code, description);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file:')) event.preventDefault();
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

async function bootstrap(): Promise<void> {
  const registry = createBuiltinRegistry();
  const connections = new ConnectionManager(registry, app.getPath('userData'));
  await connections.init();
  const query = new QueryEngine(connections, app.getPath('userData'));
  const browser = new ObjectBrowserService(connections);
  const data = new DataService(connections, query);
  const designer = new TableDesignerService(connections, app.getPath('userData'));
  const erd = new ErdService(connections);
  const transfer = new TransferService(connections, (progress: TransferProgress) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC_CHANNELS.transferProgress, progress);
    }
  });
  registerIpcHandlers({ connections, query, browser, data, designer, erd, transfer });

  const applyTheme = (theme: 'dark' | 'light') => {
    nativeTheme.themeSource = theme;
    const bgColor = theme === 'dark' ? '#0f1222' : '#f8fafc';
    const symbolColor = theme === 'dark' ? '#e6e8f2' : '#0f172a';
    for (const win of BrowserWindow.getAllWindows()) {
      win.setBackgroundColor(bgColor);
      if (process.platform === 'win32') {
        try {
          win.setTitleBarOverlay({
            color: bgColor,
            symbolColor: symbolColor,
            height: 48,
          });
        } catch {
          // ignore
        }
      }
    }
  };

  const applyOpacity = (opacity: number) => {
    const clamped = Math.max(0.35, Math.min(1.0, typeof opacity === 'number' && !isNaN(opacity) ? opacity : 1));
    for (const win of BrowserWindow.getAllWindows()) {
      win.setOpacity(clamped);
    }
  };

  ipcMain.handle(IPC_CHANNELS.themeSet, (_event, theme: 'dark' | 'light') => {
    applyTheme(theme);
    return { ok: true, data: true };
  });

  ipcMain.on(IPC_CHANNELS.themeSet, (_event, theme: 'dark' | 'light') => {
    applyTheme(theme);
  });

  ipcMain.handle(IPC_CHANNELS.windowSetOpacity, (_event, opacity: number) => {
    applyOpacity(opacity);
    return { ok: true, data: true };
  });

  ipcMain.on(IPC_CHANNELS.windowSetOpacity, (_event, opacity: number) => {
    applyOpacity(opacity);
  });

  ipcMain.handle(
    IPC_CHANNELS.windowOpenPopout,
    (
      _event,
      input: {
        type: 'query' | 'table';
        title: string;
        connectionId?: string;
        tabId?: string;
        sql?: string;
        table?: string;
      },
    ) => {
      const isWindows = process.platform === 'win32';
      const isMac = process.platform === 'darwin';

      const popoutWin = new BrowserWindow({
        width: 1160,
        height: 760,
        minWidth: 800,
        minHeight: 500,
        title: `CanvaBase — ${input.title || 'Workspace'}`,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#0f1222',
        titleBarStyle: isWindows || isMac ? 'hidden' : 'default',
        ...(isWindows
          ? {
              titleBarOverlay: {
                color: '#0f1222',
                symbolColor: '#e6e8f2',
                height: 48,
              },
            }
          : {}),
        webPreferences: {
          preload: join(__dirname, '../preload/index.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      });

      const showWindow = () => {
        if (!popoutWin.isDestroyed() && !popoutWin.isVisible()) {
          popoutWin.show();
          popoutWin.focus();
        }
      };

      popoutWin.once('ready-to-show', showWindow);
      popoutWin.webContents.on('did-finish-load', showWindow);

      const params = new URLSearchParams();
      params.set('type', input.type || 'query');
      if (input.title) params.set('title', input.title);
      if (input.connectionId) params.set('connectionId', input.connectionId);
      if (input.tabId) params.set('tabId', input.tabId);
      if (input.sql) params.set('sql', input.sql);
      if (input.table) params.set('table', input.table);

      const hash = `#/popout?${params.toString()}`;

      if (process.env['ELECTRON_RENDERER_URL']) {
        void popoutWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${hash}`);
      } else {
        void popoutWin.loadFile(join(__dirname, '../renderer/index.html'), { hash });
      }

      return { ok: true, data: { opened: true } };
    },
  );
}

app
  .whenReady()
  .then(async () => {
    hardenSession();
    await bootstrap();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((err: unknown) => {
    console.error('Failed to start CanvaBase', err);
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
