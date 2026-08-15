// packages/desktop/src/renderer/src/components/HistoryLog/types.ts

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';

export type QueryCategory = 'DML' | 'DDL' | 'DCL' | 'SYSTEM' | 'TRANSACTION';

export interface QueryLogEntry {
  id: string;
  timestamp: string; // ISO String
  formattedTimestamp: string; // YYYY-MM-DD HH:mm:ss.SSS
  serverName: string;
  connectionId?: string | undefined;
  engine: string;
  pid: number;
  dialectTag: string; // e.g. 'PGSQL', 'MYSQL', 'SQLITE'
  sql: string;
  durationMs: number;
  level: LogLevel;
  category: QueryCategory;
  rowsAffected?: number | undefined;
  errorMessage?: string | undefined;
}

export interface HistoryLogFilter {
  serverTarget: string; // 'ALL' or specific serverName / connectionId
  search: string;
  errorsOnly: boolean;
  slowOnly: boolean;
  slowThresholdMs: number;
  category?: QueryCategory | 'ALL' | undefined;
}
