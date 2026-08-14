import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { WriteStream } from 'node:fs';
import { join } from 'node:path';
import { dialog } from 'electron';
import type {
  ClientError,
  CsvOptions,
  ExportInput,
  ExportFormat,
  ImportInput,
  Result,
  SqlOptions,
  TableColumn,
  TransferApi,
  TransferProgress,
  BackupDatabaseInput,
  RestoreInput,
} from '@canvabase/contracts';
import {
  csvOptionsSchema,
  exportInputSchema,
  fail,
  importInputSchema,
  ok,
  backupDatabaseInputSchema,
  restoreInputSchema,
} from '@canvabase/contracts';
import type { DialectPort } from '@canvabase/dialects';
import { toClientError } from '../errors.js';
import type { ConnectionManager } from './ConnectionManager.js';
import { csvEncodeRow, createCsvParserState, csvParse } from './transfer/csvCodec.js';
import {
  buildCreateTable,
  isDangerousStatement,
  splitSqlStatements,
  sqlLiteral,
} from './transfer/sqlCodec.js';

const PAGE_SIZE = 1000;

/**
 * TransferService — Import/Export (PRD-F-08).
 *
 * Export: SELECT per halaman (memory-safe) → CSV/SQL/JSON ditulis streaming ke
 * file hasil save dialog. Import: dialog open → CSV/SQL/JSON diparse → insert
 * parameterized (batch). SQL import diblokir statement destruktif. Semua path
 * file dikontrol main process; progress dikirim via `onProgress`.
 */
export class TransferService implements TransferApi {
  constructor(
    private readonly connections: ConnectionManager,
    private readonly onProgress?: (progress: TransferProgress) => void,
  ) {}

  private session(connectionId: string): Result<DialectPort> {
    const session = this.connections.getSession(connectionId);
    if (!session) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    return ok(session.dialect);
  }

  async export(input: ExportInput): Promise<Result<{ path: string; rows: number }>> {
    const parsed = exportInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const session = this.session(parsed.data.connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.tableSchema) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' });
    }
    const dialect = session.data;
    const { format, table, rowLimit } = parsed.data;
    try {
      const schema = await dialect.getTableSchema(table);
      const columns = this.resolveColumns(parsed.data.columns, schema);
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${this.sanitizeFileName(table)}.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (canceled || !filePath) return ok({ path: '', rows: 0 });
      this.emit({ phase: 'started', format, direction: 'export', processed: 0, total: null, path: filePath });

      const stream = createWriteStream(filePath, { encoding: 'utf8' });
      let rows = 0;
      try {
        if (format === 'csv') rows = await this.writeCsv(dialect, stream, table, columns, rowLimit, parsed.data.csvOptions);
        else if (format === 'sql') rows = await this.writeSql(dialect, stream, table, columns, rowLimit, parsed.data.sqlOptions, schema);
        else rows = await this.writeJson(dialect, stream, table, columns, rowLimit);
        await waitForStream(stream);
      } catch (err) {
        stream.destroy();
        throw err;
      }

      this.emit({ phase: 'done', format, direction: 'export', processed: rows, total: null, path: filePath });
      return ok({ path: filePath, rows });
    } catch (err) {
      this.emitError('export', parsed.data.format, this.errorText(toClientError(err)));
      return fail(toClientError(err));
    }
  }

  async import(input: ImportInput): Promise<Result<{ rows: number }>> {
    const parsed = importInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const session = this.session(parsed.data.connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.tableSchema) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' });
    }
    const { format } = parsed.data;
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (canceled || filePaths.length === 0 || !filePaths[0]) return ok({ rows: 0 });
    const filePath = filePaths[0];
    this.emit({ phase: 'started', format, direction: 'import', processed: 0, total: null, path: filePath });
    try {
      const rows = format === 'sql'
        ? await this.importSql(session.data, filePath)
        : await this.importRows(session.data, filePath, parsed.data);
      this.emit({ phase: 'done', format, direction: 'import', processed: rows, total: null, path: filePath });
      return ok({ rows });
    } catch (err) {
      this.emitError('import', format, this.errorText(toClientError(err)));
      return fail(toClientError(err));
    }
  }

  async backupDatabase(input: BackupDatabaseInput): Promise<Result<{ path: string; rows: number }>> {
    const parsed = backupDatabaseInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const { connectionId, format, databaseName } = parsed.data;
    const session = this.session(connectionId);
    if (!session.ok) return session;
    const dialect = session.data;

    try {
      if (format === 'sql') {
        const { canceled, filePath } = await dialog.showSaveDialog({
          defaultPath: `${this.sanitizeFileName(databaseName)}_backup.sql`,
          filters: [{ name: 'SQL Dump', extensions: ['sql'] }],
        });
        if (canceled || !filePath) return ok({ path: '', rows: 0 });

        this.emit({ phase: 'started', format, direction: 'export', processed: 0, total: null, path: filePath });

        const stream = createWriteStream(filePath, { encoding: 'utf8' });
        let totalRows = 0;
        try {
          const tables = await dialect.listTables();
          for (const table of tables) {
            const schema = await dialect.getTableSchema(table);
            const columns = this.resolveColumns(undefined, schema);
            totalRows += await this.writeSql(dialect, stream, table, columns, undefined, undefined, schema);
            stream.write('\n\n');
          }
          await waitForStream(stream);
        } catch (err) {
          stream.destroy();
          throw err;
        }

        this.emit({ phase: 'done', format, direction: 'export', processed: totalRows, total: null, path: filePath });
        return ok({ path: filePath, rows: totalRows });
      } else {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          properties: ['openDirectory'],
          title: 'Select Backup Destination Folder',
        });
        if (canceled || filePaths.length === 0 || !filePaths[0]) return ok({ path: '', rows: 0 });
        const dirPath = filePaths[0];

        this.emit({ phase: 'started', format, direction: 'export', processed: 0, total: null, path: dirPath });

        let totalRows = 0;
        const tables = await dialect.listTables();
        for (const table of tables) {
          const schema = await dialect.getTableSchema(table);
          const columns = this.resolveColumns(undefined, schema);
          const tableFilePath = join(dirPath, `${this.sanitizeFileName(table)}.${format}`);
          const stream = createWriteStream(tableFilePath, { encoding: 'utf8' });
          try {
            totalRows += await this.writeCsv(dialect, stream, table, columns, undefined, undefined);
            await waitForStream(stream);
          } catch (err) {
            stream.destroy();
            throw err;
          }
        }

        this.emit({ phase: 'done', format, direction: 'export', processed: totalRows, total: null, path: dirPath });
        return ok({ path: dirPath, rows: totalRows });
      }
    } catch (err) {
      this.emitError('export', format, this.errorText(toClientError(err)));
      return fail(toClientError(err));
    }
  }

  async restore(input: RestoreInput): Promise<Result<{ rows: number }>> {
    const parsed = restoreInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const session = this.session(parsed.data.connectionId);
    if (!session.ok) return session;
    const dialect = session.data;
    const { format, table } = parsed.data;

    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (canceled || filePaths.length === 0 || !filePaths[0]) return ok({ rows: 0 });
      const filePath = filePaths[0];

      this.emit({ phase: 'started', format, direction: 'import', processed: 0, total: null, path: filePath });

      let rows = 0;
      if (format === 'sql') {
        const content = await readFile(filePath, 'utf8');
        const statements = splitSqlStatements(content);
        let executed = 0;
        for (const statement of statements) {
          await dialect.execute(statement);
          executed++;
          this.emitProgress('import', 'sql', executed, statements.length);
        }
        rows = executed;
      } else {
        if (!table) {
          throw new Error('Target table required for CSV/TXT restore.');
        }
        rows = await this.importRows(dialect, filePath, {
          connectionId: parsed.data.connectionId,
          format: format === 'txt' ? 'csv' : format,
          table,
          mode: 'replace',
          batchSize: 1000,
        });
      }

      this.emit({ phase: 'done', format, direction: 'import', processed: rows, total: null, path: filePath });
      return ok({ rows });
    } catch (err) {
      this.emitError('import', format, this.errorText(toClientError(err)));
      return fail(toClientError(err));
    }
  }

  // ---------- internals: export ----------

  private resolveColumns(requested: string[] | undefined, schema: TableColumn[]): TableColumn[] {
    if (!requested || requested.length === 0) return schema;
    const set = new Set(requested);
    return schema.filter((col) => set.has(col.name));
  }

  /** Iterasi baris per halaman — memory-safe, tanpa load penuh ke RAM. */
  private async *iterateRows(
    dialect: DialectPort,
    table: string,
    columns: TableColumn[],
    rowLimit: number | undefined,
  ): AsyncGenerator<Record<string, unknown>> {
    const tableQ = dialect.quoteIdentifier(table);
    const colSql = columns.map((c) => dialect.quoteIdentifier(c.name)).join(', ');
    const select = `SELECT ${colSql} FROM ${tableQ} LIMIT ${PAGE_SIZE} OFFSET `;
    let offset = 0;
    for (;;) {
      const result = await dialect.execute(`${select}${offset}`);
      if (result.rows.length === 0) break;
      for (const row of result.rows) yield row;
      offset += result.rows.length;
      if (rowLimit !== undefined && offset >= rowLimit) break;
    }
  }

  private async writeCsv(
    dialect: DialectPort,
    stream: WriteStream,
    table: string,
    columns: TableColumn[],
    rowLimit: number | undefined,
    csvOpts: CsvOptions | undefined,
  ): Promise<number> {
    const opts: CsvOptions = csvOpts ? csvOptionsSchema.parse(csvOpts) : { separator: ',', quote: '"', headerRow: true };
    let processed = 0;
    if (opts.headerRow) {
      stream.write(columns.map((c) => c.name).join(opts.separator) + '\n');
    }
    for await (const row of this.iterateRows(dialect, table, columns, rowLimit)) {
      stream.write(csvEncodeRow(columns.map((c) => row[c.name]), opts) + '\n');
      processed++;
      if (processed % 1000 === 0) this.emitProgress('export', 'csv', processed, null);
    }
    return processed;
  }

  private async writeSql(
    dialect: DialectPort,
    stream: WriteStream,
    table: string,
    columns: TableColumn[],
    rowLimit: number | undefined,
    sqlOpts: SqlOptions | undefined,
    schema: TableColumn[],
  ): Promise<number> {
    const opts: SqlOptions = { includeCreateTable: true, includeInsert: true, batchSize: 1000, ...sqlOpts };
    if (opts.includeCreateTable) {
      stream.write(buildCreateTable(table, schema, (id) => dialect.quoteIdentifier(id)) + '\n\n');
    }
    if (!opts.includeInsert) return 0;
    const tableQ = dialect.quoteIdentifier(table);
    const colSql = columns.map((c) => dialect.quoteIdentifier(c.name)).join(', ');
    let batch: string[] = [];
    let processed = 0;
    const flush = (): void => {
      if (batch.length === 0) return;
      stream.write(`INSERT INTO ${tableQ} (${colSql}) VALUES\n${batch.join(',\n')};\n`);
      batch = [];
    };
    for await (const row of this.iterateRows(dialect, table, columns, rowLimit)) {
      batch.push(`(${columns.map((c) => sqlLiteral(row[c.name])).join(', ')})`);
      processed++;
      if (batch.length >= opts.batchSize) flush();
      if (processed % 1000 === 0) this.emitProgress('export', 'sql', processed, null);
    }
    flush();
    return processed;
  }

  private async writeJson(
    dialect: DialectPort,
    stream: WriteStream,
    table: string,
    columns: TableColumn[],
    rowLimit: number | undefined,
  ): Promise<number> {
    stream.write('[');
    let first = true;
    let processed = 0;
    for await (const row of this.iterateRows(dialect, table, columns, rowLimit)) {
      const obj: Record<string, unknown> = {};
      for (const col of columns) obj[col.name] = row[col.name];
      stream.write((first ? '' : ',') + JSON.stringify(obj));
      first = false;
      processed++;
      if (processed % 1000 === 0) this.emitProgress('export', 'json', processed, null);
    }
    stream.write(']\n');
    return processed;
  }

  // ---------- internals: import ----------

  private async importSql(dialect: DialectPort, filePath: string): Promise<number> {
    const content = await readFile(filePath, 'utf8');
    const statements = splitSqlStatements(content);
    for (const statement of statements) {
      if (isDangerousStatement(statement)) {
        throw new Error('Destructive SQL statement blocked during import (DROP/ALTER/TRUNCATE/GRANT).');
      }
    }
    let executed = 0;
    for (const statement of statements) {
      await dialect.execute(statement);
      executed++;
      this.emitProgress('import', 'sql', executed, statements.length);
    }
    return executed;
  }

  private async importRows(dialect: DialectPort, filePath: string, input: ImportInput): Promise<number> {
    if (!input.table || input.table.trim().length === 0) {
      throw new Error('Target table required for CSV/JSON import.');
    }
    const table = input.table.trim();
    const schema = await dialect.getTableSchema(table);
    if (schema.length === 0) {
      throw new Error(`Table "${table}" not found or has no columns.`);
    }
    const columnByName = new Map(schema.map((c) => [c.name, c]));
    if (input.mode === 'replace') {
      await dialect.execute(`DELETE FROM ${dialect.quoteIdentifier(table)}`);
    }

    let columns: string[] = [];
    let batch: unknown[][] = [];
    let inserted = 0;
    const flush = async (): Promise<void> => {
      if (batch.length === 0 || columns.length === 0) return;
      const rowSql = `(${columns.map(() => dialect.parameterPlaceholder(1)).join(', ')})`;
      const params = batch.flat();
      await dialect.execute(
        `INSERT INTO ${dialect.quoteIdentifier(table)} (${columns.map((c) => dialect.quoteIdentifier(c)).join(', ')}) VALUES ${batch.map(() => rowSql).join(', ')}`,
        params,
      );
      inserted += batch.length;
      batch = [];
      this.emitProgress('import', input.format, inserted, null);
    };

    if (input.format === 'csv') {
      const opts: CsvOptions = input.csvOptions
        ? csvOptionsSchema.parse(input.csvOptions)
        : { separator: ',', quote: '"', headerRow: true };
      const state = createCsvParserState();
      const rows = csvParse(state, await readFile(filePath, 'utf8'), opts);
      state.done = true;
      rows.push(...csvParse(state, '', opts));
      if (rows.length === 0) return 0;

      let header = schema.map((c) => c.name);
      let dataStart = 0;
      const firstRow = rows[0];
      if (opts.headerRow && firstRow) {
        header = firstRow;
        dataStart = 1;
      }
      columns = header.map((name) => name.trim()).filter((name) => columnByName.has(name));
      const colIndex = columns.map((name) => header.findIndex((h) => h.trim() === name));
      for (let r = dataStart; r < rows.length; r++) {
        const row = rows[r];
        const values = colIndex.map((ci) => {
          if (ci < 0 || ci >= (row?.length ?? 0)) return null;
          const raw = row?.[ci];
          return raw === '' || raw === undefined || raw === null ? null : raw;
        });
        batch.push(values);
        if (batch.length >= input.batchSize) await flush();
      }
    } else {
      const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('JSON import expects an array of row objects.');
      }
      const allowed = new Set(schema.map((c) => c.name));
      for (const item of parsed) {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
        const record = item as Record<string, unknown>;
        if (columns.length === 0) columns = Object.keys(record).filter((k) => allowed.has(k));
        batch.push(columns.map((c) => record[c] ?? null));
        if (batch.length >= input.batchSize) await flush();
      }
    }
    await flush();
    return inserted;
  }

  // ---------- helpers ----------

  private emitProgress(
    direction: TransferProgress['direction'],
    format: ExportFormat,
    processed: number,
    total: number | null,
  ): void {
    this.emit({ phase: 'processing', format, direction, processed, total, path: null });
  }

  private emit(progress: TransferProgress): void {
    try {
      this.onProgress?.(progress);
    } catch {
      // progress best-effort — jangan gagalkan operasi utama
    }
  }

  private emitError(direction: TransferProgress['direction'], format: ExportFormat, message: string): void {
    this.emit({ phase: 'done', format, direction, processed: 0, total: null, path: null, error: message });
  }

  /** Ambil pesan human-readable dari ClientError untuk progress UI. */
  private errorText(error: ClientError): string {
    if ('message' in error && error.message) return error.message;
    if ('code' in error && error.code) return error.code;
    return 'Transfer failed';
  }

  private sanitizeFileName(name: string): string {
    const cleaned = name
      .replace(/[<>:"/\\|?*]/g, '_')
      .split('')
      .map((ch) => (ch.charCodeAt(0) < 32 ? '_' : ch))
      .join('')
      .trim();
    return cleaned.length > 0 ? cleaned.slice(0, 120) : 'export';
  }
}

/** Tunggu stream selesai menulis (finish event). */
function waitForStream(stream: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once('finish', resolve);
    stream.once('error', reject);
    stream.end();
  });
}
