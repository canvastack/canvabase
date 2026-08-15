import type { TableColumn } from '@canvabase/contracts';

/**
 * SQL codec pure — literal escaping, CREATE TABLE builder, dan statement
 * splitter aman (respect quote + line comment). Dipakai TransferService.
 */

/** Escape literal string SQL dengan quote tunggal ('' doubling). */
export function sqlEscapeString(value: string): string {
  return `'${value.split("'").join("''")}'`;
}

/** Literal SQL aman dari satu nilai — numeric verbatim, NULL, string di-quote. */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return sqlEscapeString(value.toISOString());
  if (typeof value === 'string') return sqlEscapeString(value);
  return sqlEscapeString(JSON.stringify(value));
}

interface IdentifierQuoter {
  (identifier: string): string;
}

/** Build `CREATE TABLE IF NOT EXISTS` dari schema kolom (tanpa FK/index). */
export function buildCreateTable(
  table: string,
  columns: TableColumn[],
  quoteIdentifier: IdentifierQuoter,
): string {
  const cols = columns
    .map((col) => {
      const parts = [quoteIdentifier(col.name), col.type];
      if (col.primaryKey) parts.push('PRIMARY KEY');
      if (!col.nullable) parts.push('NOT NULL');
      if (col.default !== null && col.default !== undefined) parts.push(`DEFAULT ${col.default}`);
      return `  ${parts.join(' ')}`;
    })
    .join(',\n');
  return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table)} (\n${cols}\n);`;
}

/** Split script SQL jadi statement terpisah — aman terhadap string & komentar baris. */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      else continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingle) {
      current += ch;
      if (ch === "'") {
        if (next === "'") {
          current += next;
          i++;
        } else {
          inSingle = false;
        }
      }
      continue;
    }
    if (inDouble) {
      current += ch;
      if (ch === '"') {
        if (next === '"') {
          current += next;
          i++;
        } else {
          inDouble = false;
        }
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      current += ch;
      continue;
    }
    if (ch === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      continue;
    }
    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) statements.push(trimmed);
  return statements;
}

/** Statement berbahaya yang diblokir saat SQL import (proteksi destruktif). */
const DANGEROUS_PATTERN = /^\s*(drop|alter|truncate|grant|revoke|create\s+user|set\s+password|replace)\b/i;

export function isDangerousStatement(statement: string): boolean {
  if (DANGEROUS_PATTERN.test(statement)) return true;
  if (/^\s*(delete|update)\b/i.test(statement) && !/\bwhere\b/i.test(statement)) return true;
  return false;
}
