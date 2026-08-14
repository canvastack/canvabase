import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Client } from '@canvabase/contracts';
import { App } from './App';
import { ClientProvider } from './client-context';
import './styles.css';

declare global {
  interface Window {
    canvabase: Client;
  }
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  override state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#f87171', background: '#0f1222', height: '100vh', fontFamily: 'monospace' }}>
          <h2>⚠️ CanvaBase Render Error</h2>
          <pre style={{ background: '#171b30', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', marginTop: 16, overflow: 'auto' }}>
            {this.state.error?.stack || this.state.error?.message}
          </pre>
          <button
            style={{ marginTop: 16, padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            onClick={() => window.location.reload()}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('root element not found');

const client = window.canvabase;
if (!client) throw new Error('canvabase client not injected by preload');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ClientProvider client={client}>
        <App />
      </ClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
