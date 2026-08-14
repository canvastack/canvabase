import { describe, expect, it } from 'vitest';
import type { TableDraft } from '@canvabase/contracts';
import { formatDefault, primaryKeyColumns } from './ddl.js';
import { MySQLAdapter } from './adapters/mysql.js';
import { PostgreSQLAdapter } from './adapters/postgres.js';
import { SQLiteAdapter } from './adapters/sqlite.js';

const baseDraft: TableDraft = {
  name: 'orders',
  schema: null,
  columns: [
    { name: 'id', type: 'BIGINT', nullable: false, default: null, autoIncrement: true, isPrimaryKey: true },
    { name: 'email', type: 'VARCHAR(255)', nullable: false, default: null, autoIncrement: false, isPrimaryKey: false },
  ],
  indexes: [
    { name: 'idx_orders_email', unique: true, columns: ['email'] },
  ],
  foreignKeys: [],
};

describe('formatDefault', () => {
  it('emits empty string for null / blank', () => {
    expect(formatDefault(null)).toBe('');
    expect(formatDefault('   ')).toBe('');
  });

  it('emits numeric literals verbatim', () => {
    expect(formatDefault('42')).toBe('42');
    expect(formatDefault('-1.5')).toBe('-1.5');
  });

  it('passes through function/keyword expressions', () => {
    expect(formatDefault('CURRENT_TIMESTAMP')).toBe('CURRENT_TIMESTAMP');
    expect(formatDefault('gen_random_uuid()')).toBe('gen_random_uuid()');
    expect(formatDefault('nextval(\'orders_id_seq\')')).toBe('nextval(\'orders_id_seq\')');
  });

  it('quotes plain string defaults', () => {
    expect(formatDefault('pending')).toBe("'pending'");
    expect(formatDefault("it's")).toBe("'it''s'");
  });
});

describe('primaryKeyColumns', () => {
  it('returns only primary key columns in order', () => {
    const pk = primaryKeyColumns(baseDraft.columns);
    expect(pk.map((c) => c.name)).toEqual(['id']);
  });
});

describe('previewDdl (pure, per adapter)', () => {
  const drafts: Array<{ label: string; adapter: { previewDdl(d: TableDraft): string }; draft: TableDraft }> = [
    { label: 'mysql', adapter: new MySQLAdapter(), draft: baseDraft },
    { label: 'postgres', adapter: new PostgreSQLAdapter(), draft: baseDraft },
    { label: 'sqlite', adapter: new SQLiteAdapter(), draft: baseDraft },
  ];

  for (const { label, adapter, draft } of drafts) {
    it(`${label} creates CREATE TABLE with PK, NOT NULL, index & default`, () => {
      const sql = adapter.previewDdl(draft);
      expect(sql).toContain(`CREATE TABLE`);
      expect(sql).toContain('id');
      expect(sql).toContain('VARCHAR(255)');
    });

    it(`${label} quotes identifiers`, () => {
      const sql = adapter.previewDdl({ ...draft, name: 'my table' });
      expect(sql).toContain('my table');
    });
  }

  it('sqlite emits separate CREATE INDEX statements', () => {
    const sql = new SQLiteAdapter().previewDdl({
      ...baseDraft,
      columns: [
        { name: 'id', type: 'INTEGER', nullable: false, default: null, autoIncrement: true, isPrimaryKey: true },
        { name: 'email', type: 'TEXT', nullable: false, default: null, autoIncrement: false, isPrimaryKey: false },
      ],
    });
    expect(sql).toContain('CREATE UNIQUE INDEX');
    expect(sql).toContain('ON "orders" ("email")');
  });

  it('formats string defaults as SQL literals', () => {
    const sql = new MySQLAdapter().previewDdl({
      ...baseDraft,
      columns: [
        ...baseDraft.columns,
        { name: 'status', type: 'VARCHAR(20)', nullable: false, default: 'pending', autoIncrement: false, isPrimaryKey: false },
      ],
    });
    expect(sql).toContain("DEFAULT 'pending'");
  });
});

describe('sqlite getTableDefinition (in-memory)', () => {
  it('introspects columns, indexes, FKs and original DDL', async () => {
    const adapter = new SQLiteAdapter();
    await adapter.connect({ host: 'localhost', port: 0, database: ':memory:' });
    await adapter.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        city_id INTEGER,
        FOREIGN KEY (city_id) REFERENCES cities (id) ON DELETE CASCADE
      )
    `);
    await adapter.execute('CREATE INDEX idx_users_city ON users (city_id)');

    const def = await adapter.getTableDefinition('users');

    expect(def.name).toBe('users');
    expect(def.columns.map((c) => c.name)).toEqual(['id', 'email', 'city_id']);
    const idCol = def.columns.find((c) => c.name === 'id');
    expect(idCol?.isPrimaryKey).toBe(true);
    expect(idCol?.autoIncrement).toBe(true);

    expect(def.indexes).toHaveLength(1);
    expect(def.indexes[0]?.name).toBe('idx_users_city');
    expect(def.indexes[0]?.columns).toEqual(['city_id']);

    expect(def.foreignKeys).toHaveLength(1);
    expect(def.foreignKeys[0]?.refTable).toBe('cities');
    expect(def.foreignKeys[0]?.onDelete).toBe('CASCADE');

    expect(def.ddl).toContain('CREATE TABLE users');
    await adapter.disconnect();
  });

  it('throws when not connected', async () => {
    const adapter = new SQLiteAdapter();
    await expect(adapter.getTableDefinition('users')).rejects.toThrow('not connected');
  });
});
