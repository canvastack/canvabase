import { describe, expect, it } from 'vitest';
import { computeNodeSize, layoutGrid } from './erdLayout.js';

describe('computeNodeSize', () => {
  it('respects minimum width', () => {
    const size = computeNodeSize('t', []);
    expect(size.width).toBeGreaterThanOrEqual(150);
    expect(size.height).toBeGreaterThanOrEqual(30);
  });

  it('grows with table name length', () => {
    const short = computeNodeSize('users', []);
    const long = computeNodeSize('very_long_user_accounts_table_name', []);
    expect(long.width).toBeGreaterThan(short.width);
  });

  it('heights scale with column count', () => {
    const one = computeNodeSize('t', [{ name: 'id', type: 'INT', primaryKey: true, nullable: false }]);
    const three = computeNodeSize('t', [
      { name: 'id', type: 'INT', primaryKey: true, nullable: false },
      { name: 'name', type: 'TEXT', primaryKey: false, nullable: true },
      { name: 'email', type: 'TEXT', primaryKey: false, nullable: true },
    ]);
    expect(three.height).toBeGreaterThan(one.height);
    expect(three.height - one.height).toBe(2 * 22);
  });
});

describe('layoutGrid', () => {
  it('returns empty map for no nodes', () => {
    expect(layoutGrid([]).size).toBe(0);
  });

  it('places a single node at origin', () => {
    const pos = layoutGrid([{ id: 'a', width: 200, height: 100 }]);
    expect(pos.get('a')).toEqual({ x: 0, y: 0 });
  });

  it('produces deterministic grid without overlapping cells', () => {
    const sizings = Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`,
      width: 150 + (i % 3) * 20,
      height: 100 + (i % 2) * 44,
    }));
    const a = layoutGrid(sizings);
    const b = layoutGrid(sizings);
    expect(a).toEqual(b);

    const positions = [...a.values()];
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const p1 = positions[i];
        const p2 = positions[j];
        const node1 = sizings[i];
        const node2 = sizings[j];
        if (!p1 || !p2 || !node1 || !node2) continue;
        const gapX = Math.abs(p1.x - p2.x);
        const gapY = Math.abs(p1.y - p2.y);
        const overlapX = gapX < Math.min(node1.width, node2.width);
        const overlapY = gapY < Math.min(node1.height, node2.height);
        expect(overlapX && overlapY, `nodes ${i} and ${j} overlap`).toBe(false);
      }
    }
  });

  it('places all nodes with a position', () => {
    const sizings = Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, width: 180, height: 120 }));
    const pos = layoutGrid(sizings);
    for (const s of sizings) expect(pos.get(s.id)).toBeDefined();
  });
});
