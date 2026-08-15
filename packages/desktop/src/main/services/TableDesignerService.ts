import type {
  DesignerApi,
  Result,
  TableDefinition,
  TableDraft,
} from '@canvabase/contracts';
import { fail, ok, tableDraftSchema } from '@canvabase/contracts';
import type { DialectPort } from '@canvabase/dialects';
import { toClientError } from '../errors.js';
import type { ConnectionManager } from './ConnectionManager.js';
import type { AuditLogger } from './AuditLogger.js';

/**
 * TableDesignerService — Table Designer (PRD-F-06).
 *
 * - `getTable`: introspection lengkap (kolom, index, FK, DDL asli).
 * - `previewDdl`: generate DDL preview dari draft tanpa apply.
 * - `apply`: CREATE table baru dari draft (ALTER existing → UNSUPPORTED, v1.1).
 * - `drop`: DROP TABLE — destructive, dicatat ke audit log.
 */
export class TableDesignerService implements DesignerApi {
  constructor(
    private readonly connections: ConnectionManager,
    private readonly audit?: AuditLogger,
  ) {}

  private session(connectionId: string): Result<DialectPort> {
    const session = this.connections.getSession(connectionId);
    if (!session) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'NOT_CONNECTED' });
    }
    return ok(session.dialect);
  }

  async getTable(connectionId: string, table: string): Promise<Result<TableDefinition>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.ddl) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' });
    }
    const name = table.trim();
    if (name.length === 0) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    try {
      return ok(await session.data.getTableDefinition(name));
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async previewDdl(input: { connectionId: string; draft: TableDraft }): Promise<Result<string>> {
    const session = this.session(input.connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.ddl) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' });
    }
    const parsed = this.parseDraft(input.draft);
    if (!parsed) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    try {
      return ok(session.data.previewDdl(parsed));
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async apply(input: { connectionId: string; draft: TableDraft }): Promise<Result<{ applied: boolean }>> {
    const session = this.session(input.connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.ddl) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' });
    }
    const parsed = this.parseDraft(input.draft);
    if (!parsed) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    try {
      const tables = await session.data.listTables();
      if (tables.some((t) => t.toLowerCase() === parsed.name.toLowerCase())) {
        return fail({
          type: 'BUSINESS',
          retryable: false,
          code: 'UNSUPPORTED_OPERATION',
          message: 'ALTER table belum didukung di v1.0 — gunakan drop + create ulang.',
        });
      }
      const sql = session.data.previewDdl(parsed);
      await session.data.execute(sql);
      await this.audit?.append({
        action: 'designer.apply',
        connectionId: input.connectionId,
        target: parsed.name,
      });
      return ok({ applied: true });
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  async drop(connectionId: string, table: string): Promise<Result<{ dropped: boolean }>> {
    const session = this.session(connectionId);
    if (!session.ok) return session;
    if (!session.data.capabilities.ddl) {
      return fail({ type: 'BUSINESS', retryable: false, code: 'UNSUPPORTED_OPERATION' });
    }
    const name = table.trim();
    if (name.length === 0) {
      return fail({ type: 'VALIDATION', retryable: false, code: 'INVALID_INPUT' });
    }
    try {
      await session.data.execute(`DROP TABLE ${session.data.quoteIdentifier(name)}`);
      await this.audit?.append({
        action: 'designer.drop',
        connectionId,
        target: name,
      });
      return ok({ dropped: true });
    } catch (err) {
      return fail(toClientError(err));
    }
  }

  /** Validasi draft via zod — JANGAN percaya renderer. */
  private parseDraft(draft: unknown): TableDraft | null {
    const parsed = tableDraftSchema.safeParse(draft);
    return parsed.success ? parsed.data : null;
  }
}
