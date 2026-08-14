import { z } from 'zod';
import type { Result } from './errors.js';

/** Satu kolom dalam definisi tabel (Table Designer — PRD-F-06). */
export const designerColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  nullable: z.boolean().default(false),
  default: z.string().nullable().default(null),
  autoIncrement: z.boolean().default(false),
  isPrimaryKey: z.boolean().default(false),
  comment: z.string().optional(),
});

export type DesignerColumn = z.infer<typeof designerColumnSchema>;

/** Satu index (non-PK) dalam definisi tabel. */
export const designerIndexSchema = z.object({
  name: z.string().min(1),
  unique: z.boolean().default(false),
  columns: z.array(z.string().min(1)),
});

export type DesignerIndex = z.infer<typeof designerIndexSchema>;

/** Satu foreign key constraint dalam definisi tabel. */
export const designerForeignKeySchema = z.object({
  name: z.string().min(1),
  columns: z.array(z.string().min(1)),
  refTable: z.string().min(1),
  refColumns: z.array(z.string().min(1)),
  onDelete: z.string().nullable().default(null),
});

export type DesignerForeignKey = z.infer<typeof designerForeignKeySchema>;

/**
 * Draft tabel — bentuk yang diedit user di Table Designer lalu
 * di-generate menjadi DDL (CREATE TABLE). Dipakai untuk preview
 * maupun apply.
 */
export const tableDraftSchema = z.object({
  name: z.string().min(1),
  schema: z.string().nullable().default(null),
  columns: z.array(designerColumnSchema).min(1),
  indexes: z.array(designerIndexSchema).default([]),
  foreignKeys: z.array(designerForeignKeySchema).default([]),
});

export type TableDraft = z.infer<typeof tableDraftSchema>;

/** Definisi tabel lengkap hasil introspection (read-only) + DDL asli. */
export const tableDefinitionSchema = tableDraftSchema.extend({ ddl: z.string() });

export type TableDefinition = z.infer<typeof tableDefinitionSchema>;

export interface DesignerApi {
  /** Metadata lengkap table (kolom, index, FK, DDL). */
  getTable(connectionId: string, table: string): Promise<Result<TableDefinition>>;
  /** Generate DDL preview dari draft tanpa apply. */
  previewDdl(input: { connectionId: string; draft: TableDraft }): Promise<Result<string>>;
  /** Apply perubahan (CREATE table baru). */
  apply(input: { connectionId: string; draft: TableDraft }): Promise<Result<{ applied: boolean }>>;
  /** Drop table — konfirmasi + audit log. */
  drop(connectionId: string, table: string): Promise<Result<{ dropped: boolean }>>;
}
