import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DialectConnectionConfig, DialectPort } from '@canvabase/dialects';

export interface ContractSQL {
  selectValue: string;
  parameterizedWhere: string;
  injectionValue: string;
  sleepSQL: string | null;
  createUsers: string;
  resetUsers?: string;
  insertUsers: string[];
  selectUsers: string;
  dmlInsert: string;
  dmlUpdate: string;
  dmlDelete: string;
}

export interface ContractTestConfig {
  enabled: boolean;
  connection: DialectConnectionConfig;
  sql: ContractSQL;
}

export function dialectContractSuite(adapter: DialectPort, config: ContractTestConfig) {
  describe.skipIf(!config.enabled)(`${adapter.name} Contract Tests`, () => {
    beforeAll(async () => {
      await adapter.connect(config.connection);
      if (config.sql.resetUsers) {
        await adapter.execute(config.sql.resetUsers);
      }
      await adapter.execute(config.sql.createUsers);
      for (const stmt of config.sql.insertUsers) {
        await adapter.execute(stmt);
      }
    });
    afterAll(async () => {
      await adapter.disconnect();
    });

    it('should connect successfully', () => {
      expect(adapter.isConnected()).toBe(true);
    });

    it('should execute parameterized query', async () => {
      const r = await adapter.execute(config.sql.selectValue);
      expect(r.rows).toBeDefined();
      expect(r.columns.length).toBeGreaterThan(0);
    });

    it('should prevent SQL injection via parameterization', async () => {
      const r = await adapter.execute(config.sql.parameterizedWhere, [
        config.sql.injectionValue,
      ]);
      expect(r.rows).toBeDefined();
      expect(r.rows.length).toBe(0);
    });

    it('should list tables without throwing', async () => {
      const tables = await adapter.listTables();
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.some((t) => /users/i.test(t))).toBe(true);
    });

    it('should list object kinds per capability', async () => {
      if (adapter.capabilities.databases) {
        const dbs = await adapter.listDatabases();
        expect(Array.isArray(dbs)).toBe(true);
        expect(dbs.length).toBeGreaterThanOrEqual(1);
      } else {
        await expect(adapter.listDatabases()).resolves.toEqual([]);
      }
      const views = await adapter.listViews();
      expect(Array.isArray(views)).toBe(true);
      if (adapter.capabilities.procedures) {
        expect(Array.isArray(await adapter.listProcedures())).toBe(true);
      } else {
        await expect(adapter.listProcedures()).resolves.toEqual([]);
      }
      if (adapter.capabilities.triggers) {
        expect(Array.isArray(await adapter.listTriggers())).toBe(true);
      } else {
        await expect(adapter.listTriggers()).resolves.toEqual([]);
      }
      if (adapter.capabilities.userManagement) {
        expect(Array.isArray(await adapter.listUsers())).toBe(true);
      } else {
        await expect(adapter.listUsers()).resolves.toEqual([]);
      }
    });

    it('should cancel a long query via AbortSignal', async () => {
      if (!adapter.capabilities.cancellation || config.sql.sleepSQL === null) return;
      const controller = new AbortController();
      const p = adapter.execute(config.sql.sleepSQL, [], controller.signal);
      setTimeout(() => controller.abort(), 50);
      await expect(p).rejects.toThrow('cancelled');
    });

    it('should stream chunks when capability exists', async () => {
      if (!adapter.capabilities.streaming) {
        await expect(adapter.stream(config.sql.selectUsers)).rejects.toThrow();
        return;
      }
      const stream = await adapter.stream(config.sql.selectUsers);
      const chunks: unknown[] = [];
      for (;;) {
        const result = await stream.chunks.next();
        if (result.done) break;
        chunks.push(result.value);
      }
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should return table schema when capability exists', async () => {
      if (!adapter.capabilities.tableSchema) return;
      const schema = await adapter.getTableSchema('users');
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
      expect(schema.some((c) => c.primaryKey)).toBe(true);
      expect(schema.find((c) => c.name === 'id')?.autoIncrement).toBe(true);
    });

    it('should report affected rows for DML (editable grid)', async () => {
      if (!adapter.capabilities.editableGrid) return;
      const insert = await adapter.execute(config.sql.dmlInsert, ['carol']);
      expect(insert.affected).toBe(1);
      const update = await adapter.execute(config.sql.dmlUpdate, ['carol2', 3]);
      expect(update.affected).toBe(1);
      const del = await adapter.execute(config.sql.dmlDelete, [3]);
      expect(del.affected).toBe(1);
    });
  });
}
