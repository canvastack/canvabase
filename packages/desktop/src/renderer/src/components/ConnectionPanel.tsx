import { useEffect, useState, type JSX } from 'react';
import type { AppStore } from '../store';
import type { ConnectionSummary } from '@canvabase/contracts';

interface ConnectionPanelProps {
  store: AppStore;
  onOpenNewConnection: () => void;
  onEditConnection: (conn: ConnectionSummary) => void;
}

export function ConnectionPanel({
  store,
  onOpenNewConnection,
  onEditConnection,
}: ConnectionPanelProps): JSX.Element {
  const connections = store((s) => s.connections);
  const activeConnectionId = store((s) => s.activeConnectionId);
  const loaded = store((s) => s.loaded);
  const refreshConnections = store((s) => s.refreshConnections);
  const connect = store((s) => s.connect);
  const disconnect = store((s) => s.disconnect);
  const deleteConnection = store((s) => s.deleteConnection);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void refreshConnections();
  }, [refreshConnections]);

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete connection "${name}"?`)) {
      setDeletingId(id);
      await deleteConnection(id);
      setDeletingId(null);
    }
  };

  return (
    <div className="connection-panel">
      <div className="panel-header-row">
        <div className="panel-title">🔌 Connections</div>
        <button
          className="cb-icon-button cb-btn-add-conn"
          onClick={onOpenNewConnection}
          title="Add New Connection"
        >
          +
        </button>
      </div>

      <div className="connection-list">
        {loaded && connections.length === 0 && (
          <div className="empty-hint-card">
            <p>No saved connections</p>
            <button className="cb-button cb-button-primary cb-btn-sm" onClick={onOpenNewConnection}>
              + Create Connection
            </button>
          </div>
        )}

        {connections.map((conn) => {
          const isActive = conn.id === activeConnectionId;
          return (
            <div key={conn.id} className={`connection-card ${isActive ? 'active' : ''}`}>
              <div className="conn-card-header">
                <button
                  className="conn-card-name"
                  onClick={() => {
                    if (isActive) {
                      void disconnect(conn.id);
                    } else {
                      void connect(conn.id);
                    }
                  }}
                  title={isActive ? 'Click to Disconnect' : 'Click to Connect'}
                >
                  <span className={`status-dot ${isActive ? 'connected' : 'disconnected'}`} />
                  <span className="conn-title-text">{conn.name}</span>
                  <span className="engine-tag">{conn.engine}</span>
                </button>

                <div className="conn-actions">
                  <button
                    className="conn-action-btn"
                    onClick={() => onEditConnection(conn)}
                    title="Edit Connection"
                  >
                    ✏️
                  </button>
                  <button
                    className="conn-action-btn conn-action-delete"
                    onClick={() => void handleDelete(conn.id, conn.name)}
                    disabled={deletingId === conn.id}
                    title="Delete Connection"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="conn-card-meta">
                {conn.engine === 'sqlite' ? (
                  <span className="conn-detail">{conn.database || 'SQLite Database'}</span>
                ) : (
                  <span className="conn-detail">
                    {conn.host || 'localhost'}:{conn.port || 3306} ({conn.database || 'default'})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
