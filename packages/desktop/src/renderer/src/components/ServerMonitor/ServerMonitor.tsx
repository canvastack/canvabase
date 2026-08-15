// packages/desktop/src/renderer/src/components/ServerMonitor/ServerMonitor.tsx
import { useState, useEffect, useRef, useCallback, type JSX, type MouseEvent as ReactMouseEvent } from 'react';
import type { AppStore } from '../../store';
import type {
  ServerProcess,
  ServerVariable,
  ServerHealthMetrics,
  LockDependency,
  ServerMonitorTabId,
} from './types';
import {
  getCancelQuerySql,
  getTerminateConnectionSql,
  getPostgresProcessListSql,
  getPostgresBasicProcessListSql,
  getMysqlProcessListSql,
  getPostgresVariablesSql,
  getMysqlVariablesSql,
  getPostgresHealthSql,
  getMysqlHealthSql,
  parsePostgresProcessRows,
  parseMysqlProcessRows,
  parseVariablesRows,
  enrichProcessList,
  getConnectionUsageStatus,
  getServerDataset,
} from './serverMonitorUtils';

interface ServerMonitorProps {
  store: AppStore;
}

/**
 * Helper: get the raw IPC client from window.canvabase.
 * ServerMonitor queries databases directly via IPC, **without** going through the
 * Zustand store's `connect()` / `runQuery()` which would change the app's
 * activeConnectionId and disrupt the user's main workflow.
 */
function getClient(): typeof window.canvabase {
  return window.canvabase;
}

export function ServerMonitor({ store }: ServerMonitorProps): JSX.Element {
  const connections = store((s) => s.connections);

  // Determine initial selected server — pick first connection name
  const initialServer = connections[0]?.name ?? 'PostgreSQL';

  const [selectedServers, setSelectedServers] = useState<string[]>([initialServer]);
  const [activeTab, setActiveTab] = useState<ServerMonitorTabId>('processes');

  // Server state datasets
  const [processes, setProcesses] = useState<ServerProcess[]>([]);
  const [locks] = useState<LockDependency[]>([]);
  const [variables, setVariables] = useState<ServerVariable[]>([]);
  const [health, setHealth] = useState<ServerHealthMetrics>({
    activeConnections: 0,
    maxConnections: 100,
    connectionUsagePercent: 0,
    cacheHitRatio: 100,
    committedTransactions: 0,
    rolledBackTransactions: 0,
    deadTuples: 0,
    liveTuples: 0,
    uptimeSeconds: 0,
    databaseSizeMb: 0,
  });

  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(5);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; proc: ServerProcess } | null>(null);

  // Keep track of latest request to prevent race conditions
  const requestIdRef = useRef(0);
  const locksRef = useRef(locks);
  locksRef.current = locks;

  /**
   * Core data loader.
   * For each selected server name:
   *   1. Find the matching connection in the store (by name).
   *   2. Ensure connection session is active via IPC directly.
   *   3. Execute the live process query (pg_stat_activity / SHOW FULL PROCESSLIST).
   *   4. Parse the result and update state immediately.
   */
  const loadServerData = useCallback(async (targetServerNames: string[]): Promise<void> => {
    const currentRequestId = ++requestIdRef.current;
    setIsRefreshing(true);

    if (!targetServerNames || targetServerNames.length === 0) {
      setProcesses([]);
      setVariables([]);
      setIsRefreshing(false);
      return;
    }

    const client = getClient();
    const currentConnections = store.getState().connections;

    // 1. Fetch Process List for all selected servers in PARALLEL
    const processPromises = targetServerNames.map(async (serverName) => {
      const conn = currentConnections.find(
        (c) => c.name.toLowerCase() === serverName.toLowerCase() || c.id === serverName,
      );
      if (!conn) {
        const fallbackEngine = serverName.toLowerCase().includes('mysql') || serverName.toLowerCase().includes('localhost') ? 'mysql' : 'postgresql';
        return getServerDataset(serverName, fallbackEngine).processes;
      }

      const isMysql = conn.engine.toLowerCase().includes('mysql');

      // Ensure session is connected
      try {
        await client.connections.connect(conn.id);
      } catch {
        // continue
      }

      try {
        const processSql = isMysql ? getMysqlProcessListSql() : getPostgresProcessListSql();
        let resProc = await client.query.execute({
          connectionId: conn.id,
          sql: processSql,
        });

        if (!resProc.ok) {
          if ('code' in resProc.error && resProc.error.code === 'NOT_CONNECTED') {
            await client.connections.connect(conn.id);
          }
          if (!isMysql) {
            resProc = await client.query.execute({
              connectionId: conn.id,
              sql: getPostgresBasicProcessListSql(),
            });
          }
        }

        if (resProc.ok && Array.isArray(resProc.data?.chunk?.rows)) {
          return isMysql
            ? parseMysqlProcessRows(resProc.data.chunk.rows, conn.name)
            : parsePostgresProcessRows(resProc.data.chunk.rows, conn.name);
        }
      } catch {
        // query failed
      }

      return getServerDataset(conn.name, conn.engine).processes;
    });

    const processResults = await Promise.all(processPromises);

    // If another request started while querying, discard stale result
    if (currentRequestId !== requestIdRef.current) return;

    const allProcesses = processResults.flat();
    const enriched = enrichProcessList(allProcesses, locksRef.current);
    setProcesses(enriched);
    setLastRefreshedAt(new Date().toLocaleTimeString());
    setIsRefreshing(false);

    // 2. Fetch Variables and Health asynchronously in the BACKGROUND (non-blocking)
    void Promise.all(
      targetServerNames.map(async (serverName) => {
        const conn = currentConnections.find(
          (c) => c.name.toLowerCase() === serverName.toLowerCase() || c.id === serverName,
        );
        if (!conn) return;

        const isMysql = conn.engine.toLowerCase().includes('mysql');

        try {
          const varSql = isMysql ? getMysqlVariablesSql() : getPostgresVariablesSql();
          const resVar = await client.query.execute({
            connectionId: conn.id,
            sql: varSql,
          });
          if (resVar.ok && Array.isArray(resVar.data?.chunk?.rows) && currentRequestId === requestIdRef.current) {
            const parsedVars = parseVariablesRows(resVar.data.chunk.rows, isMysql);
            setVariables(parsedVars);
          }

          const healthSql = isMysql ? getMysqlHealthSql() : getPostgresHealthSql();
          const resHealth = await client.query.execute({
            connectionId: conn.id,
            sql: healthSql,
          });
          if (resHealth.ok && Array.isArray(resHealth.data?.chunk?.rows) && resHealth.data.chunk.rows.length > 0 && currentRequestId === requestIdRef.current) {
            const h = resHealth.data.chunk.rows[0] as Record<string, unknown>;
            if (!isMysql) {
              setHealth((prev) => ({
                ...prev,
                activeConnections: Number(h.active_connections ?? prev.activeConnections),
                maxConnections: Number(h.max_connections ?? prev.maxConnections),
                connectionUsagePercent: Math.min(100, Math.round((Number(h.active_connections ?? 1) / Number(h.max_connections ?? 100)) * 100)),
                cacheHitRatio: Number(h.cache_hit_ratio ?? prev.cacheHitRatio),
                committedTransactions: Number(h.committed_xacts ?? prev.committedTransactions),
                rolledBackTransactions: Number(h.rolledback_xacts ?? prev.rolledBackTransactions),
                deadTuples: Number(h.dead_tuples ?? prev.deadTuples),
                liveTuples: Number(h.live_tuples ?? prev.liveTuples),
                databaseSizeMb: Number(h.total_size_mb ?? prev.databaseSizeMb),
              }));
            }
          }
        } catch {
          // ignore
        }
      }),
    );
  }, [store]);

  // Execute immediately whenever selectedServers changes
  useEffect(() => {
    void loadServerData(selectedServers);
  }, [selectedServers, loadServerData]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshSec <= 0) return;
    const interval = setInterval(() => {
      void loadServerData(selectedServers);
    }, autoRefreshSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshSec, selectedServers, loadServerData]);

  // Context Menu Global Click Dismiss
  useEffect(() => {
    const handleDismiss = () => setContextMenu(null);
    window.addEventListener('click', handleDismiss);
    return () => window.removeEventListener('click', handleDismiss);
  }, []);

  // ---------- Event handlers ----------

  const handleSelectSingleServer = (serverName: string): void => {
    setSelectedPid(null);
    setSelectedServers([serverName]);
  };

  const handleToggleServer = (serverName: string): void => {
    setSelectedPid(null);
    setSelectedServers((prev) => {
      const exists = prev.some((s) => s.toLowerCase() === serverName.toLowerCase());
      if (exists) {
        if (prev.length === 1) return prev; // keep at least 1 selected
        return prev.filter((s) => s.toLowerCase() !== serverName.toLowerCase());
      }
      return [...prev, serverName];
    });
  };

  const handleCancelQuery = async (proc: ServerProcess): Promise<void> => {
    const conn = store.getState().connections.find((c) => c.name.toLowerCase() === proc.server.toLowerCase());
    if (!conn) return;
    const sql = getCancelQuerySql(proc.pid, conn.engine);
    if (window.confirm(`Cancel query for PID ${proc.pid} on ${proc.server}?`)) {
      try { await getClient().query.execute({ connectionId: conn.id, sql }); } catch { /* */ }
      setProcesses((prev) => prev.filter((p) => !(p.pid === proc.pid && p.server === proc.server)));
      if (selectedPid === proc.pid) setSelectedPid(null);
    }
  };

  const handleTerminateProcess = async (proc: ServerProcess): Promise<void> => {
    const conn = store.getState().connections.find((c) => c.name.toLowerCase() === proc.server.toLowerCase());
    if (!conn) return;
    const sql = getTerminateConnectionSql(proc.pid, conn.engine);
    if (window.confirm(`Force terminate PID ${proc.pid} on ${proc.server}?`)) {
      try { await getClient().query.execute({ connectionId: conn.id, sql }); } catch { /* */ }
      setProcesses((prev) => prev.filter((p) => !(p.pid === proc.pid && p.server === proc.server)));
      if (selectedPid === proc.pid) setSelectedPid(null);
    }
  };

  const handleContextMenu = (e: ReactMouseEvent, proc: ServerProcess): void => {
    e.preventDefault();
    setSelectedPid(proc.pid);
    setContextMenu({ x: e.clientX, y: e.clientY, proc });
  };

  // ---------- Derived data ----------

  const filteredProcesses = processes
    .filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.pid.toString().includes(q) ||
        (p.server && p.server.toLowerCase().includes(q)) ||
        (p.user && p.user.toLowerCase().includes(q)) ||
        (p.db && p.db.toLowerCase().includes(q)) ||
        p.command.toLowerCase().includes(q) ||
        (p.state && p.state.toLowerCase().includes(q)) ||
        (p.info && p.info.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => (sortAsc ? a.durationSec - b.durationSec : b.durationSec - a.durationSec));

  const filteredVariables = variables.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.shortDesc.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedProcess = processes.find((p) => p.pid === selectedPid);
  const healthStatus = getConnectionUsageStatus(health);

  const serverItems = connections.length > 0
    ? connections.map((c) => ({
        name: c.name,
        engine: c.engine,
        icon: c.engine === 'mysql' ? '🐬' : c.engine === 'sqlite' ? '🗃️' : '🐘',
      }))
    : [
        { name: 'PostgreSQL', engine: 'postgresql', icon: '🐘' },
        { name: 'Localhost', engine: 'mysql', icon: '🐬' },
      ];

  // ---------- Render ----------

  return (
    <div className="role-mgr-container" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Top Toolbar */}
      <div className="role-mgr-toolbar">
        <div className="role-mgr-actions">
          <button type="button" onClick={() => void loadServerData(selectedServers)} className={`role-mgr-btn ${isRefreshing ? 'role-mgr-btn-primary' : ''}`} title="Refresh">
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}>🔄</span>
            <span>Refresh</span>
          </button>

          <button type="button" disabled={!selectedProcess} onClick={() => selectedProcess && void handleCancelQuery(selectedProcess)} className="role-mgr-btn" style={{ color: 'var(--accent)' }} title="Cancel Query">
            <span>🛑</span><span>Cancel Query</span>
          </button>

          <button type="button" disabled={!selectedProcess} onClick={() => selectedProcess && void handleTerminateProcess(selectedProcess)} className="role-mgr-btn role-mgr-btn-danger" title="End Process">
            <span>❌</span><span>End Process</span>
          </button>

          <div className="role-mgr-divider" />

          <button type="button" onClick={() => setSortAsc(true)} className={`role-mgr-btn ${sortAsc ? 'role-mgr-btn-primary' : ''}`} title="Sort ascending">
            <span>↑</span><span>Sort Ascending</span>
          </button>
          <button type="button" onClick={() => setSortAsc(false)} className={`role-mgr-btn ${!sortAsc ? 'role-mgr-btn-primary' : ''}`} title="Sort descending">
            <span>↓</span><span>Sort Descending</span>
          </button>

          <div className="role-mgr-divider" />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Auto Refresh:</span>
            <select value={autoRefreshSec} onChange={(e) => setAutoRefreshSec(Number(e.target.value))} className="cb-select" style={{ padding: '2px 6px', fontSize: '11px' }}>
              <option value="5">Every 5 seconds</option>
              <option value="10">Every 10 seconds</option>
              <option value="30">Every 30 seconds</option>
              <option value="0">Off (Manual)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="text" placeholder="Search processes / variables..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="role-mgr-search-input" style={{ width: '220px' }} />
        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: Server selector */}
        <div style={{ width: '180px', borderRight: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '8px 0', display: 'flex', flexDirection: 'column', flexShrink: 0, userSelect: 'none' }}>
          <div style={{ padding: '0 10px 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Servers</div>
          {serverItems.map((srv) => {
            const isChecked = selectedServers.some((s) => s.toLowerCase() === srv.name.toLowerCase());
            return (
              <div
                key={srv.name}
                onClick={() => handleSelectSingleServer(srv.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer',
                  background: isChecked ? 'rgba(99, 102, 241, 0.22)' : 'transparent',
                  color: isChecked ? 'var(--accent)' : 'var(--text-primary)',
                  fontWeight: isChecked ? 600 : 400, transition: 'background 0.15s ease',
                }}
              >
                <input type="checkbox" checked={isChecked} onChange={() => handleToggleServer(srv.name)} onClick={(e) => e.stopPropagation()} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                <span>{srv.icon} {srv.name}</span>
              </div>
            );
          })}
        </div>

        {/* Right: Tabs + Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div className="role-editor-tabs-bar">
            {([
              { id: 'processes', label: `Process List (${filteredProcesses.length})` },
              { id: 'locks', label: `Lock Inspector ${locks.length > 0 ? `(⚠️ ${locks.length})` : ''}` },
              { id: 'variables', label: 'Variables' },
              { id: 'health', label: 'Status & Health' },
            ] as const).map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`role-editor-tab-btn ${activeTab === tab.id ? 'active' : ''}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Process List */}
          {activeTab === 'processes' && (
            <div className="role-mgr-table-wrapper">
              <table className="role-mgr-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Server</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>Id</th>
                    <th style={{ width: '100px' }}>User</th>
                    <th style={{ width: '80px' }}>Host</th>
                    <th style={{ width: '60px', textAlign: 'right' }}>Port</th>
                    <th style={{ width: '80px' }}>db</th>
                    <th style={{ minWidth: '160px' }}>Command</th>
                    <th style={{ width: '130px' }}>State</th>
                    <th style={{ width: '130px' }}>Time</th>
                    <th style={{ width: '150px' }}>Info</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcesses.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>No active processes on {selectedServers.join(', ')}.</td></tr>
                  ) : filteredProcesses.map((proc) => {
                    const isSelected = selectedPid === proc.pid;
                    return (
                      <tr key={`${proc.server}-${proc.pid}`} onClick={() => setSelectedPid(proc.pid)} onContextMenu={(e) => handleContextMenu(e, proc)} className={isSelected ? 'selected' : ''} style={{ background: proc.isBlocker ? 'rgba(239,68,68,0.15)' : proc.isBlocked ? 'rgba(245,158,11,0.15)' : undefined }}>
                        <td style={{ color: 'var(--text-secondary)' }}>{proc.server}</td>
                        <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{proc.pid}</td>
                        <td style={{ color: proc.user ? 'var(--text-primary)' : 'var(--text-muted)' }}>{proc.user ?? '(Null)'}</td>
                        <td className="font-mono" style={{ color: proc.host ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{proc.host ?? '(Null)'}</td>
                        <td className="font-mono" style={{ textAlign: 'right', color: proc.port ? 'inherit' : 'var(--text-muted)' }}>{proc.port ?? '(Null)'}</td>
                        <td style={{ color: proc.db ? 'var(--text-primary)' : 'var(--text-muted)' }}>{proc.db ?? '(Null)'}</td>
                        <td className="font-mono" style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proc.command || '(idle)'}</td>
                        <td>
                          {proc.isBlocker ? (
                            <span className="role-mgr-badge" style={{ background: 'rgba(239,68,68,0.25)', color: 'var(--error)', fontWeight: 700 }}>🚨 BLOCKER</span>
                          ) : proc.isBlocked ? (
                            <span className="role-mgr-badge" style={{ background: 'rgba(245,158,11,0.25)', color: 'var(--accent)', fontWeight: 700 }}>⏳ BLOCKED by {proc.blockedByPid}</span>
                          ) : (
                            <span style={{ color: proc.state ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{proc.state ?? '(Null)'}</span>
                          )}
                        </td>
                        <td className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{proc.duration}</td>
                        <td style={{ fontSize: '11px', color: proc.info ? 'var(--accent)' : 'var(--text-muted)' }}>{proc.info ?? '(Null)'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Lock Inspector */}
          {activeTab === 'locks' && (
            <div className="role-mgr-table-wrapper" style={{ padding: '12px' }}>
              {locks.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>✅ No active blocking locks detected.</div>
              ) : locks.map((lock, i) => (
                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--error)' }}>🚨 Lock on {lock.relationName} ({lock.lockType}) — Blocker PID {lock.blockingPid} → Blocked PID {lock.blockedPid}</div>
                </div>
              ))}
            </div>
          )}

          {/* Variables */}
          {activeTab === 'variables' && (
            <div className="role-mgr-table-wrapper">
              <table className="role-mgr-table">
                <thead><tr><th style={{ width: '240px' }}>Variable Name</th><th style={{ width: '140px' }}>Value</th><th style={{ width: '80px' }}>Unit</th><th style={{ width: '180px' }}>Category</th><th>Description</th></tr></thead>
                <tbody>
                  {filteredVariables.map((v) => (
                    <tr key={`${v.name}-${v.category}`}>
                      <td className="font-mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{v.name}</td>
                      <td className="font-mono" style={{ fontWeight: 600 }}>{v.setting}</td>
                      <td className="font-mono" style={{ color: 'var(--text-muted)' }}>{v.unit ?? '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{v.category}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{v.shortDesc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Health */}
          {activeTab === 'health' && (
            <div className="role-mgr-table-wrapper" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Active Connections</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0' }}>{health.activeConnections} / {health.maxConnections}</div>
                  <div style={{ fontSize: '11px', color: healthStatus.level === 'healthy' ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>{health.connectionUsagePercent}% ({healthStatus.label})</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Cache Hit Ratio</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)', margin: '6px 0' }}>{health.cacheHitRatio}%</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Committed / Rollback</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0' }}>{health.committedTransactions.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--error)' }}>/ {health.rolledBackTransactions}</span></div>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Total Storage</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)', margin: '6px 0' }}>{(health.databaseSizeMb / 1024).toFixed(2)} GB</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100, padding: '4px 0', minWidth: '160px', fontSize: '12px' }} onClick={(e) => e.stopPropagation()}>
          <div onClick={() => { void handleCancelQuery(contextMenu.proc); setContextMenu(null); }} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface-hover)')} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
            <span>🛑</span><span>Cancel Query</span>
          </div>
          <div onClick={() => { void handleTerminateProcess(contextMenu.proc); setContextMenu(null); }} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)' }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface-hover)')} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
            <span>❌</span><span>End Process</span>
          </div>
          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
          <div onClick={() => { void navigator.clipboard.writeText(contextMenu.proc.command); setContextMenu(null); }} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface-hover)')} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
            <span>📋</span><span>Copy Query</span>
          </div>
          <div onClick={() => { void navigator.clipboard.writeText(contextMenu.proc.pid.toString()); setContextMenu(null); }} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-surface-hover)')} onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
            <span>🔢</span><span>Copy PID</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="role-mgr-statusbar">
        <span>Monitored: {selectedServers.join(', ')}</span>
        <span>Number of Processes: {filteredProcesses.length}</span>
        <span>Last Refreshed: {lastRefreshedAt} | Auto refresh: {autoRefreshSec > 0 ? `${autoRefreshSec}s` : 'Off'}</span>
      </div>
    </div>
  );
}
