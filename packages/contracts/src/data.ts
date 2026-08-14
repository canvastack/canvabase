import type { Result } from './errors.js';
import type { Chunk, ColumnMetadata } from './query.js';

/** Deskripsi satu kolom tabel untuk Data Viewer (DataApi). */
export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  default: string | null;
}

/** Schema lengkap sebuah tabel: daftar kolom + metadata PK. */
export interface TableSchema {
  table: string;
  columns: TableColumn[];
}

/** Pasangan kolom-nilai untuk operasi CRUD (parameterized, bukan literal SQL). */
export interface RowValue {
  column: string;
  value: unknown;
}

export interface DataApi {
  getSchema(input: { connectionId: string; table: string }): Promise<Result<TableSchema>>;
  openTable(input: {
    connectionId: string;
    table: string;
    limit?: number;
  }): Promise<Result<{ chunk: Chunk<Record<string, unknown>>; columns: ColumnMetadata[]; table: string }>>;
  updateRow(input: {
    connectionId: string;
    table: string;
    where: RowValue[];
    changes: RowValue[];
  }): Promise<Result<{ affected: number }>>;
  insertRow(input: {
    connectionId: string;
    table: string;
    values: RowValue[];
  }): Promise<Result<{ affected: number }>>;
  deleteRow(input: {
    connectionId: string;
    table: string;
    where: RowValue[];
  }): Promise<Result<{ affected: number }>>;
}
