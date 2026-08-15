// packages/desktop/src/renderer/src/components/ServerMonitor/types.ts

export type ServerMonitorTabId = 'processes' | 'locks' | 'variables' | 'health';

export interface ServerProcess {
  server: string;
  pid: number;
  user: string | null;
  host: string | null;
  port: number | null;
  db: string | null;
  command: string;
  state: string | null; // e.g. 'active', 'idle', 'idle in transaction', 'AccessShareLock'
  duration: string; // e.g. '00:00:12' or '0.012s'
  durationSec: number;
  info?: string | null | undefined;
  backendStart?: string | undefined;
  queryStart?: string | undefined;
  waiting?: boolean | undefined;
  blockedByPid?: number | null | undefined;
  isBlocked?: boolean | undefined;
  isBlocker?: boolean | undefined;
}

export interface LockDependency {
  blockedPid: number;
  blockedUser: string;
  blockedQuery: string;
  blockingPid: number;
  blockingUser: string;
  blockingQuery: string;
  lockType: string;
  relationName: string;
}

export interface ServerVariable {
  name: string;
  setting: string;
  unit: string | null;
  category: string;
  shortDesc: string;
}

export interface ServerHealthMetrics {
  activeConnections: number;
  maxConnections: number;
  connectionUsagePercent: number;
  cacheHitRatio: number; // percentage, e.g. 99.8
  committedTransactions: number;
  rolledBackTransactions: number;
  deadTuples: number;
  liveTuples: number;
  uptimeSeconds: number;
  databaseSizeMb: number;
}
