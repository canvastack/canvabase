export type SqlTokenKind =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'identifier'
  | 'operator'
  | 'punct';

export interface SqlToken {
  text: string;
  kind: SqlTokenKind;
}

const KEYWORDS = new Set([
  'select', 'from', 'where', 'group', 'by', 'order', 'limit', 'offset', 'having',
  'join', 'inner', 'left', 'right', 'outer', 'full', 'on', 'as', 'insert', 'into',
  'values', 'update', 'set', 'delete', 'create', 'alter', 'drop', 'table', 'view',
  'index', 'primary', 'key', 'foreign', 'references', 'unique', 'and', 'or', 'not',
  'null', 'is', 'in', 'between', 'like', 'case', 'when', 'then', 'else', 'end',
  'distinct', 'exists', 'union', 'all',
  'default', 'constraint', 'if', 'else', 'while', 'begin', 'commit', 'rollback',
  'transaction', 'explain', 'describe', 'show', 'use', 'grant', 'revoke',
]);

const FUNCTIONS = new Set([
  'count', 'sum', 'avg', 'min', 'max', 'concat', 'coalesce', 'nullif', 'now',
  'current_timestamp', 'date', 'cast', 'convert', 'lower', 'upper', 'length',
  'trim', 'substring', 'replace', 'round', 'floor', 'ceil', 'abs', 'greatest',
  'least', 'rand', 'uuid', 'json_extract',
]);

const OPERATORS = new Set(['=', '<', '>', '<=', '>=', '<>', '!=', '<=>', '+', '-', '*', '/', '%', '||', '&', '|', '^', '~', '->', '->>', '::']);

export function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i]!;

    if (ch === '-' && sql[i + 1] === '-') {
      let end = sql.indexOf('\n', i);
      if (end === -1) end = n;
      tokens.push({ text: sql.slice(i, end), kind: 'comment' });
      i = end;
      continue;
    }

    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      tokens.push({ text: sql.slice(i, stop), kind: 'comment' });
      i = stop;
      continue;
    }

    if (ch === '#') {
      let end = sql.indexOf('\n', i);
      if (end === -1) end = n;
      tokens.push({ text: sql.slice(i, end), kind: 'comment' });
      i = end;
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      j = Math.min(j + 1, n);
      tokens.push({ text: sql.slice(i, j), kind: 'string' });
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[0-9.eE+-]/.test(sql[j]!)) j++;
      tokens.push({ text: sql.slice(i, j), kind: 'number' });
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[a-zA-Z0-9_$]/.test(sql[j]!)) j++;
      const word = sql.slice(i, j);
      const lower = word.toLowerCase();
      let kind: SqlTokenKind = 'identifier';
      if (KEYWORDS.has(lower)) kind = 'keyword';
      else if (FUNCTIONS.has(lower)) kind = 'function';
      tokens.push({ text: word, kind });
      i = j;
      continue;
    }

    if (ch === '(' && tokens.length > 0 && tokens[tokens.length - 1]!.kind === 'function') {
      tokens.push({ text: '(', kind: 'punct' });
      i++;
      continue;
    }

    if (/\s/.test(ch)) {
      let j = i + 1;
      while (j < n && /\s/.test(sql[j]!)) j++;
      tokens.push({ text: sql.slice(i, j), kind: 'punct' });
      i = j;
      continue;
    }

    if (OPERATORS.has(ch)) {
      tokens.push({ text: ch, kind: 'operator' });
      i++;
      continue;
    }

    tokens.push({ text: ch, kind: 'punct' });
    i++;
  }

  return tokens;
}

export function highlightSql(sql: string): string {
  return tokenizeSql(sql)
    .map((t) => {
      if (t.kind === 'punct') return escapeHtml(t.text);
      return `<span class="sql-${t.kind}">${escapeHtml(t.text)}</span>`;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
