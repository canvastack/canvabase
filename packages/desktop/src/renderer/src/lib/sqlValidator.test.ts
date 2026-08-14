import { describe, expect, it } from 'vitest';
import { validateSql } from './sqlValidator';

describe('sqlValidator', () => {
  it('returns empty diagnostics for valid simple SQL', () => {
    const sql = 'SELECT id, name FROM users WHERE active = 1;';
    const diagnostics = validateSql(sql, 'mysql');
    expect(diagnostics).toHaveLength(0);
  });

  it('detects unclosed single quote string literals', () => {
    const sql = "SELECT * FROM users WHERE name = 'John Doe";
    const diagnostics = validateSql(sql, 'mysql');
    expect(diagnostics.some((d) => d.severity === 'error' && d.message.includes('Unclosed string literal'))).toBe(true);
  });

  it('detects unclosed parentheses in function calls', () => {
    const sql = 'SELECT COUNT(1 FROM users;';
    const diagnostics = validateSql(sql, 'mysql');
    expect(diagnostics.some((d) => d.severity === 'error' && d.message.includes("Unclosed bracket '('"))).toBe(true);
  });

  it('detects unexpected closing parentheses', () => {
    const sql = 'SELECT 1));';
    const diagnostics = validateSql(sql, 'mysql');
    expect(diagnostics.some((d) => d.severity === 'error' && d.message.includes("Unexpected closing ')'"))).toBe(true);
  });

  it('detects trailing comma before FROM', () => {
    const sql = 'SELECT id, name, FROM users;';
    const diagnostics = validateSql(sql, 'mysql');
    expect(diagnostics.some((d) => d.severity === 'error' && d.message.includes('Trailing comma'))).toBe(true);
  });

  it('detects empty WHERE clause', () => {
    const sql = 'SELECT * FROM users WHERE ORDER BY id;';
    const diagnostics = validateSql(sql, 'mysql');
    expect(diagnostics.some((d) => d.severity === 'error' && d.message.includes('WHERE clause is missing condition'))).toBe(true);
  });

  it('detects missing table in FROM clause', () => {
    const sql = 'SELECT id FROM WHERE id = 1;';
    const diagnostics = validateSql(sql, 'mysql');
    expect(diagnostics.some((d) => d.severity === 'error' && d.message.includes('FROM keyword is missing table name'))).toBe(true);
  });

  it('warns when using PostgreSQL cast :: in MySQL dialect', () => {
    const sql = 'SELECT id::text FROM users;';
    const diagnostics = validateSql(sql, 'mysql');
    expect(diagnostics.some((d) => d.severity === 'warning' && d.message.includes('not supported in MySQL'))).toBe(true);
  });

  it('warns when using backticks in PostgreSQL dialect', () => {
    const sql = 'SELECT `name` FROM users;';
    const diagnostics = validateSql(sql, 'postgres');
    expect(diagnostics.some((d) => d.severity === 'warning' && d.message.includes('double quotes'))).toBe(true);
  });

  it('warns when using comma in LIMIT for PostgreSQL', () => {
    const sql = 'SELECT * FROM users LIMIT 10, 20;';
    const diagnostics = validateSql(sql, 'postgres');
    expect(diagnostics.some((d) => d.severity === 'warning' && d.message.includes('LIMIT count OFFSET offset'))).toBe(true);
  });
});
