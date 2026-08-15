// packages/desktop/src/renderer/src/components/ServerMonitor/serverMonitorUtils.ts
import type { ServerProcess, LockDependency, ServerVariable, ServerHealthMetrics } from './types';

/** PostgreSQL query to fetch active processes matching Navicat Premium (1 row per PID) */
export function getPostgresProcessListSql(): string {
  return `
    SELECT
      a.pid AS id,
      a.usename AS "user",
      a.client_addr::text AS host,
      a.client_port AS port,
      a.datname AS db,
      COALESCE(a.query, '') AS command,
      COALESCE(a.state, '') AS state,
      COALESCE(a.query_start::text, a.backend_start::text, '') AS "time",
      ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - COALESCE(a.query_start, a.backend_start)))::numeric, 3) AS duration_sec,
      '' AS info
    FROM pg_catalog.pg_stat_activity a
    ORDER BY a.pid ASC;
  `.trim();
}

/** Basic PostgreSQL process list query without pg_locks join */
export function getPostgresBasicProcessListSql(): string {
  return `
    SELECT
      a.pid AS id,
      a.usename AS "user",
      a.client_addr::text AS host,
      a.client_port AS port,
      a.datname AS db,
      COALESCE(a.query, '') AS command,
      COALESCE(a.state, '') AS state,
      COALESCE(a.query_start::text, a.backend_start::text, '') AS "time",
      ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - COALESCE(a.query_start, a.backend_start)))::numeric, 3) AS duration_sec,
      '' AS info
    FROM pg_catalog.pg_stat_activity a
    ORDER BY a.pid ASC;
  `.trim();
}

/** MySQL query to fetch active processlist */
export function getMysqlProcessListSql(): string {
  return 'SHOW FULL PROCESSLIST;';
}

/** PostgreSQL query to fetch detailed lock trees */
export function getPostgresLockTreeSql(): string {
  return `
    SELECT
      blocked_locks.pid AS blocked_pid,
      blocked_activity.usename AS blocked_user,
      blocked_activity.query AS blocked_query,
      blocking_locks.pid AS blocking_pid,
      blocking_activity.usename AS blocking_user,
      blocking_activity.query AS blocking_query,
      blocked_locks.locktype AS lock_type,
      blocked_locks.relation::regclass::text AS relation_name
    FROM pg_catalog.pg_locks blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
    JOIN pg_catalog.pg_locks blocking_locks
      ON blocking_locks.locktype = blocked_locks.locktype
      AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
      AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
      AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
      AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
      AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
      AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
      AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
      AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
      AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
      AND blocking_locks.pid != blocked_locks.pid
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
    WHERE NOT blocked_locks.granted;
  `.trim();
}

/** PostgreSQL query to fetch GUC variables */
export function getPostgresVariablesSql(): string {
  return 'SELECT name, setting, unit, category, short_desc FROM pg_catalog.pg_settings ORDER BY name ASC;';
}

/** MySQL query to fetch system variables */
export function getMysqlVariablesSql(): string {
  return 'SHOW VARIABLES;';
}

/** PostgreSQL query to fetch health metrics */
export function getPostgresHealthSql(): string {
  return `
    SELECT
      (SELECT count(*) FROM pg_catalog.pg_stat_activity) AS active_connections,
      (SELECT setting::int FROM pg_catalog.pg_settings WHERE name = 'max_connections') AS max_connections,
      (SELECT ROUND(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit + blks_read), 0), 2) FROM pg_catalog.pg_stat_database) AS cache_hit_ratio,
      (SELECT COALESCE(sum(xact_commit), 0) FROM pg_catalog.pg_stat_database) AS committed_xacts,
      (SELECT COALESCE(sum(xact_rollback), 0) FROM pg_catalog.pg_stat_database) AS rolledback_xacts,
      (SELECT COALESCE(sum(n_dead_tup), 0) FROM pg_catalog.pg_stat_user_tables) AS dead_tuples,
      (SELECT COALESCE(sum(n_live_tup), 0) FROM pg_catalog.pg_stat_user_tables) AS live_tuples,
      (SELECT ROUND(pg_database_size(current_database()) / (1024.0 * 1024.0), 2)) AS total_size_mb;
  `.trim();
}

/** MySQL query to fetch health status */
export function getMysqlHealthSql(): string {
  return "SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Max_used_connections', 'Questions', 'Slow_queries', 'Innodb_buffer_pool_read_requests', 'Innodb_buffer_pool_reads', 'Uptime');";
}

/** Generates Graceful Query Cancel SQL */
export function getCancelQuerySql(pid: number, engine = 'postgresql'): string {
  if (engine.toLowerCase().includes('mysql')) {
    return `KILL QUERY ${pid};`;
  }
  return `SELECT pg_cancel_backend(${pid});`;
}

/** Generates Forceful Connection Terminate SQL */
export function getTerminateConnectionSql(pid: number, engine = 'postgresql'): string {
  if (engine.toLowerCase().includes('mysql')) {
    return `KILL CONNECTION ${pid};`;
  }
  return `SELECT pg_terminate_backend(${pid});`;
}

/** Parses real rows returned from PostgreSQL pg_stat_activity */
export function parsePostgresProcessRows(rows: Record<string, unknown>[], serverName: string): ServerProcess[] {
  return rows.map((r) => {
    const pid = Number(r.id ?? r.pid ?? 0);
    const user = r.user ? String(r.user) : null;
    const host = r.host ? String(r.host) : null;
    const port = r.port ? Number(r.port) : null;
    const db = r.db ? String(r.db) : null;
    const command = r.command ? String(r.command) : '';
    const state = r.state ? String(r.state) : null;
    const duration = r.time ? String(r.time) : (r.duration ? String(r.duration) : '00:00:00');
    const durationSec = Number(r.duration_sec ?? 0);
    const info = r.info ? String(r.info) : (r.Info ? String(r.Info) : undefined);

    const isBlocker = state?.toLowerCase().includes('exclusive') || state?.toLowerCase().includes('blocker');
    const isBlocked = state?.toLowerCase().includes('waiting') || state?.toLowerCase().includes('blocked');

    return {
      server: serverName,
      pid,
      user,
      host,
      port,
      db,
      command,
      state,
      duration,
      durationSec,
      info,
      isBlocker,
      isBlocked,
    };
  });
}

/** Parses real rows returned from MySQL SHOW FULL PROCESSLIST */
export function parseMysqlProcessRows(rows: Record<string, unknown>[], serverName: string): ServerProcess[] {
  return rows.map((r) => {
    const pid = Number(r.Id ?? r.id ?? 0);
    const user = r.User ? String(r.User) : null;
    const hostRaw = r.Host ? String(r.Host) : '';
    let host: string | null = null;
    let port: number | null = null;

    if (hostRaw) {
      const parts = hostRaw.split(':');
      host = parts[0] ?? hostRaw;
      if (parts[1]) port = parseInt(parts[1], 10);
    }

    const db = r.db ? String(r.db) : null;
    const command = r.Command ? String(r.Command) : '';
    const state = r.State ? String(r.State) : (command === 'Sleep' ? 'idle' : null);
    const durationSec = Number(r.Time ?? r.time ?? 0);
    const duration = `${durationSec}s`;
    const info = r.Info ? String(r.Info) : undefined;
    const fullCommand = info && info !== '(Null)' ? info : command;

    const isBlocker = state?.toLowerCase().includes('locked') || state?.toLowerCase().includes('metadata lock');
    const isBlocked = state?.toLowerCase().includes('waiting');

    return {
      server: serverName,
      pid,
      user,
      host,
      port,
      db,
      command: fullCommand,
      state,
      duration,
      durationSec,
      info,
      isBlocker,
      isBlocked,
    };
  });
}

/** Parses real rows from pg_settings or MySQL SHOW VARIABLES */
export function parseVariablesRows(rows: Record<string, unknown>[], isMysql = false): ServerVariable[] {
  if (isMysql) {
    return rows.map((r) => ({
      name: String(r.Variable_name ?? r.name ?? ''),
      setting: String(r.Value ?? r.setting ?? ''),
      unit: null,
      category: 'System Variable',
      shortDesc: 'MySQL Server System Variable',
    }));
  }

  return rows.map((r) => ({
    name: String(r.name ?? ''),
    setting: String(r.setting ?? ''),
    unit: r.unit ? String(r.unit) : null,
    category: String(r.category ?? 'Server Settings'),
    shortDesc: String(r.short_desc ?? r.shortDesc ?? ''),
  }));
}

/** Analyzes a list of processes and assigns blocker / blocked flags */
export function enrichProcessList(processes: ServerProcess[], lockDependencies: LockDependency[]): ServerProcess[] {
  const blockingPids = new Set(lockDependencies.map((l) => l.blockingPid));
  const blockedPids = new Set(lockDependencies.map((l) => l.blockedPid));

  return processes.map((proc) => {
    const isBlocker = proc.isBlocker || blockingPids.has(proc.pid);
    const isBlocked = proc.isBlocked || blockedPids.has(proc.pid);
    const dependency = lockDependencies.find((l) => l.blockedPid === proc.pid);

    return {
      ...proc,
      isBlocker,
      isBlocked,
      blockedByPid: dependency ? dependency.blockingPid : proc.blockedByPid,
    };
  });
}

/** Calculates overall connection pool utilization health status */
export function getConnectionUsageStatus(metrics: ServerHealthMetrics): {
  level: 'healthy' | 'warning' | 'critical';
  label: string;
} {
  const percent = metrics.connectionUsagePercent;
  if (percent >= 90) {
    return { level: 'critical', label: 'CRITICAL: Pool Exhaustion Risk' };
  }
  if (percent >= 75) {
    return { level: 'warning', label: 'WARNING: High Connection Load' };
  }
  return { level: 'healthy', label: 'HEALTHY: Normal Operation' };
}

/** Fallback dataset provider if database connection is offline */
export function getServerDataset(serverName: string, engine = 'postgresql'): {
  processes: ServerProcess[];
  locks: LockDependency[];
  variables: ServerVariable[];
  health: ServerHealthMetrics;
} {
  const isMysql = engine.toLowerCase().includes('mysql') || serverName.toLowerCase().includes('mysql') || serverName.toLowerCase().includes('localhost');
  const isSqlite = engine.toLowerCase().includes('sqlite');

  if (isMysql) {
    const mysqlProcesses: ServerProcess[] = [
      { server: serverName, pid: 5, user: 'event_scheduler', host: 'localhost', port: null, db: null, command: 'Daemon', state: 'Waiting on empty queue', duration: '188302s', durationSec: 188302, info: null },
      { server: serverName, pid: 229, user: 'root', host: 'localhost', port: 50677, db: null, command: 'SHOW FULL PROCESSLIST', state: 'init', duration: '0s', durationSec: 0, info: 'SHOW FULL PROCESSLIST' },
      { server: serverName, pid: 230, user: 'root', host: 'localhost', port: 50680, db: null, command: 'Sleep', state: 'idle', duration: '10s', durationSec: 10, info: null },
      { server: serverName, pid: 231, user: 'root', host: 'localhost', port: 50679, db: null, command: 'Sleep', state: 'idle', duration: '10s', durationSec: 10, info: null },
      { server: serverName, pid: 232, user: 'root', host: 'localhost', port: 50678, db: null, command: 'Sleep', state: 'idle', duration: '10s', durationSec: 10, info: null },
    ];

    const mysqlVariables: ServerVariable[] = [
      { name: 'max_connections', setting: '151', unit: null, category: 'Connection Limits', shortDesc: 'The maximum permitted number of simultaneous client connections.' },
      { name: 'innodb_buffer_pool_size', setting: '134217728', unit: 'bytes', category: 'InnoDB Storage Engine', shortDesc: 'The size in bytes of the buffer pool for InnoDB tables.' },
      { name: 'wait_timeout', setting: '28800', unit: 'seconds', category: 'Session Timeouts', shortDesc: 'The number of seconds the server waits for activity on a noninteractive connection.' },
      { name: 'character_set_server', setting: 'utf8mb4', unit: null, category: 'Localization', shortDesc: 'The default server character set.' },
    ];

    const mysqlHealth: ServerHealthMetrics = {
      activeConnections: 5,
      maxConnections: 151,
      connectionUsagePercent: 3,
      cacheHitRatio: 99.88,
      committedTransactions: 1254300,
      rolledBackTransactions: 89,
      deadTuples: 450,
      liveTuples: 2100000,
      uptimeSeconds: 518400,
      databaseSizeMb: 3450.2,
    };

    return { processes: mysqlProcesses, locks: [], variables: mysqlVariables, health: mysqlHealth };
  }

  if (isSqlite) {
    const sqliteProcesses: ServerProcess[] = [
      { server: serverName, pid: 1, user: 'current_session', host: 'local', port: null, db: 'main', command: 'PRAGMA database_list;', state: 'active', duration: '00:00:00', durationSec: 0 },
    ];

    const sqliteVariables: ServerVariable[] = [
      { name: 'journal_mode', setting: 'wal', unit: null, category: 'Storage', shortDesc: 'Write-Ahead Logging mode' },
      { name: 'page_size', setting: '4096', unit: 'bytes', category: 'Storage', shortDesc: 'Database page size' },
    ];

    const sqliteHealth: ServerHealthMetrics = {
      activeConnections: 1,
      maxConnections: 1,
      connectionUsagePercent: 100,
      cacheHitRatio: 100.0,
      committedTransactions: 4500,
      rolledBackTransactions: 0,
      deadTuples: 0,
      liveTuples: 85000,
      uptimeSeconds: 86400,
      databaseSizeMb: 45.8,
    };

    return { processes: sqliteProcesses, locks: [], variables: sqliteVariables, health: sqliteHealth };
  }

  // Default: PostgreSQL
  const pgProcesses: ServerProcess[] = [
    { server: serverName, pid: 5688, user: 'postgres', host: '::1', port: 64724, db: 'postgres', command: "SELECT 'db_numbackends' AS db, pg_stat_get_db_numbackends(d.oid) AS numbackends FROM pg_database d", state: 'active', duration: '2026-08-15 01:47:05.110256+07', durationSec: 1, info: null },
    { server: serverName, pid: 8064, user: null, host: null, port: null, db: null, command: '', state: null, duration: '2026-08-15 01:40:00.000000+07', durationSec: 0, info: null },
    { server: serverName, pid: 8092, user: null, host: null, port: null, db: null, command: '', state: null, duration: '2026-08-15 01:40:00.000000+07', durationSec: 0, info: null },
    { server: serverName, pid: 8132, user: null, host: null, port: null, db: null, command: '', state: null, duration: '2026-08-15 01:40:00.000000+07', durationSec: 0, info: null },
    { server: serverName, pid: 15952, user: 'postgres', host: '::1', port: 49679, db: 'postgres', command: 'SELECT j.jobid FROM pgagent.pga_job j', state: 'idle', duration: '2026-08-15 01:54:35.76805+07', durationSec: 0, info: null },
    { server: serverName, pid: 18840, user: 'postgres', host: '::1', port: 64726, db: 'postgres', command: 'SHOW ALL', state: 'active', duration: '2026-08-15 01:47:06.122221+07', durationSec: 1, info: null },
    { server: serverName, pid: 23620, user: 'postgres', host: '::1', port: 64725, db: 'postgres', command: 'SELECT a.pid AS "Id", a.usename AS "User" FROM pg_stat_activity a', state: 'active', duration: '2026-08-15 01:47:06.117037+07', durationSec: 1, info: null },
    { server: serverName, pid: 25928, user: 'postgres', host: '::1', port: 54318, db: 'postgres', command: 'SELECT a.pid AS "Id", a.usename AS "User" FROM pg_stat_activity a', state: 'AccessShareLock', duration: '2026-08-15 01:54:41.678736+07', durationSec: 2, info: 'Locked Object: pg_authid' },
    { server: serverName, pid: 30708, user: 'postgres', host: '::1', port: 51366, db: 'postgres', command: 'SELECT a.pid AS "Id", a.usename AS "User" FROM pg_stat_activity a', state: 'ExclusiveLock', duration: '2026-08-15 01:54:39.130012+07', durationSec: 15, info: 'Locked Transaction: 78/2971', isBlocker: true },
  ];

  const pgVariables: ServerVariable[] = [
    { name: 'max_connections', setting: '100', unit: null, category: 'Connections and Authentication', shortDesc: 'Sets the maximum number of concurrent connections.' },
    { name: 'shared_buffers', setting: '128MB', unit: '8kB', category: 'Resource Usage / Memory', shortDesc: 'Sets the number of shared memory buffers used by the server.' },
    { name: 'work_mem', setting: '4MB', unit: 'kB', category: 'Resource Usage / Memory', shortDesc: 'Sets the maximum memory to be used for query workspaces.' },
    { name: 'autovacuum', setting: 'on', unit: null, category: 'Autovacuum', shortDesc: 'Starts the autovacuum subprocess.' },
  ];

  const pgHealth: ServerHealthMetrics = {
    activeConnections: 9,
    maxConnections: 100,
    connectionUsagePercent: 9,
    cacheHitRatio: 99.72,
    committedTransactions: 482910,
    rolledBackTransactions: 124,
    deadTuples: 1420,
    liveTuples: 894300,
    uptimeSeconds: 345600,
    databaseSizeMb: 1240.5,
  };

  return { processes: pgProcesses, locks: [], variables: pgVariables, health: pgHealth };
}
