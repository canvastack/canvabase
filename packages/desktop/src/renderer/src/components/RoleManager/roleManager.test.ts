// packages/desktop/src/renderer/src/components/RoleManager/roleManager.test.ts
import { describe, expect, it } from 'vitest';
import { generateRoleSql, analyzeRoleSecurity, applyRbacPreset } from './sqlGenerator';
import {
  ALL_PRIVILEGE_ACTIONS,
  type PgRoleFormData,
  type PgDefaultPrivilege,
  type PgRoleParameter,
} from './types';

describe('Role & Privilege Management Unit Tests', () => {
  describe('Types and Privilege Actions Constants', () => {
    it('contains all 12 PostgreSQL standard privilege actions', () => {
      expect(ALL_PRIVILEGE_ACTIONS).toHaveLength(12);
      expect(ALL_PRIVILEGE_ACTIONS).toContain('CONNECT');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('CREATE');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('DELETE');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('EXECUTE');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('INSERT');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('REFERENCES');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('SELECT');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('TEMPORARY');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('TRIGGER');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('TRUNCATE');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('UPDATE');
      expect(ALL_PRIVILEGE_ACTIONS).toContain('USAGE');
    });
  });

  describe('sqlGenerator - CREATE ROLE DDL', () => {
    it('generates CREATE ROLE with default attributes and no password', () => {
      const formData: PgRoleFormData = {
        isNew: true,
        roleName: 'app_reader',
        canLogin: true,
        password: '',
        passwordEncryption: 'SCRAM-SHA-256',
        connectionLimit: -1,
        expiryDate: null,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        memberships: [],
        selectedDatabase: 'postgres',
        privileges: [],
        defaultPrivileges: [],
        parameters: [],
      };

      const sql = generateRoleSql(formData);
      expect(sql).toContain('CREATE ROLE "app_reader" WITH');
      expect(sql).toContain('LOGIN');
      expect(sql).toContain('NOSUPERUSER');
      expect(sql).toContain('NOCREATEDB');
      expect(sql).toContain('NOCREATEROLE');
      expect(sql).toContain('INHERIT');
      expect(sql).toContain('NOREPLICATION');
      expect(sql).toContain('NOBYPASSRLS');
      expect(sql).toContain('CONNECTION LIMIT -1');
      expect(sql).toContain("VALID UNTIL 'infinity'");
      expect(sql).not.toContain('PASSWORD');
    });

    it('generates CREATE ROLE with Superuser, replication, custom connection limit and expiry date', () => {
      const formData: PgRoleFormData = {
        isNew: true,
        roleName: 'dba_admin',
        canLogin: true,
        password: 'secure_password_123',
        passwordEncryption: 'SCRAM-SHA-256',
        connectionLimit: 10,
        expiryDate: '2026-12-31',
        isSuperuser: true,
        canCreateDb: true,
        canCreateRole: true,
        inherit: true,
        canReplicate: true,
        bypassRls: true,
        comment: 'Main DBA administrative account',
        memberships: [],
        selectedDatabase: 'postgres',
        privileges: [],
        defaultPrivileges: [],
        parameters: [],
      };

      const sql = generateRoleSql(formData);
      expect(sql).toContain('CREATE ROLE "dba_admin" WITH');
      expect(sql).toContain('SUPERUSER');
      expect(sql).toContain('CREATEDB');
      expect(sql).toContain('CREATEROLE');
      expect(sql).toContain('REPLICATION');
      expect(sql).toContain('BYPASSRLS');
      expect(sql).toContain('CONNECTION LIMIT 10');
      expect(sql).toContain("VALID UNTIL '2026-12-31'");
      expect(sql).toContain("PASSWORD 'secure_password_123'");
      expect(sql).toContain("COMMENT ON ROLE \"dba_admin\" IS 'Main DBA administrative account';");
    });

    it('escapes single quotes in password and comments correctly', () => {
      const formData: PgRoleFormData = {
        isNew: true,
        roleName: 'quote_user',
        canLogin: true,
        password: "p'ass''word",
        passwordEncryption: 'SCRAM-SHA-256',
        connectionLimit: -1,
        expiryDate: null,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        comment: "O'Reilly's account",
        memberships: [],
        selectedDatabase: 'postgres',
        privileges: [],
        defaultPrivileges: [],
        parameters: [],
      };

      const sql = generateRoleSql(formData);
      expect(sql).toContain("PASSWORD 'p''ass''''word'");
      expect(sql).toContain("COMMENT ON ROLE \"quote_user\" IS 'O''Reilly''s account';");
    });
  });

  describe('sqlGenerator - ALTER DEFAULT PRIVILEGES (Enterprise Feature)', () => {
    it('generates ALTER DEFAULT PRIVILEGES for future tables and sequences', () => {
      const defaultPrivileges: PgDefaultPrivilege[] = [
        {
          id: 'def_1',
          schema: 'public',
          targetType: 'TABLES',
          permissions: {
            SELECT: true,
            INSERT: true,
            UPDATE: true,
            DELETE: true,
          },
        },
        {
          id: 'def_2',
          schema: 'app',
          targetType: 'SEQUENCES',
          permissions: {
            USAGE: true,
            SELECT: true,
          },
        },
      ];

      const formData: PgRoleFormData = {
        isNew: true,
        roleName: 'app_service',
        canLogin: true,
        passwordEncryption: 'SCRAM-SHA-256',
        connectionLimit: 50,
        expiryDate: null,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        memberships: [],
        selectedDatabase: 'postgres',
        privileges: [],
        defaultPrivileges,
        parameters: [],
      };

      const sql = generateRoleSql(formData);
      expect(sql).toContain('-- Default Privileges (Future Objects)');
      expect(sql).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA "public" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_service";');
      expect(sql).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA "app" GRANT USAGE, SELECT ON SEQUENCES TO "app_service";');
    });
  });

  describe('sqlGenerator - Session Parameters / Guardrails (Enterprise Feature)', () => {
    it('generates ALTER ROLE SET statements for query timeout and search path', () => {
      const parameters: PgRoleParameter[] = [
        { id: 'p1', name: 'statement_timeout', value: '30s' },
        { id: 'p2', name: 'search_path', value: 'app, public' },
        { id: 'p3', name: 'work_mem', value: '64MB' },
      ];

      const formData: PgRoleFormData = {
        isNew: false,
        roleName: 'analyst',
        canLogin: true,
        passwordEncryption: 'SCRAM-SHA-256',
        connectionLimit: 10,
        expiryDate: null,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        memberships: [],
        selectedDatabase: 'postgres',
        privileges: [],
        defaultPrivileges: [],
        parameters,
      };

      const sql = generateRoleSql(formData);
      expect(sql).toContain('-- Session Parameters / Guardrails');
      expect(sql).toContain("ALTER ROLE \"analyst\" SET statement_timeout = '30s';");
      expect(sql).toContain("ALTER ROLE \"analyst\" SET search_path = 'app, public';");
      expect(sql).toContain("ALTER ROLE \"analyst\" SET work_mem = '64MB';");
    });
  });

  describe('Security Advisor Engine', () => {
    it('detects critical warnings for superuser without password', () => {
      const formData: PgRoleFormData = {
        isNew: true,
        roleName: 'danger_root',
        canLogin: true,
        password: '',
        passwordEncryption: 'SCRAM-SHA-256',
        connectionLimit: -1,
        expiryDate: null,
        isSuperuser: true,
        canCreateDb: true,
        canCreateRole: true,
        inherit: true,
        canReplicate: true,
        bypassRls: true,
        memberships: [],
        selectedDatabase: 'postgres',
        privileges: [],
        defaultPrivileges: [],
        parameters: [],
      };

      const warnings = analyzeRoleSecurity(formData);
      expect(warnings.some((w) => w.level === 'critical' && w.message.includes('SUPERUSER account is configured with LOGIN but has no password'))).toBe(true);
      expect(warnings.some((w) => w.level === 'warning' && w.message.includes('REPLICATION'))).toBe(true);
      expect(warnings.some((w) => w.level === 'warning' && w.message.includes('BYPASSRLS'))).toBe(true);
    });

    it('warns about insecure MD5 or plaintext encryption', () => {
      const formData: PgRoleFormData = {
        isNew: true,
        roleName: 'legacy_user',
        canLogin: true,
        password: 'pass',
        passwordEncryption: 'MD5',
        connectionLimit: 10,
        expiryDate: null,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        memberships: [],
        selectedDatabase: 'postgres',
        privileges: [],
        defaultPrivileges: [],
        parameters: [],
      };

      const warnings = analyzeRoleSecurity(formData);
      expect(warnings.some((w) => w.level === 'warning' && w.message.includes('MD5 encryption is deprecated'))).toBe(true);
    });
  });

  describe('RBAC Preset Template Engine', () => {
    it('applies Read-Only Analyst template with 30s timeout and default select', () => {
      const initial: PgRoleFormData = {
        isNew: true,
        roleName: 'new_analyst',
        canLogin: true,
        passwordEncryption: 'SCRAM-SHA-256',
        connectionLimit: -1,
        expiryDate: null,
        isSuperuser: true,
        canCreateDb: true,
        canCreateRole: true,
        inherit: false,
        canReplicate: true,
        bypassRls: true,
        memberships: [],
        selectedDatabase: 'canvabase_test',
        privileges: [],
        defaultPrivileges: [],
        parameters: [],
      };

      const preset = applyRbacPreset(initial, 'read_only');
      expect(preset.isSuperuser).toBe(false);
      expect(preset.canCreateDb).toBe(false);
      expect(preset.bypassRls).toBe(false);
      expect(preset.connectionLimit).toBe(30);
      expect(preset.defaultPrivileges).toHaveLength(1);
      expect(preset.defaultPrivileges[0]?.permissions.SELECT).toBe(true);
      expect(preset.parameters.some((p) => p.name === 'statement_timeout' && p.value === '30s')).toBe(true);
    });

    it('applies Application Service template with CRUD and sequence access', () => {
      const initial: PgRoleFormData = {
        isNew: true,
        roleName: 'backend_api',
        canLogin: true,
        passwordEncryption: 'SCRAM-SHA-256',
        connectionLimit: -1,
        expiryDate: null,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        memberships: [],
        selectedDatabase: 'postgres',
        privileges: [],
        defaultPrivileges: [],
        parameters: [],
      };

      const preset = applyRbacPreset(initial, 'app_service');
      expect(preset.connectionLimit).toBe(100);
      expect(preset.defaultPrivileges.some((dp) => dp.targetType === 'TABLES' && dp.permissions.INSERT)).toBe(true);
      expect(preset.defaultPrivileges.some((dp) => dp.targetType === 'SEQUENCES' && dp.permissions.USAGE)).toBe(true);
      expect(preset.defaultPrivileges.some((dp) => dp.targetType === 'FUNCTIONS' && dp.permissions.EXECUTE)).toBe(true);
    });
  });
});
