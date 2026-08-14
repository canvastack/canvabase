import { describe, it, expect, beforeAll } from 'vitest';
import { filterRows, sortRows, type RowFilters } from '../../packages/desktop/src/renderer/src/lib/gridOps';

const N = 1_000_000;
const MB = 1024 * 1024;

interface BenchRow extends Record<string, unknown> {
  id: number;
  name: string;
  email: string;
  active: boolean;
  price: number;
}

let rows: BenchRow[];

function makeRows(count: number): BenchRow[] {
  const out = new Array<BenchRow>(count);
  for (let i = 0; i < count; i++) {
    out[i] = {
      id: i,
      name: `user${i % 50}`,
      email: `u${i}@canvabase.dev`,
      active: i % 2 === 0,
      price: i * 1.5,
    };
  }
  return out;
}

describe('grid performance benchmark (PERFORMANCE.md)', () => {
  beforeAll(() => {
    rows = makeRows(N);
  });

  it('holds 1M rows under the 400MB heap budget', () => {
    const heapAfter = process.memoryUsage().heapUsed;
    expect(heapAfter).toBeLessThan(400 * MB);
  });

  it('filters 1M rows within 5s (45fps target sanity)', () => {
    const filters: RowFilters = { name: 'user7' };
    const start = performance.now();
    const result = filterRows(rows, filters);
    const elapsed = performance.now() - start;
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => String(r.name).includes('7'))).toBe(true);
    expect(elapsed).toBeLessThan(5000);
  });

  it('sorts 200k rows within 5s', () => {
    const sample = makeRows(200_000);
    const start = performance.now();
    const sorted = sortRows(sample, { column: 'price', direction: 'desc' });
    const elapsed = performance.now() - start;
    expect(sorted[0]?.price).toBe(sample[0] ? 199_999 * 1.5 : NaN);
    expect(sorted.length).toBe(sample.length);
    expect(elapsed).toBeLessThan(5000);
  });
});
