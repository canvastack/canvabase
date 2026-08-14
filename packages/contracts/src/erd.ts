import { z } from 'zod';
import type { Result } from './errors.js';

/**
 * ERD Diagram — PRD-F-07.
 *
 * Graf relasi antar tabel yang dirender di canvas (React Flow / @xyflow/react).
 * Service main melakukan introspection schema (kolom + foreign keys), lalu
 * menghasilkan layout grid awal yang tetap bisa di-drag oleh user di renderer.
 */

/** Satu kolom yang dirender dalam node tabel. */
export const erdColumnSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  primaryKey: z.boolean().default(false),
  nullable: z.boolean().default(false),
});

export type ErdColumn = z.infer<typeof erdColumnSchema>;

/** Node tabel pada canvas — posisi awal grid, bisa digeser user. */
export const erdNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  columns: z.array(erdColumnSchema),
});

export type ErdNode = z.infer<typeof erdNodeSchema>;

/** Relasi foreign key antara dua node (source = tabel anak, target = induk). */
export const erdEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  /** Nama kolom FK di tabel source yang mereferensikan target. */
  columns: z.array(z.string().min(1)),
  type: z.enum(['one-many', 'one-one', 'many-many']),
});

export type ErdEdge = z.infer<typeof erdEdgeSchema>;

export const erdGraphSchema = z.object({
  nodes: z.array(erdNodeSchema),
  edges: z.array(erdEdgeSchema),
  version: z.number().default(1),
});

export type ErdGraph = z.infer<typeof erdGraphSchema>;

export interface ErdApi {
  /** Introspect schema + FK, kembalikan graf dengan layout grid awal. */
  generate(connectionId: string): Promise<Result<ErdGraph>>;
  /**
   * Simpan gambar canvas via dialog save. Hanya menerima data URL
   * `image/png` atau `image/svg+xml` — path dikontrol main process.
   */
  exportImage(input: { dataUrl: string; defaultName: string }): Promise<Result<{ saved: boolean; path: string | null }>>;
}
