import { describe, expect, it } from 'vitest';
import { tokenizeSql, highlightSql } from './sqlHighlighter';

describe('tokenizeSql', () => {
  it('classifies keywords, strings, numbers, and comments', () => {
    const tokens = tokenizeSql("SELECT * FROM t WHERE id = 42 AND name = 'alice' -- note");
    expect(tokens.some((t) => t.kind === 'keyword' && t.text === 'SELECT')).toBe(true);
    expect(tokens.some((t) => t.kind === 'keyword' && t.text === 'FROM')).toBe(true);
    expect(tokens.some((t) => t.kind === 'number' && t.text === '42')).toBe(true);
    expect(tokens.some((t) => t.kind === 'string' && t.text === "'alice'")).toBe(true);
    expect(tokens.some((t) => t.kind === 'comment' && t.text.startsWith('--'))).toBe(true);
    expect(tokens.some((t) => t.kind === 'identifier' && t.text === 't')).toBe(true);
  });

  it('handles backtick and double-quoted identifiers', () => {
    const tokens = tokenizeSql('SELECT `col one`, "other" FROM t');
    expect(tokens.some((t) => t.kind === 'string' && t.text === '`col one`')).toBe(true);
    expect(tokens.some((t) => t.kind === 'string' && t.text === '"other"')).toBe(true);
  });

  it('handles block comments spanning multiple lines', () => {
    const tokens = tokenizeSql('SELECT 1 /* multi\nline */ FROM t');
    expect(tokens.some((t) => t.kind === 'comment' && t.text.includes('multi\nline'))).toBe(true);
  });

  it('marks function names before opening paren', () => {
    const tokens = tokenizeSql('SELECT COUNT(*) FROM t');
    expect(tokens.some((t) => t.kind === 'function' && t.text === 'COUNT')).toBe(true);
  });

  it('preserves total length of input across tokens', () => {
    const sql = "SELECT a, b FROM t WHERE c IN (1, 2, 3) -- tail";
    const joined = tokenizeSql(sql)
      .map((t) => t.text)
      .join('');
    expect(joined).toBe(sql);
  });
});

describe('highlightSql', () => {
  it('wraps non-punct tokens in spans', () => {
    const html = highlightSql('SELECT 1');
    expect(html).toContain('<span class="sql-keyword">SELECT</span>');
    expect(html).toContain('<span class="sql-number">1</span>');
  });

  it('escapes HTML in identifiers', () => {
    const html = highlightSql('SELECT <script> FROM t');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).not.toContain('<script>');
  });
});
