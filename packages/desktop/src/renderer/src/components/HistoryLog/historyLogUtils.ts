// packages/desktop/src/renderer/src/components/HistoryLog/historyLogUtils.ts
import type { QueryLogEntry, HistoryLogFilter, QueryCategory } from './types';

/** Formats a Date object into 'YYYY-MM-DD HH:mm:ss.SSS' */
export function formatTimestamp(d: Date = new Date()): string {
  const pad = (n: number, z = 2): string => n.toString().padStart(z, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const sss = pad(d.getMilliseconds(), 3);
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}.${sss}`;
}

/** Masks sensitive credentials like passwords in SQL queries */
export function maskSensitiveCredentials(sql: string): string {
  return sql
    .replace(/(PASSWORD\s+)(['"])(.*?)\2/gi, "$1$2********$2")
    .replace(/(IDENTIFIED\s+BY\s+)(['"])(.*?)\2/gi, "$1$2********$2")
    .replace(/(SECRET\s+['"])(.*?)(['"])/gi, "$1********$3");
}

/** Categorizes SQL into DDL, DML, DCL, TRANSACTION, or SYSTEM */
export function categorizeSql(sql: string): QueryCategory {
  const trimmed = sql.trim().toUpperCase();
  if (/^(SELECT|INSERT|UPDATE|DELETE|MERGE)/.test(trimmed)) return 'DML';
  if (/^(CREATE|ALTER|DROP|TRUNCATE|RENAME|COMMENT)/.test(trimmed)) return 'DDL';
  if (/^(GRANT|REVOKE)/.test(trimmed)) return 'DCL';
  if (/^(BEGIN|COMMIT|ROLLBACK|START TRANSACTION|SAVEPOINT)/.test(trimmed)) return 'TRANSACTION';
  return 'SYSTEM';
}

/** Formats a QueryLogEntry into Navicat Premium-accurate log lines */
export function formatLogEntry(entry: QueryLogEntry): string {
  const header = `[${entry.formattedTimestamp}][${entry.serverName}][${entry.pid}][${entry.dialectTag}]`;
  const timeStr = `Time: ${(entry.durationMs / 1000).toFixed(3)}s`;
  const errorStr = entry.errorMessage ? `\n[ERROR] ${entry.errorMessage}` : '';
  return `${header}\n${maskSensitiveCredentials(entry.sql)}\n${timeStr}${errorStr}`;
}

/** Filters a list of QueryLogEntry based on user preferences */
export function filterLogEntries(entries: QueryLogEntry[], filter: HistoryLogFilter): QueryLogEntry[] {
  return entries.filter((entry) => {
    if (filter.serverTarget && filter.serverTarget !== 'ALL') {
      const matchServer =
        entry.serverName.toLowerCase() === filter.serverTarget.toLowerCase() ||
        entry.connectionId === filter.serverTarget;
      if (!matchServer) return false;
    }
    if (filter.errorsOnly && entry.level !== 'ERROR') return false;
    if (filter.slowOnly && entry.durationMs < filter.slowThresholdMs) return false;
    if (filter.category && filter.category !== 'ALL' && entry.category !== filter.category) return false;
    if (filter.search.trim() !== '') {
      const q = filter.search.toLowerCase();
      const matchSql = entry.sql.toLowerCase().includes(q);
      const matchServer = entry.serverName.toLowerCase().includes(q);
      const matchErr = entry.errorMessage ? entry.errorMessage.toLowerCase().includes(q) : false;
      if (!matchSql && !matchServer && !matchErr) return false;
    }
    return true;
  });
}

/** Exports log entries to formatted CSV */
export function exportLogsToCsv(entries: QueryLogEntry[]): string {
  const headers = ['Timestamp', 'Server', 'PID', 'Dialect', 'Category', 'Duration(ms)', 'Level', 'SQL', 'Error'];
  const rows = entries.map((e) => [
    `"${e.formattedTimestamp}"`,
    `"${e.serverName}"`,
    e.pid,
    `"${e.dialectTag}"`,
    `"${e.category}"`,
    e.durationMs,
    `"${e.level}"`,
    `"${maskSensitiveCredentials(e.sql).replace(/"/g, '""')}"`,
    `"${(e.errorMessage ?? '').replace(/"/g, '""')}"`,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/** Exports log entries to JSON */
export function exportLogsToJson(entries: QueryLogEntry[]): string {
  const sanitized = entries.map((e) => ({
    ...e,
    sql: maskSensitiveCredentials(e.sql),
  }));
  return JSON.stringify(sanitized, null, 2);
}
