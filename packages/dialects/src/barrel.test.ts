import { describe, expect, it } from 'vitest';
import type { TableDraft } from '@canvabase/contracts';
import {
  MySQLAdapter,
  PostgreSQLAdapter,
  SQLiteAdapter,
  toNullableString,
} from './index.js';

const draft: TableDraft = {
  name: 't',
  schema: null,
  columns: [
    { name: 'id', type: 'INT', nullable: false, default: null, autoIncrement: true, isPrimaryKey: true },
  ],
  indexes: [],
  foreignKeys: [],
};

describe('dialects barrel', () => {
  it('exports all adapters', () => {
    expect(new MySQLAdapter().name).toBe('mysql');
    expect(new PostgreSQLAdapter().name).toBe('postgresql');
    expect(new SQLiteAdapter().name).toBe('sqlite');
  });

  it('mysql previewDdl emits CREATE TABLE with auto-increment PK', () => {
    const sql = new MySQLAdapter().previewDdl(draft);
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('AUTO_INCREMENT');
  });

  it('postgres previewDdl emits CREATE TABLE with quoted identifiers', () => {
    const sql = new PostgreSQLAdapter().previewDdl(draft);
    expect(sql).toContain('CREATE TABLE');
    expect(sql).toContain('"t"');
  });
});

describe('toNullableString', () => {
  it('maps null/undefined to null', () => {
    expect(toNullableString(null)).toBeNull();
    expect(toNullableString(undefined)).toBeNull();
  });

  it('stringifies primitives without object fallback', () => {
    expect(toNullableString('x')).toBe('x');
    expect(toNullableString(42)).toBe('42');
    expect(toNullableString(true)).toBe('true');
    expect(toNullableString(Symbol('s'))).toBe('Symbol(s)');
  });

  it('stringifies Date to ISO and objects to JSON', () => {
    expect(toNullableString(new Date('2020-01-01T00:00:00.000Z'))).toBe('2020-01-01T00:00:00.000Z');
    expect(toNullableString({ a: 1 })).toBe('{"a":1}');
  });

  it('returns function name for functions', () => {
    function foo(): void {}
    expect(toNullableString(foo)).toBe('foo');
  });
});
