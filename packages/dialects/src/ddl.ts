import type { DesignerColumn } from '@canvabase/contracts';

/**
 * Format default value untuk ditampilkan di DDL preview.
 * - null → tidak emit
 * - numerik literal → verbatim
 * - sudah ber-kutip / fungsi SQL (diawali quote, kurung, atau keyword fungsi) → verbatim
 * - selain itu → dibungkus single-quote (escape '' )
 */
export function formatDefault(raw: string | null): string {
  if (raw === null) return '';
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  if (/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^[(']/.test(trimmed)) return trimmed;
  if (/^(CURRENT_|NOW\(|UUID\(|nextval\(|gen_random_uuid\(|DEFAULT\b)/i.test(trimmed)) {
    return trimmed;
  }
  return `'${trimmed.replace(/'/g, "''")}'`;
}

/** Pilih kolom PK dari draft (berurutan sesuai urutan kolom). */
export function primaryKeyColumns(columns: DesignerColumn[]): DesignerColumn[] {
  return columns.filter((c) => c.isPrimaryKey);
}
