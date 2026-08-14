import { z } from 'zod';
import type { Result } from './errors.js';

/**
 * Import/Export — PRD-F-08.
 *
 * Export: CSV / SQL / JSON dari sebuah tabel (streaming per halaman).
 * Import: CSV / SQL / JSON ke tabel target. Semua operasi berjalan di
 * main process — path file dikontrol dialog, insert selalu parameterized.
 */

export const exportFormatSchema = z.enum(['csv', 'sql', 'json', 'txt']);
export type ExportFormat = z.infer<typeof exportFormatSchema>;

export const csvOptionsSchema = z.object({
  separator: z.string().min(1).max(4).default(','),
  quote: z.string().min(1).max(2).default('"'),
  headerRow: z.boolean().default(true),
});

export type CsvOptions = z.infer<typeof csvOptionsSchema>;

export const sqlOptionsSchema = z.object({
  includeCreateTable: z.boolean().default(true),
  includeInsert: z.boolean().default(true),
  batchSize: z.number().int().min(1).max(5000).default(1000),
});

export type SqlOptions = z.infer<typeof sqlOptionsSchema>;

export const exportInputSchema = z.object({
  connectionId: z.string().min(1),
  format: exportFormatSchema,
  table: z.string().min(1),
  /** Kolom yang diexport — undefined = semua kolom. */
  columns: z.array(z.string().min(1)).optional(),
  /** Batas baris — undefined = tanpa batas (sampai habis). */
  rowLimit: z.number().int().min(1).max(1_000_000).optional(),
  csvOptions: csvOptionsSchema.optional(),
  sqlOptions: sqlOptionsSchema.optional(),
});

export type ExportInput = z.infer<typeof exportInputSchema>;

export const importModeSchema = z.enum(['insert', 'replace']);
export type ImportMode = z.infer<typeof importModeSchema>;

export const importInputSchema = z.object({
  connectionId: z.string().min(1),
  format: exportFormatSchema,
  /** Target tabel untuk csv/json (sql tidak butuh — nama di statement). */
  table: z.string().optional(),
  csvOptions: csvOptionsSchema.optional(),
  /** replace = truncate dulu lalu insert (destructive, dikonfirmasi renderer). */
  mode: importModeSchema.default('insert'),
  batchSize: z.number().int().min(1).max(5000).default(1000),
});

export type ImportInput = z.infer<typeof importInputSchema>;

export const transferProgressSchema = z.object({
  phase: z.enum(['started', 'processing', 'done']),
  format: exportFormatSchema,
  direction: z.enum(['export', 'import']),
  processed: z.number(),
  total: z.number().nullable(),
  path: z.string().nullable(),
  /** Pesan error — non-null saat terjadi kegagalan (emit sebelum throw). */
  error: z.string().nullable().optional(),
});

export type TransferProgress = z.infer<typeof transferProgressSchema>;

export const backupDatabaseInputSchema = z.object({
  connectionId: z.string().min(1),
  format: z.enum(['csv', 'sql', 'txt']),
  databaseName: z.string().min(1),
});

export type BackupDatabaseInput = z.infer<typeof backupDatabaseInputSchema>;

export const restoreInputSchema = z.object({
  connectionId: z.string().min(1),
  table: z.string().optional(),
  format: z.enum(['csv', 'sql', 'txt']),
});

export type RestoreInput = z.infer<typeof restoreInputSchema>;

export interface TransferApi {
  /** Export tabel → file (dialog save). Path dikontrol main process. */
  export(input: ExportInput): Promise<Result<{ path: string; rows: number }>>;
  /** Import file (dialog open) → tabel target. Insert selalu parameterized. */
  import(input: ImportInput): Promise<Result<{ rows: number }>>;
  /** Backup seluruh database → single SQL file atau folder berisi CSV/TXT. */
  backupDatabase(input: BackupDatabaseInput): Promise<Result<{ path: string; rows: number }>>;
  /** Restore database/tabel dari file cadangan. */
  restore(input: RestoreInput): Promise<Result<{ rows: number }>>;
}
