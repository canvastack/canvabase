import type { ErdGraph, ErdNode, ErdEdge } from '@canvabase/contracts';

const PADDING = 40;
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 22;

const COLORS = {
  background: '#0f1222',
  nodeHeader: '#4338ca',
  nodeBody: '#1b1f35',
  nodeBorder: '#2a2f4a',
  title: '#e6e8f2',
  text: '#c3c8dd',
  muted: '#9aa0b5',
  pk: '#f59e0b',
  edge: '#6366f1',
  edgeLabel: '#e6e8f2',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function computeBounds(nodes: ErdNode[]): { minX: number; minY: number; width: number; height: number } {
  if (nodes.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...nodes.map((n) => n.y + n.height));
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function renderNode(node: ErdNode, dx: number, dy: number): string {
  const bodyHeight = node.height - HEADER_HEIGHT;
  const bodyRows = Math.max(0, Math.min(node.columns.length, Math.floor(bodyHeight / ROW_HEIGHT)));
  const parts: string[] = [];

  parts.push(
    `<g transform="translate(${(node.x - dx).toFixed(2)} ${(node.y - dy).toFixed(2)})">`,
    `<rect x="0" y="0" width="${node.width}" height="${HEADER_HEIGHT}" rx="6" fill="${COLORS.nodeHeader}"/>`,
    `<rect x="0" y="${HEADER_HEIGHT}" width="${node.width}" height="${node.height - HEADER_HEIGHT}" fill="${COLORS.nodeBody}" stroke="${COLORS.nodeBorder}" stroke-width="1"/>`,
  );

  const truncated = node.name.length > 24 ? `${node.name.slice(0, 23)}…` : node.name;
  parts.push(
    `<text x="10" y="${HEADER_HEIGHT / 2 + 5}" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="${COLORS.title}">${escapeXml(truncated)}</text>`,
    `<text x="${node.width - 10}" y="${HEADER_HEIGHT / 2 + 5}" text-anchor="end" font-family="system-ui, sans-serif" font-size="11" fill="${COLORS.muted}">${node.columns.length}</text>`,
  );

  node.columns.slice(0, bodyRows).forEach((col, index) => {
    const y = HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT - 6;
    const isLast = index === bodyRows - 1 && bodyRows < node.columns.length;
    if (col.primaryKey) {
      parts.push(
        `<circle cx="12" cy="${y - 5}" r="3.5" fill="${COLORS.pk}"/>`,
        `<text x="22" y="${y}" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="${COLORS.title}">${escapeXml(col.name)}</text>`,
      );
    } else {
      parts.push(`<text x="22" y="${y}" font-family="system-ui, sans-serif" font-size="12" fill="${COLORS.text}">${escapeXml(col.name)}</text>`);
    }
    parts.push(
      `<text x="${node.width - 10}" y="${y}" text-anchor="end" font-family="system-ui, sans-serif" font-size="11" fill="${COLORS.muted}">${escapeXml(col.type)}</text>`,
      `<line x1="0" y1="${y + 5}" x2="${node.width}" y2="${y + 5}" stroke="${COLORS.nodeBorder}" stroke-width="0.5"/>`,
    );
    if (isLast) {
      parts.push(
        `<text x="10" y="${y + 16}" font-family="system-ui, sans-serif" font-size="11" fill="${COLORS.muted}">+${node.columns.length - bodyRows} more…</text>`,
      );
    }
  });

  parts.push(`</g>`);
  return parts.join('');
}

function renderEdge(edge: ErdEdge, nodeById: Map<string, ErdNode>, dx: number, dy: number): string {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  if (!source || !target) return '';

  const sx = source.x - dx + source.width;
  const sy = source.y - dy + source.height / 2;
  const tx = target.x - dx;
  const ty = target.y - dy + target.height / 2;
  const midX = (sx + tx) / 2;

  const label = edge.columns.join(', ');
  const labelX = (sx + tx) / 2;
  const labelY = (sy + ty) / 2;

  const parts: string[] = [];
  parts.push(
    `<defs><marker id="arrow-${escapeXml(edge.id)}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="${COLORS.edge}"/></marker></defs>`,
    `<path d="M ${sx.toFixed(2)} ${sy.toFixed(2)} C ${midX.toFixed(2)} ${sy.toFixed(2)} ${midX.toFixed(2)} ${ty.toFixed(2)} ${tx.toFixed(2)} ${ty.toFixed(2)}" fill="none" stroke="${COLORS.edge}" stroke-width="1.5" marker-end="url(#arrow-${escapeXml(edge.id)})"/>`,
    `<text x="${labelX.toFixed(2)}" y="${(labelY - 6).toFixed(2)}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" fill="${COLORS.edgeLabel}">${escapeXml(label)}</text>`,
  );
  return parts.join('');
}

/**
 * Render graf ERD menjadi SVG murni (tanpa dependency) untuk ekspor.
 * Posisi/ukuran node diambil dari layout deterministik ErdService sehingga
 * output konsisten dengan diagram yang dirender di canvas.
 */
export function renderErdSvg(graph: ErdGraph): string {
  const { minX, minY, width, height } = computeBounds(graph.nodes);
  const canvasWidth = Math.max(1, Math.ceil(width) + PADDING * 2);
  const canvasHeight = Math.max(1, Math.ceil(height) + PADDING * 2);
  const dx = minX - PADDING;
  const dy = minY - PADDING;

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const body: string[] = [
    `<rect width="100%" height="100%" fill="${COLORS.background}"/>`,
    `<rect x="1" y="1" width="${canvasWidth - 2}" height="${canvasHeight - 2}" rx="8" fill="none" stroke="${COLORS.nodeBorder}" stroke-width="1"/>`,
  ];
  for (const edge of graph.edges) {
    body.push(renderEdge(edge, nodeById, dx, dy));
  }
  for (const node of graph.nodes) {
    body.push(renderNode(node, dx, dy));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">${body.join('')}</svg>`;
}

/** Konversi graf ERD ke data URL SVG base64 (format yang diterima main process ErdService.exportImage). */
export function erdGraphToDataUrl(graph: ErdGraph): string {
  const svg = renderErdSvg(graph);
  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}
