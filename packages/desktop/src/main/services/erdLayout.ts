import type { ErdColumn } from '@canvabase/contracts';

export const ERD_HEADER_HEIGHT = 30;
export const ERD_ROW_HEIGHT = 22;
export const ERD_FOOTER_HEIGHT = 8;
export const ERD_MIN_WIDTH = 150;
export const ERD_GAP_X = 80;
export const ERD_GAP_Y = 40;

/**
 * Ukuran node tabel berdasarkan panjang nama + jumlah kolom.
 * Pure — unit-testable tanpa koneksi.
 */
export function computeNodeSize(name: string, columns: ErdColumn[]): { width: number; height: number } {
  const nameWidth = Math.ceil(name.length * 7.2) + 28;
  const maxColumnWidth = columns.reduce(
    (max, col) => Math.max(max, Math.ceil((col.name.length + col.type.length) * 7.2) + 24),
    0,
  );
  const width = Math.max(ERD_MIN_WIDTH, Math.max(nameWidth, maxColumnWidth));
  const height = ERD_HEADER_HEIGHT + columns.length * ERD_ROW_HEIGHT + ERD_FOOTER_HEIGHT;
  return { width, height };
}

export interface NodeSizing {
  id: string;
  width: number;
  height: number;
}

export interface GridLayoutOptions {
  gapX?: number;
  gapY?: number;
  startX?: number;
  startY?: number;
}

/**
 * Susun node dalam grid deterministik (kolom per baris = ceil(sqrt(n))).
 * Cell size per grid-column = max width pada kolom itu + gap.
 * Pure — unit-testable.
 */
export function layoutGrid(sizings: NodeSizing[], opts: GridLayoutOptions = {}): Map<string, { x: number; y: number }> {
  const { gapX = ERD_GAP_X, gapY = ERD_GAP_Y, startX = 0, startY = 0 } = opts;
  const n = sizings.length;
  if (n === 0) return new Map();

  const cols = Math.ceil(Math.sqrt(n));
  const sorted = [...sizings].sort((a, b) => (a.height > b.height ? -1 : a.height === b.height ? 0 : 1));
  const positions = new Map<string, { x: number; y: number }>();

  // kolom cell-width dihitung dari node terlebar di kolom itu.
  const colWidths = new Map<number, number>();
  const rowHeights = new Map<number, number>();
  sorted.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    colWidths.set(col, Math.max(colWidths.get(col) ?? 0, node.width));
    rowHeights.set(row, Math.max(rowHeights.get(row) ?? 0, node.height));
  });

  const colOffsets = new Map<number, number>();
  const rowOffsets = new Map<number, number>();
  let accX = startX;
  for (let c = 0; c < cols; c++) {
    colOffsets.set(c, accX);
    accX += (colWidths.get(c) ?? 0) + gapX;
  }
  let accY = startY;
  rowHeights.forEach((_h, row) => {
    rowOffsets.set(row, accY);
    accY += (rowHeights.get(row) ?? 0) + gapY;
  });

  sorted.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cellW = colWidths.get(col) ?? 0;
    const cellH = rowHeights.get(row) ?? 0;
    const x = (colOffsets.get(col) ?? 0) + Math.max(0, (cellW - node.width) / 2);
    const y = (rowOffsets.get(row) ?? 0) + Math.max(0, (cellH - node.height) / 2);
    positions.set(node.id, { x, y });
  });

  return positions;
}
