// packages/desktop/src/renderer/src/lib/erdSvgExport.test.ts
import { describe, expect, it } from 'vitest';
import type { ErdGraph } from '@canvabase/contracts';
import { renderErdSvg, erdGraphToDataUrl } from './erdSvgExport';

const graph: ErdGraph = {
  version: 1,
  nodes: [
    {
      id: 'users',
      name: 'users',
      x: 0,
      y: 0,
      width: 150,
      height: 74,
      columns: [
        { name: 'id', type: 'INT', primaryKey: true, nullable: false },
        { name: 'name', type: 'VARCHAR(50)', primaryKey: false, nullable: false },
      ],
    },
    {
      id: 'orders',
      name: 'orders',
      x: 230,
      y: 0,
      width: 170,
      height: 52,
      columns: [{ name: 'user_id', type: 'INT', primaryKey: false, nullable: true }],
    },
  ],
  edges: [
    { id: 'orders.user_id -> users.id', source: 'orders', target: 'users', columns: ['user_id'], type: 'one-many' },
  ],
};

describe('renderErdSvg', () => {
  it('renders both table names and column names', () => {
    const svg = renderErdSvg(graph);
    expect(svg).toContain('<svg');
    expect(svg).toContain('users');
    expect(svg).toContain('orders');
    expect(svg).toContain('user_id');
    expect(svg).toContain('VARCHAR(50)');
  });

  it('draws an edge path between source and target', () => {
    const svg = renderErdSvg(graph);
    expect(svg).toMatch(/<path d="M [\d.]+ [\d.]+ C [\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+"/);
    expect(svg).toContain('marker-end');
  });

  it('escapes XML special characters in names', () => {
    const svg = renderErdSvg({
      ...graph,
      nodes: [{ id: 'users', name: 'a & b <c>', x: 0, y: 0, width: 150, height: 74, columns: [] }],
    });
    expect(svg).toContain('a &amp; b &lt;c&gt;');
    expect(svg).not.toContain('a & b <c>');
  });

  it('handles empty graphs', () => {
    const svg = renderErdSvg({ version: 1, nodes: [], edges: [] });
    expect(svg).toContain('<svg');
  });
});

describe('erdGraphToDataUrl', () => {
  it('returns a base64 svg data URL accepted by the main process', () => {
    const dataUrl = erdGraphToDataUrl(graph);
    expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
    const svg = decodeURIComponent(escape(atob(dataUrl.split(',')[1] ?? '')));
    expect(svg).toContain('<svg');
    expect(svg).toContain('orders');
  });
});
