import { z } from 'zod';
import type { Result } from './errors.js';

export const columnMetadataSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().default(true),
});

export type ColumnMetadata = z.infer<typeof columnMetadataSchema>;

export interface Chunk<T> {
  rows: T[];
  hasMore: boolean;
  offset: number;
}

export interface StreamedResult<T> {
  metadata: { totalRows: number | null; columns: ColumnMetadata[] };
  chunks: AsyncIterator<Chunk<T>>;
  pause(): void;
  resume(): void;
  cancel(reason?: string): Promise<void>;
}

export interface Suggestion {
  label: string;
  kind: 'keyword' | 'table' | 'view' | 'column' | 'database' | 'function' | 'clause';
  detail?: string;
  replaceText?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedQueryInput {
  name: string;
  sql: string;
}

export interface QueryApi {
  execute(input: { connectionId: string; sql: string; params?: unknown[]; signalId?: string }): Promise<Result<{ chunk: Chunk<Record<string, unknown>>; columns: ColumnMetadata[] }>>;
  fetchChunk(input: { connectionId: string; offset: number; size: number }): Promise<Result<Chunk<Record<string, unknown>>>>;
  cancel(signalId: string): Promise<Result<{ cancelled: boolean }>>;
  suggest(input: { connectionId: string; sql: string; position: number }): Promise<Result<Suggestion[]>>;
  savedList(): Promise<Result<SavedQuery[]>>;
  savedSave(input: SavedQueryInput): Promise<Result<SavedQuery>>;
  savedDelete(id: string): Promise<Result<{ deleted: boolean }>>;
}
