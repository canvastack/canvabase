import { describe, expect, it } from 'vitest';
import type { TableColumn } from '@canvabase/contracts';
import { coerceCellValue, compareValues, filterRows, pkValues, sortRows } from './gridOps.js';

const schema: TableColumn[] = [
  { name: 'id', type: 'int', nullable: false, primaryKey: true, autoIncrement: true, default: null },
  { name: 'amount', type: 'float', nullable: true, primaryKey: false, autoIncrement: false, default: null },
  { name: 'status', type: 'varchar', nullable: true, primaryKey: false, autoIncrement: false, default: null },
];

const rows = [
  { id: 2, amount: 10, status: 'active' },
  { id: 1, amount: 5, status: 'paused' },
  { id: 3, amount: null, status: 'Active' },
];

describe('gridOps', () => {
  it('compareValues handles nulls and numbers', () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues(null, 5)).toBeLessThan(0);
    expect(compareValues(5, null)).toBeGreaterThan(0);
    expect(compareValues(null, null)).toBe(0);
    expect(compareValues('a', 'b')).toBeLessThan(0);
  });

  it('sortRows ascending and descending', () => {
    expect(sortRows(rows, { column: 'id', direction: 'asc' }).map((r) => r.id)).toEqual([1, 2, 3]);
    expect(sortRows(rows, { column: 'id', direction: 'desc' }).map((r) => r.id)).toEqual([3, 2, 1]);
    expect(sortRows(rows, null)).toBe(rows);
  });

  it('sortRows sorts numbers numerically', () => {
    const result = sortRows(rows, { column: 'amount', direction: 'asc' });
    expect(result.map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it('filterRows matches substring case-insensitively on one column', () => {
    const result = filterRows(rows, { status: 'active' });
    expect(result.map((r) => r.id)).toEqual([2, 3]);
  });

  it('filterRows returns all when filter empty', () => {
    expect(filterRows(rows, { status: '' })).toBe(rows);
  });

  it('pkValues extracts primary key where values', () => {
    expect(pkValues(rows[0]!, schema)).toEqual([{ column: 'id', value: 2 }]);
  });

  it('coerceCellValue maps numeric, boolean and empty string by column type', () => {
    expect(coerceCellValue('int', '42')).toBe(42);
    expect(coerceCellValue('decimal(10,2)', '12.5')).toBe(12.5);
    expect(coerceCellValue('int', 'not-a-number')).toBe('not-a-number');
    expect(coerceCellValue('boolean', 'true')).toBe(true);
    expect(coerceCellValue('bool', '0')).toBe(false);
    expect(coerceCellValue('varchar', '   ')).toBeNull();
    expect(coerceCellValue('varchar', 'hello')).toBe('hello');
    expect(coerceCellValue('timestamp', '2024-01-01 10:00:00')).toBe('2024-01-01 10:00:00');
    expect(coerceCellValue('json', '{"a":1}')).toBe('{"a":1}');
  });
});
