/**
 * Dialect-Aware SQL Syntax Validator for CanvaBase
 * Supports MySQL, PostgreSQL, and SQLite with detailed diagnostic positions (line, column).
 */

export interface SqlDiagnostic {
  line: number; // 1-indexed
  column: number; // 1-indexed
  length: number;
  message: string;
  severity: 'error' | 'warning';
}

export type SqlDialect = 'mysql' | 'postgres' | 'sqlite' | 'mssql' | 'unknown';

export function validateSql(sql: string, dialect: SqlDialect = 'mysql'): SqlDiagnostic[] {
  const diagnostics: SqlDiagnostic[] = [];
  if (!sql || sql.trim().length === 0) return diagnostics;

  const lines = sql.split('\n');

  // 1. Bracket & Quote Matching with exact line/column tracking
  const parenStack: Array<{ char: string; line: number; col: number; pos: number }> = [];
  let inSingleQuote = false;
  let singleQuoteStart = { line: 1, col: 1, pos: 0 };
  let inDoubleQuote = false;
  let doubleQuoteStart = { line: 1, col: 1, pos: 0 };
  let inBacktick = false;
  let backtickStart = { line: 1, col: 1, pos: 0 };
  let inBlockComment = false;
  let blockCommentStart = { line: 1, col: 1, pos: 0 };

  let curLine = 1;
  let curCol = 1;
  const n = sql.length;

  for (let i = 0; i < n; i++) {
    const ch = sql[i]!;
    const nextCh = sql[i + 1] || '';

    // Handle line tracking
    if (ch === '\n') {
      curLine++;
      curCol = 1;
      continue;
    }

    // Inside Block Comment
    if (inBlockComment) {
      if (ch === '*' && nextCh === '/') {
        inBlockComment = false;
        i++;
        curCol += 2;
        continue;
      }
      curCol++;
      continue;
    }

    // Inside Single Quote String
    if (inSingleQuote) {
      if (ch === "'") {
        if (nextCh === "'") {
          // Escaped single quote
          i++;
          curCol += 2;
          continue;
        }
        inSingleQuote = false;
      }
      curCol++;
      continue;
    }

    // Inside Double Quote String / Identifier
    if (inDoubleQuote) {
      if (ch === '"') {
        if (nextCh === '"') {
          i++;
          curCol += 2;
          continue;
        }
        inDoubleQuote = false;
      }
      curCol++;
      continue;
    }

    // Inside Backtick Identifier (MySQL / SQLite)
    if (inBacktick) {
      if (ch === '`') {
        inBacktick = false;
      }
      curCol++;
      continue;
    }

    // Start Single-line Comment
    if ((ch === '-' && nextCh === '-') || ch === '#') {
      // Advance to end of line
      const nextNl = sql.indexOf('\n', i);
      if (nextNl === -1) {
        break;
      } else {
        curCol += nextNl - i;
        i = nextNl - 1;
        continue;
      }
    }

    // Start Block Comment
    if (ch === '/' && nextCh === '*') {
      inBlockComment = true;
      blockCommentStart = { line: curLine, col: curCol, pos: i };
      i++;
      curCol += 2;
      continue;
    }

    // Start Single Quote
    if (ch === "'") {
      inSingleQuote = true;
      singleQuoteStart = { line: curLine, col: curCol, pos: i };
      curCol++;
      continue;
    }

    // Start Double Quote
    if (ch === '"') {
      inDoubleQuote = true;
      doubleQuoteStart = { line: curLine, col: curCol, pos: i };
      curCol++;
      continue;
    }

    // Start Backtick
    if (ch === '`') {
      if (dialect === 'postgres') {
        diagnostics.push({
          line: curLine,
          column: curCol,
          length: 1,
          message: 'PostgreSQL uses double quotes (") for identifiers, not backticks (`)',
          severity: 'warning',
        });
      }
      inBacktick = true;
      backtickStart = { line: curLine, col: curCol, pos: i };
      curCol++;
      continue;
    }

    // Parentheses & Brackets
    if (ch === '(' || ch === '[') {
      parenStack.push({ char: ch, line: curLine, col: curCol, pos: i });
      curCol++;
      continue;
    }

    if (ch === ')' || ch === ']') {
      if (parenStack.length === 0) {
        diagnostics.push({
          line: curLine,
          column: curCol,
          length: 1,
          message: `Unexpected closing '${ch}' without matching opening`,
          severity: 'error',
        });
      } else {
        const last = parenStack.pop()!;
        const expected = last.char === '(' ? ')' : ']';
        if (ch !== expected) {
          diagnostics.push({
            line: curLine,
            column: curCol,
            length: 1,
            message: `Mismatched bracket: expected '${expected}', got '${ch}'`,
            severity: 'error',
          });
        }
      }
      curCol++;
      continue;
    }

    // PostgreSQL Type Cast operator (::) check in MySQL
    if (ch === ':' && nextCh === ':' && dialect === 'mysql') {
      diagnostics.push({
        line: curLine,
        column: curCol,
        length: 2,
        message: "PostgreSQL type cast '::' is not supported in MySQL. Use CAST(val AS type) instead.",
        severity: 'warning',
      });
    }

    curCol++;
  }

  // Check unclosed tokens
  if (inSingleQuote) {
    diagnostics.push({
      line: singleQuoteStart.line,
      column: singleQuoteStart.col,
      length: Math.max(1, (lines[singleQuoteStart.line - 1]?.length ?? 1) - singleQuoteStart.col + 1),
      message: "Unclosed string literal (missing closing single quote: ')",
      severity: 'error',
    });
  }

  if (inDoubleQuote) {
    diagnostics.push({
      line: doubleQuoteStart.line,
      column: doubleQuoteStart.col,
      length: Math.max(1, (lines[doubleQuoteStart.line - 1]?.length ?? 1) - doubleQuoteStart.col + 1),
      message: 'Unclosed quoted identifier (missing closing double quote: ")',
      severity: 'error',
    });
  }

  if (inBacktick) {
    diagnostics.push({
      line: backtickStart.line,
      column: backtickStart.col,
      length: Math.max(1, (lines[backtickStart.line - 1]?.length ?? 1) - backtickStart.col + 1),
      message: 'Unclosed backtick identifier (missing closing `)',
      severity: 'error',
    });
  }

  if (inBlockComment) {
    diagnostics.push({
      line: blockCommentStart.line,
      column: blockCommentStart.col,
      length: 2,
      message: 'Unclosed block comment (missing closing */)',
      severity: 'error',
    });
  }

  while (parenStack.length > 0) {
    const unclosed = parenStack.pop()!;
    diagnostics.push({
      line: unclosed.line,
      column: unclosed.col,
      length: 1,
      message: `Unclosed bracket '${unclosed.char}'`,
      severity: 'error',
    });
  }

  // 2. Syntax Structure & Clause Analysis
  const sanitizedSql = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  // Trailing comma check before FROM or WHERE or GROUP or ORDER or LIMIT or closing parenthesis
  const trailingCommaRegex = /,\s*(FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|\))/gi;
  let match: RegExpExecArray | null;
  while ((match = trailingCommaRegex.exec(sanitizedSql)) !== null) {
    const commaPos = match.index;
    const { line, col } = offsetToLineCol(sql, commaPos);
    diagnostics.push({
      line,
      column: col,
      length: 1,
      message: `Syntax Error: Trailing comma before '${match[1]}'`,
      severity: 'error',
    });
  }

  // Empty WHERE clause check (WHERE followed immediately by ORDER/GROUP/LIMIT/;)
  const emptyWhereRegex = /\bWHERE\s*(ORDER\s+BY|GROUP\s+BY|LIMIT|HAVING|UNION|;|$)/gi;
  while ((match = emptyWhereRegex.exec(sanitizedSql)) !== null) {
    const { line, col } = offsetToLineCol(sql, match.index);
    diagnostics.push({
      line,
      column: col,
      length: 5,
      message: 'Syntax Error: WHERE clause is missing condition expression',
      severity: 'error',
    });
  }

  // Missing table in FROM (e.g. "FROM WHERE" or "FROM ;" or "FROM ORDER BY")
  const emptyFromRegex = /\bFROM\s*(WHERE|ORDER\s+BY|GROUP\s+BY|LIMIT|HAVING|;|$)/gi;
  while ((match = emptyFromRegex.exec(sanitizedSql)) !== null) {
    const { line, col } = offsetToLineCol(sql, match.index);
    diagnostics.push({
      line,
      column: col,
      length: 4,
      message: 'Syntax Error: FROM keyword is missing table name or subquery',
      severity: 'error',
    });
  }

  // SELECT directly followed by FROM (SELECT FROM)
  const emptySelectRegex = /\bSELECT\s+(FROM\b)/gi;
  while ((match = emptySelectRegex.exec(sanitizedSql)) !== null) {
    const { line, col } = offsetToLineCol(sql, match.index);
    diagnostics.push({
      line,
      column: col,
      length: 6,
      message: 'Syntax Error: SELECT is missing column expressions before FROM',
      severity: 'error',
    });
  }

  // Dialect-specific LIMIT validation
  if (dialect === 'postgres' || dialect === 'sqlite') {
    // MySQL-style `LIMIT 10, 20` (comma in limit)
    const mysqlLimitCommaRegex = /\bLIMIT\s+\d+\s*,\s*\d+/gi;
    while ((match = mysqlLimitCommaRegex.exec(sanitizedSql)) !== null) {
      const { line, col } = offsetToLineCol(sql, match.index);
      diagnostics.push({
        line,
        column: col,
        length: match[0].length,
        message: `${dialect.toUpperCase()} does not support 'LIMIT offset, count'. Use 'LIMIT count OFFSET offset' instead.`,
        severity: 'warning',
      });
    }
  }

  return diagnostics;
}

function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
  let line = 1;
  let lastNl = -1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      lastNl = i;
    }
  }
  const col = offset - lastNl;
  return { line, col };
}
