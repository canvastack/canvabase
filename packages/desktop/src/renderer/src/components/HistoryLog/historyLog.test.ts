// packages/desktop/src/renderer/src/components/HistoryLog/historyLog.test.ts
import { describe, expect, it } from 'vitest';
import {
  maskSensitiveCredentials,
  categorizeSql,
  formatLogEntry,
  filterLogEntries,
  exportLogsToCsv,
  exportLogsToJson,
} from './historyLogUtils';
import type { QueryLogEntry } from './types';

describe('History Log Utility & Enterprise Features Tests', () => {
  describe('maskSensitiveCredentials', () => {
    it('masks password strings in CREATE ROLE / ALTER USER statements', () => {
      const sql1 = "CREATE ROLE analyst WITH PASSWORD 'my_secret_pass_123';";
      expect(maskSensitiveCredentials(sql1)).toBe("CREATE ROLE analyst WITH PASSWORD '********';");

      const sql2 = 'ALTER USER "postgres" IDENTIFIED BY "supersecret";';
      expect(maskSensitiveCredentials(sql2)).toBe('ALTER USER "postgres" IDENTIFIED BY "********";');
    });

    it('leaves standard non-password queries intact', () => {
      const sql = 'SELECT * FROM users WHERE active = true;';
      expect(maskSensitiveCredentials(sql)).toBe(sql);
    });
  });

  describe('categorizeSql', () => {
    it('accurately identifies query categories', () => {
      expect(categorizeSql('SELECT id FROM orders')).toBe('DML');
      expect(categorizeSql('INSERT INTO users VALUES (1)')).toBe('DML');
      expect(categorizeSql('CREATE TABLE products (id int)')).toBe('DDL');
      expect(categorizeSql('ALTER ROLE reader WITH LOGIN')).toBe('DDL');
      expect(categorizeSql('GRANT SELECT ON tables TO user')).toBe('DCL');
      expect(categorizeSql('BEGIN; COMMIT;')).toBe('TRANSACTION');
      expect(categorizeSql('SHOW max_connections;')).toBe('SYSTEM');
    });
  });

  describe('formatLogEntry', () => {
    it('formats a log entry according to Navicat Premium specifications', () => {
      const entry: QueryLogEntry = {
        id: '1',
        timestamp: '2026-08-15T01:16:14.586Z',
        formattedTimestamp: '2026-08-15 01:16:14.586',
        serverName: 'PostgreSQL',
        engine: 'postgresql',
        pid: 7724,
        dialectTag: 'PGSQL',
        sql: 'SELECT 1;',
        durationMs: 12,
        level: 'SUCCESS',
        category: 'DML',
      };

      const formatted = formatLogEntry(entry);
      expect(formatted).toContain('[2026-08-15 01:16:14.586][PostgreSQL][7724][PGSQL]');
      expect(formatted).toContain('SELECT 1;');
      expect(formatted).toContain('Time: 0.012s');
    });
  });

  describe('filterLogEntries', () => {
    const mockEntries: QueryLogEntry[] = [
      {
        id: '1',
        timestamp: '2026-08-15T01:00:00.000Z',
        formattedTimestamp: '2026-08-15 01:00:00.000',
        serverName: 'PostgreSQL',
        engine: 'postgresql',
        pid: 100,
        dialectTag: 'PGSQL',
        sql: 'SELECT * FROM users;',
        durationMs: 15,
        level: 'SUCCESS',
        category: 'DML',
      },
      {
        id: '2',
        timestamp: '2026-08-15T01:01:00.000Z',
        formattedTimestamp: '2026-08-15 01:01:00.000',
        serverName: 'PostgreSQL',
        engine: 'postgresql',
        pid: 101,
        dialectTag: 'PGSQL',
        sql: 'SELECT * FROM big_table;',
        durationMs: 750,
        level: 'SUCCESS',
        category: 'DML',
      },
      {
        id: '3',
        timestamp: '2026-08-15T01:02:00.000Z',
        formattedTimestamp: '2026-08-15 01:02:00.000',
        serverName: 'PostgreSQL',
        engine: 'postgresql',
        pid: 102,
        dialectTag: 'PGSQL',
        sql: 'SELECT broken_column FROM users;',
        durationMs: 5,
        level: 'ERROR',
        category: 'DML',
        errorMessage: 'column "broken_column" does not exist',
      },
    ];

    it('filters errors only', () => {
      const res = filterLogEntries(mockEntries, {
        serverTarget: 'ALL',
        search: '',
        errorsOnly: true,
        slowOnly: false,
        slowThresholdMs: 500,
      });
      expect(res).toHaveLength(1);
      expect(res[0]?.id).toBe('3');
    });

    it('filters slow queries only (>500ms)', () => {
      const res = filterLogEntries(mockEntries, {
        serverTarget: 'ALL',
        search: '',
        errorsOnly: false,
        slowOnly: true,
        slowThresholdMs: 500,
      });
      expect(res).toHaveLength(1);
      expect(res[0]?.id).toBe('2');
    });

    it('filters by search keyword', () => {
      const res = filterLogEntries(mockEntries, {
        serverTarget: 'ALL',
        search: 'big_table',
        errorsOnly: false,
        slowOnly: false,
        slowThresholdMs: 500,
      });
      expect(res).toHaveLength(1);
      expect(res[0]?.id).toBe('2');
    });

    it('filters by server target accurately', () => {
      const entriesWithServers: QueryLogEntry[] = [
        { ...mockEntries[0]!, serverName: 'PostgreSQL' },
        { ...mockEntries[1]!, serverName: 'Localhost' },
      ];

      const resPg = filterLogEntries(entriesWithServers, {
        serverTarget: 'PostgreSQL',
        search: '',
        errorsOnly: false,
        slowOnly: false,
        slowThresholdMs: 500,
      });
      expect(resPg).toHaveLength(1);
      expect(resPg[0]?.serverName).toBe('PostgreSQL');

      const resMysql = filterLogEntries(entriesWithServers, {
        serverTarget: 'Localhost',
        search: '',
        errorsOnly: false,
        slowOnly: false,
        slowThresholdMs: 500,
      });
      expect(resMysql).toHaveLength(1);
      expect(resMysql[0]?.serverName).toBe('Localhost');
    });
  });

  describe('Export to CSV and JSON', () => {
    const entry: QueryLogEntry = {
      id: '1',
      timestamp: '2026-08-15T01:00:00.000Z',
      formattedTimestamp: '2026-08-15 01:00:00.000',
      serverName: 'PostgreSQL',
      engine: 'postgresql',
      pid: 100,
      dialectTag: 'PGSQL',
      sql: 'SELECT 1;',
      durationMs: 10,
      level: 'SUCCESS',
      category: 'DML',
    };

    it('exports log entries to valid CSV with headers', () => {
      const csv = exportLogsToCsv([entry]);
      expect(csv).toContain('Timestamp,Server,PID,Dialect,Category,Duration(ms),Level,SQL,Error');
      expect(csv).toContain('"2026-08-15 01:00:00.000","PostgreSQL",100,"PGSQL","DML",10,"SUCCESS","SELECT 1;",""');
    });

    it('exports log entries to sanitized JSON array', () => {
      const jsonStr = exportLogsToJson([entry]);
      const parsed = JSON.parse(jsonStr);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].serverName).toBe('PostgreSQL');
    });
  });
});
