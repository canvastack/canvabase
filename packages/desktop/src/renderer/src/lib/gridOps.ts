import type { RowValue, TableColumn } from '@canvabase/contracts';

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

export type RowFilters = Record<string, string>;

/** Stringify sel data tanpa fallback '[object Object]'. */
export function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return value.toString();
  }
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return value.name;
  return '';
}

export function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = stringifyCell(a);
  const sb = stringifyCell(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Sort client-side atas baris yang sudah termuat (chunk). */
export function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  sort: SortState | null,
): T[] {
  if (!sort) return rows;
  const { column, direction } = sort;
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => compareValues(a[column], b[column]) * sign);
}

/** Filter client-side substring (case-insensitive) per kolom. */
export function filterRows<T extends Record<string, unknown>>(rows: T[], filters: RowFilters): T[] {
  const columns = Object.keys(filters).filter((c) => (filters[c] ?? '').trim().length > 0);
  if (columns.length === 0) return rows;
  return rows.filter((row) =>
    columns.every((column) => {
      const needle = (filters[column] ?? '').trim().toLowerCase();
      const cell = row[column];
      if (cell === null || cell === undefined) return 'null'.includes(needle);
      return stringifyCell(cell).toLowerCase().includes(needle);
    }),
  );
}

/** Nilai kolom primary key untuk dipakai sebagai WHERE pada CRUD. */
export function pkValues(row: Record<string, unknown>, schema: TableColumn[]): RowValue[] {
  return schema
    .filter((c) => c.primaryKey)
    .map((c) => ({ column: c.name, value: row[c.name] }));
}

/**
 * Konversi input string user ke nilai sesuai tipe kolom sebelum dikirim ke DB.
 * String kosong → null (clear cell). Numerik → number (jika valid), boolean → boolean.
 * JSON/datetime/timestamp → string apa adanya (driver DB yang memvalidasi).
 */
export function coerceCellValue(columnType: string, raw: string): unknown {
  const value = raw.trim();
  if (value.length === 0) return null;
  const t = columnType.toLowerCase();
  const isNumeric =
    t.includes('int') ||
    t.includes('decimal') ||
    t.includes('numeric') ||
    t.includes('float') ||
    t.includes('double') ||
    t === 'real' ||
    t === 'number';
  if (isNumeric) {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  if (t.includes('bool')) {
    if (/^(1|true|yes|y)$/i.test(value)) return true;
    if (/^(0|false|no|n)$/i.test(value)) return false;
    return value;
  }
  return value;
}
