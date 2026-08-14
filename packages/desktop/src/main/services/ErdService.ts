import { writeFile } from 'node:fs/promises';
import { dialog } from 'electron';
import type {
  DesignerForeignKey,
  ErdApi,
  ErdColumn,
  ErdEdge,
  ErdGraph,
  Result,
  TableDefinition,
} from '@canvabase/contracts';
import { erdGraphSchema, fail, ok } from '@canvabase/contracts';
import type { DialectPort } from '@canvabase/dialects';
import { toClientError } from '../errors.js';
import type { ConnectionManager } from './ConnectionManager.js';
import { computeNodeSize, layoutGrid } from './erdLayout.js';

/** Batas tabel yang di-introspect per diagram — lindungi DB besar. */
export const MAX_ERD_TABLES = 200;
/** Concurrency pengambilan definisi tabel (hindari starvation koneksi). */
const FETCH_CONCURRENCY = 8;

/**
 * ErdService — ERD Diagram (PRD-F-07).
 *
 * - `generate`: introspect schema (kolom + FK) seluruh tabel, bangun graf,
 *   susun layout grid awal. Gate capability: `tableSchema`.
 * - `exportImage`: simpan PNG/SVG via dialog — hanya data URL image,
 *   path file dikontrol main process (renderer tidak bisa nulis sembarang).
 */
export class ErdService implements ErdApi {
  constructor(private readonly connections: ConnectionManager) {}

  private session(connectionId: string): Result<DialectPort> {
    const session = this.connections.getSession(connectionId);
    if (!session) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    return ok(session.dialect);
  }

  async generate(connectionId: string): Promise<Result<ErdGraph>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.tableSchema) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' });
    }
    try {
      const tables = await session.data.listTables();
      const bounded = tables.slice(0, MAX_ERD_TABLES);
      const definitions = await this.fetchDefinitions(session.data, bounded);

      const nodes = definitions.map((def) => this.toNode(def));
      const nodeIds = new Set(nodes.map((n) => n.id));
      const edges = this.toEdges(definitions, nodeIds);

      const sizes = nodes.map((n) => ({ id: n.id, width: n.width, height: n.height }));
      const positions = layoutGrid(sizes);
      for (const node of nodes) {
        const pos = positions.get(node.id);
        if (pos) {
          node.x = pos.x;
          node.y = pos.y;
        }
      }

      const graph: ErdGraph = { nodes, edges, version: 1 };
      const parsed = erdGraphSchema.safeParse(graph);
      if (!parsed.success) {
        return fail({ type: 'BUSINESS', retryable: false, code: 'INVALID_INPUT' });
      }
      return ok(parsed.data);
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async exportImage(input: { dataUrl: string; defaultName: string }): Promise<Result<{ saved: boolean; path: string | null }>> {
    if (typeof input?.dataUrl !== 'string' || typeof input?.defaultName !== 'string') {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const match = /^data:(image\/(?:png|svg\+xml));base64,(.+)$/s.exec(input.dataUrl);
    if (!match) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    const mime = match[1] ?? '';
    const base64 = match[2] ?? '';
    const ext = mime === 'image/png' ? 'png' : 'svg';
    const defaultName = `${this.sanitizeFileName(input.defaultName)}.${ext}`;
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      });
      if (canceled || !filePath) return ok({ saved: false, path: null });
      const buffer = Buffer.from(base64, 'base64');
      await writeFile(filePath, buffer);
      return ok({ saved: true, path: filePath });
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  /** Ambil definisi seluruh tabel dengan concurrency terbatas + urutan stabil. */
  private async fetchDefinitions(dialect: DialectPort, tables: string[]): Promise<TableDefinition[]> {
    const definitions = new Array<TableDefinition | null>(tables.length);
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < tables.length) {
        const index = cursor++;
        const table = tables[index];
        if (table === undefined) return;
        definitions[index] = await dialect.getTableDefinition(table);
      }
    };
    const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, Math.max(1, tables.length)) }, () => worker());
    await Promise.all(workers);
    return definitions.filter((d): d is TableDefinition => d !== null);
  }

  private toNode(def: TableDefinition): ErdGraph['nodes'][number] {
    const columns: ErdColumn[] = def.columns.map((col) => ({
      name: col.name,
      type: col.type,
      primaryKey: col.isPrimaryKey,
      nullable: col.nullable,
    }));
    const size = computeNodeSize(def.name, columns);
    return { id: def.name, name: def.name, x: 0, y: 0, width: size.width, height: size.height, columns };
  }

  private toEdges(definitions: TableDefinition[], nodeIds: Set<string>): ErdEdge[] {
    const edges: ErdEdge[] = [];
    for (const def of definitions) {
      for (const fk of def.foreignKeys ?? []) {
        if (!nodeIds.has(fk.refTable)) continue;
        edges.push(this.toEdge(def, fk));
      }
    }
    // Urutkan stabil: sumber, lalu target — output deterministik.
    return edges.sort((a, b) => (a.source === b.source ? a.target.localeCompare(b.target) : a.source.localeCompare(b.source)));
  }

  private toEdge(def: TableDefinition, fk: DesignerForeignKey): ErdEdge {
    const pkSet = new Set(def.columns.filter((c) => c.isPrimaryKey).map((c) => c.name));
    const oneToOne = fk.columns.length > 0 && fk.columns.every((col) => pkSet.has(col));
    return {
      id: `${def.name}__fk__${fk.refTable}`,
      source: def.name,
      target: fk.refTable,
      columns: fk.columns,
      type: oneToOne ? 'one-one' : 'one-many',
    };
  }

  private sanitizeFileName(name: string): string {
    const cleaned = name
      .replace(/[<>:"/\\|?*]/g, '_')
      .split('')
      .map((ch) => (ch.charCodeAt(0) < 32 ? '_' : ch))
      .join('')
      .trim();
    return cleaned.length > 0 ? cleaned.slice(0, 120) : 'erd';
  }
}
