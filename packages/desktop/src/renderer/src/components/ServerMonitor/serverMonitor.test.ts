// packages/desktop/src/renderer/src/components/ServerMonitor/serverMonitor.test.ts
import { describe, expect, it } from 'vitest';
import {
  getPostgresProcessListSql,
  getMysqlProcessListSql,
  getPostgresLockTreeSql,
  getCancelQuerySql,
  getTerminateConnectionSql,
  parsePostgresProcessRows,
  parseMysqlProcessRows,
  parseVariablesRows,
  enrichProcessList,
  getConnectionUsageStatus,
  getServerDataset,
} from './serverMonitorUtils';
import type { ServerProcess, LockDependency, ServerHealthMetrics } from './types';

describe('Server Monitor Utility & Enterprise Engine Tests', () => {
  describe('SQL Queries Generator', () => {
    it('generates accurate process list query for PostgreSQL matching Navicat', () => {
      const sql = getPostgresProcessListSql();
      expect(sql).toContain('pg_stat_activity');
      expect(sql).toContain('query_start');
    });

    it('generates MySQL SHOW FULL PROCESSLIST', () => {
      expect(getMysqlProcessListSql()).toBe('SHOW FULL PROCESSLIST;');
    });

    it('generates lock tree dependency query for PostgreSQL', () => {
      const sql = getPostgresLockTreeSql();
      expect(sql).toContain('pg_locks');
      expect(sql).toContain('blocked_locks');
      expect(sql).toContain('blocking_locks');
    });

    it('generates graceful query cancel SQL for PostgreSQL and MySQL', () => {
      expect(getCancelQuerySql(1234, 'postgresql')).toBe('SELECT pg_cancel_backend(1234);');
      expect(getCancelQuerySql(1234, 'mysql')).toBe('KILL QUERY 1234;');
    });

    it('generates forceful connection terminate SQL for PostgreSQL and MySQL', () => {
      expect(getTerminateConnectionSql(5678, 'postgresql')).toBe('SELECT pg_terminate_backend(5678);');
      expect(getTerminateConnectionSql(5678, 'mysql')).toBe('KILL CONNECTION 5678;');
    });
  });

  describe('Real Database Response Parsers', () => {
    it('parses real PostgreSQL pg_stat_activity query rows with locked object info', () => {
      const pgRows = [
        {
          id: 25928,
          user: 'postgres',
          host: '::1',
          port: 54318,
          db: 'postgres',
          command: 'SELECT a.pid AS "Id" FROM pg_stat_activity a',
          state: 'AccessShareLock',
          time: '2026-08-15 01:54:41.678736+07',
          duration_sec: 1.5,
          info: 'Locked Object: pg_authid',
        },
      ];

      const parsed = parsePostgresProcessRows(pgRows, 'PostgreSQL');
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.pid).toBe(25928);
      expect(parsed[0]?.user).toBe('postgres');
      expect(parsed[0]?.info).toBe('Locked Object: pg_authid');
      expect(parsed[0]?.state).toBe('AccessShareLock');
    });

    it('parses real MySQL SHOW FULL PROCESSLIST rows', () => {
      const mysqlRows = [
        {
          Id: 229,
          User: 'root',
          Host: 'localhost:50677',
          db: null,
          Command: 'Query',
          Time: 0,
          State: 'init',
          Info: 'SHOW FULL PROCESSLIST',
        },
      ];

      const parsed = parseMysqlProcessRows(mysqlRows, 'Localhost');
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.pid).toBe(229);
      expect(parsed[0]?.user).toBe('root');
      expect(parsed[0]?.host).toBe('localhost');
      expect(parsed[0]?.port).toBe(50677);
      expect(parsed[0]?.command).toBe('SHOW FULL PROCESSLIST');
    });

    it('parses variables for PostgreSQL and MySQL', () => {
      const pgVars = [{ name: 'work_mem', setting: '4MB', unit: 'kB', category: 'Memory', short_desc: 'Work mem size' }];
      const parsedPg = parseVariablesRows(pgVars, false);
      expect(parsedPg[0]?.name).toBe('work_mem');

      const myVars = [{ Variable_name: 'max_connections', Value: '151' }];
      const parsedMy = parseVariablesRows(myVars, true);
      expect(parsedMy[0]?.name).toBe('max_connections');
      expect(parsedMy[0]?.setting).toBe('151');
    });
  });

  describe('getServerDataset Multi-Engine Provider', () => {
    it('returns PostgreSQL specific processes, locks, and GUC variables', () => {
      const data = getServerDataset('PostgreSQL', 'postgresql');
      expect(data.processes.some((p) => p.user === 'postgres')).toBe(true);
      expect(data.variables.some((v) => v.name === 'shared_buffers')).toBe(true);
    });

    it('returns MySQL specific threads, locks, and system variables for Localhost', () => {
      const data = getServerDataset('Localhost', 'mysql');
      expect(data.processes.some((p) => p.user === 'root')).toBe(true);
      expect(data.variables.some((v) => v.name === 'max_connections')).toBe(true);
    });

    it('returns SQLite single-session in-memory pragma data', () => {
      const data = getServerDataset('SQLite Memory', 'sqlite');
      expect(data.processes).toHaveLength(1);
      expect(data.variables.some((v) => v.name === 'journal_mode')).toBe(true);
    });
  });

  describe('enrichProcessList - Lock & Blocker Detection', () => {
    it('identifies blocker process and sets blockedByPid correctly', () => {
      const rawProcesses: ServerProcess[] = [
        { server: 'PostgreSQL', pid: 1001, user: 'app', host: '::1', port: 5432, db: 'db1', command: 'BEGIN; UPDATE t1...', state: 'active', duration: '00:01:00', durationSec: 60 },
        { server: 'PostgreSQL', pid: 1002, user: 'web', host: '::1', port: 5433, db: 'db1', command: 'SELECT * FROM t1 FOR UPDATE', state: 'waiting', duration: '00:00:45', durationSec: 45 },
      ];

      const lockDeps: LockDependency[] = [
        {
          blockedPid: 1002,
          blockedUser: 'web',
          blockedQuery: 'SELECT * FROM t1 FOR UPDATE',
          blockingPid: 1001,
          blockingUser: 'app',
          blockingQuery: 'BEGIN; UPDATE t1...',
          lockType: 'RowExclusiveLock',
          relationName: 'public.t1',
        },
      ];

      const enriched = enrichProcessList(rawProcesses, lockDeps);
      const proc1 = enriched.find((p) => p.pid === 1001);
      const proc2 = enriched.find((p) => p.pid === 1002);

      expect(proc1?.isBlocker).toBe(true);
      expect(proc1?.isBlocked).toBe(false);

      expect(proc2?.isBlocked).toBe(true);
      expect(proc2?.blockedByPid).toBe(1001);
      expect(proc2?.isBlocker).toBe(false);
    });
  });

  describe('getConnectionUsageStatus', () => {
    it('returns healthy status under 75% capacity', () => {
      const metrics: ServerHealthMetrics = {
        activeConnections: 30,
        maxConnections: 100,
        connectionUsagePercent: 30,
        cacheHitRatio: 99.9,
        committedTransactions: 1000,
        rolledBackTransactions: 5,
        deadTuples: 50,
        liveTuples: 10000,
        uptimeSeconds: 10000,
        databaseSizeMb: 500,
      };
      const res = getConnectionUsageStatus(metrics);
      expect(res.level).toBe('healthy');
    });

    it('returns warning status between 75% and 89% capacity', () => {
      const metrics: ServerHealthMetrics = {
        activeConnections: 80,
        maxConnections: 100,
        connectionUsagePercent: 80,
        cacheHitRatio: 99.5,
        committedTransactions: 1000,
        rolledBackTransactions: 5,
        deadTuples: 50,
        liveTuples: 10000,
        uptimeSeconds: 10000,
        databaseSizeMb: 500,
      };
      const res = getConnectionUsageStatus(metrics);
      expect(res.level).toBe('warning');
    });

    it('returns critical status at 90% and above capacity', () => {
      const metrics: ServerHealthMetrics = {
        activeConnections: 95,
        maxConnections: 100,
        connectionUsagePercent: 95,
        cacheHitRatio: 98.0,
        committedTransactions: 1000,
        rolledBackTransactions: 50,
        deadTuples: 500,
        liveTuples: 10000,
        uptimeSeconds: 10000,
        databaseSizeMb: 500,
      };
      const res = getConnectionUsageStatus(metrics);
      expect(res.level).toBe('critical');
    });
  });
});
