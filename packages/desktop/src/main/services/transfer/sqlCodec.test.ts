import { describe, expect, it } from 'vitest';
import {
  buildCreateTable,
  isDangerousStatement,
  splitSqlStatements,
  sqlEscapeString,
  sqlLiteral,
} from './sqlCodec.js';

describe('sqlCodec literal', () => {
  it('doubles single quotes', () => {
    expect(sqlEscapeString("O'Brien")).toBe("'O''Brien'");
  });

  it('emits NULL, verbatim numbers and booleans', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral(undefined)).toBe('NULL');
    expect(sqlLiteral(42)).toBe('42');
    expect(sqlLiteral(-1.5)).toBe('-1.5');
    expect(sqlLiteral(true)).toBe('TRUE');
  });

  it('escapes strings and serializes objects', () => {
    expect(sqlLiteral("O'Brien")).toBe("'O''Brien'");
    expect(sqlLiteral({ a: 1 })).toBe("'{\"a\":1}'");
    expect(sqlLiteral(new Date('2024-01-02T03:04:05.000Z'))).toBe("'2024-01-02T03:04:05.000Z'");
  });
});

describe('sqlCodec create table', () => {
  const quote = (id: string): string => `"${id}"`;

  it('builds CREATE TABLE with PK, NOT NULL and default', () => {
    const sql = buildCreateTable(
      'users',
      [
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true, default: null },
        { name: 'name', type: 'TEXT', nullable: true, primaryKey: false, autoIncrement: false, default: "'anon'" },
      ],
      quote,
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(sql).toContain('"id" INTEGER PRIMARY KEY NOT NULL');
    expect(sql).toContain('"name" TEXT DEFAULT ');
  });
});

describe('sqlCodec splitter', () => {
  it('splits on top-level semicolons', () => {
    expect(splitSqlStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('ignores semicolons inside string literals', () => {
    expect(splitSqlStatements("INSERT INTO t VALUES ('a;b'); SELECT 1;")).toEqual([
      "INSERT INTO t VALUES ('a;b')",
      'SELECT 1',
    ]);
  });

  it('ignores doubled-quote escapes', () => {
    expect(splitSqlStatements("SELECT 'it''s; fine'; SELECT 2")).toEqual([
      "SELECT 'it''s; fine'",
      'SELECT 2',
    ]);
  });

  it('strips line and block comments', () => {
    expect(splitSqlStatements('-- drop me\nSELECT 1; /* keep this out */ SELECT 2;')).toEqual([
      'SELECT 1',
      'SELECT 2',
    ]);
  });

  it('returns trailing statement without semicolon', () => {
    expect(splitSqlStatements('SELECT 1')).toEqual(['SELECT 1']);
  });
});

describe('sqlCodec danger guard', () => {
  it('blocks destructive DDL/DCL', () => {
    for (const stmt of [
      'DROP TABLE users',
      'ALTER TABLE users ADD COLUMN x',
      'TRUNCATE TABLE users',
      'GRANT ALL ON users TO bob',
      'REVOKE SELECT ON users FROM bob',
      'CREATE USER evil',
      'SET PASSWORD FOR bob = 123',
    ]) {
      expect(isDangerousStatement(stmt)).toBe(true);
    }
  });

  it('blocks full-table DML without WHERE', () => {
    for (const stmt of ['DELETE FROM users', 'DELETE FROM users;', 'UPDATE users SET x = 1', 'REPLACE INTO users VALUES (1)']) {
      expect(isDangerousStatement(stmt)).toBe(true);
    }
  });

  it('allows scoped DML with WHERE', () => {
    for (const stmt of ['DELETE FROM users WHERE id = 5', 'UPDATE users SET x = 1 WHERE id = 5', 'DELETE FROM audit_log WHERE created_at < NOW()']) {
      expect(isDangerousStatement(stmt)).toBe(false);
    }
  });

  it('allows safe DML/DDL', () => {
    for (const stmt of ['SELECT * FROM users', 'INSERT INTO users VALUES (1)', 'CREATE TABLE t (id INT)']) {
      expect(isDangerousStatement(stmt)).toBe(false);
    }
  });
});
