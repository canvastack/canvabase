import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

/**
 * Entri audit log operasi sensitif (UU PDP: access/activity log).
 * Disediakan untuk operasi destruktif & data besar:
 * - designer.apply / designer.drop (destructive DDL)
 * - connection.delete (penghapusan data koneksi)
 * - transfer.export / transfer.import / transfer.backup / transfer.restore (data besar)
 *
 * Log best-effort: kegagalan menulis TIDAK boleh menggagalkan operasi utama.
 * Nilai sensitif (password/isi data) TIDAK pernah dicatat.
 */
export interface AuditEntry {
  id: string;
  ts: number;
  action: string;
  connectionId?: string;
  /** Nama target yang dapat dibaca manusia (tabel/koneksi/file). */
  target?: string;
  detail?: Record<string, string | number | boolean | null>;
}

export class AuditLogger {
  private readonly auditPath: string;

  constructor(dataDir?: string) {
    this.auditPath = dataDir ? join(dataDir, 'audit-log.json') : '';
  }

  /** Tulis satu entri audit (append). Best-effort — tidak pernah throw ke caller. */
  async append(entry: Omit<AuditEntry, 'id' | 'ts'>): Promise<void> {
    const full: AuditEntry = { id: randomUUID(), ts: Date.now(), ...entry };
    if (!this.auditPath) return;
    try {
      let existing: AuditEntry[] = [];
      try {
        const raw = await readFile(this.auditPath, 'utf8');
        existing = JSON.parse(raw) as AuditEntry[];
      } catch {
        // first entry
      }
      existing.push(full);
      await mkdir(join(this.auditPath, '..'), { recursive: true });
      await writeFile(this.auditPath, JSON.stringify(existing, null, 2), 'utf8');
    } catch {
      // audit best-effort — jangan gagalkan operasi utama
    }
  }
}
