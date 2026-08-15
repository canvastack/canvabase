// packages/desktop/src/renderer/src/components/RoleManager/sqlGenerator.ts
import type {
  PgRoleFormData,
  PrivilegeAction,
  SecurityWarning,
  RbacPresetId,
  PgPrivilege,
  PgDefaultPrivilege,
} from './types';

export function generateRoleSql(data: PgRoleFormData): string {
  const statements: string[] = [];
  const rawRole = data.roleName.trim();
  const roleNameIdent = rawRole.length > 0 ? `"${rawRole}"` : '"unnamed_role"';

  // 1. CREATE / ALTER ROLE Statement
  const clauses: string[] = [];
  clauses.push(data.canLogin ? 'LOGIN' : 'NOLOGIN');
  clauses.push(data.isSuperuser ? 'SUPERUSER' : 'NOSUPERUSER');
  clauses.push(data.canCreateDb ? 'CREATEDB' : 'NOCREATEDB');
  clauses.push(data.canCreateRole ? 'CREATEROLE' : 'NOCREATEROLE');
  clauses.push(data.inherit ? 'INHERIT' : 'NOINHERIT');
  clauses.push(data.canReplicate ? 'REPLICATION' : 'NOREPLICATION');
  clauses.push(data.bypassRls ? 'BYPASSRLS' : 'NOBYPASSRLS');

  if (data.connectionLimit !== undefined && data.connectionLimit !== null) {
    clauses.push(`CONNECTION LIMIT ${data.connectionLimit}`);
  }

  if (data.expiryDate && data.expiryDate.trim() !== '') {
    clauses.push(`VALID UNTIL '${data.expiryDate}'`);
  } else {
    clauses.push(`VALID UNTIL 'infinity'`);
  }

  if (data.password && data.password.length > 0) {
    clauses.push(`PASSWORD '${data.password.replace(/'/g, "''")}'`);
  }

  if (data.isNew) {
    statements.push(`-- Create Role\nCREATE ROLE ${roleNameIdent} WITH\n  ${clauses.join('\n  ')};`);
  } else {
    statements.push(`-- Alter Role\nALTER ROLE ${roleNameIdent} WITH\n  ${clauses.join('\n  ')};`);
  }

  // 2. Member Of (GRANT role TO user)
  const grantedMemberships = data.memberships.filter((m) => m.granted);
  if (grantedMemberships.length > 0) {
    statements.push('\n-- Membership Grants');
    grantedMemberships.forEach((m) => {
      const adminOpt = m.adminOption ? ' WITH ADMIN OPTION' : '';
      statements.push(`GRANT "${m.roleName}" TO ${roleNameIdent}${adminOpt};`);
    });
  }

  // 3. Object Privileges
  const activePrivileges = data.privileges.filter((p) =>
    Object.values(p.permissions).some(Boolean)
  );

  if (activePrivileges.length > 0) {
    statements.push('\n-- Object Privileges');
    activePrivileges.forEach((p) => {
      const actions = (Object.keys(p.permissions) as PrivilegeAction[]).filter(
        (action) => p.permissions[action]
      );
      if (actions.length === 0) return;

      const actionsSql = actions.join(', ');
      let targetSql = '';

      if (p.targetType === 'DATABASE') {
        targetSql = `DATABASE "${p.objectName}"`;
      } else if (p.targetType === 'SCHEMA') {
        targetSql = `SCHEMA "${p.objectName}"`;
      } else {
        const schemaPrefix = p.schema ? `"${p.schema}".` : '';
        targetSql = `TABLE ${schemaPrefix}"${p.objectName}"`;
      }

      statements.push(`GRANT ${actionsSql} ON ${targetSql} TO ${roleNameIdent};`);
    });
  }

  // 4. Default Privileges for Future Objects (Enterprise Feature)
  const activeDefaults = data.defaultPrivileges.filter((dp) =>
    Object.values(dp.permissions).some(Boolean)
  );

  if (activeDefaults.length > 0) {
    statements.push('\n-- Default Privileges (Future Objects)');
    activeDefaults.forEach((dp) => {
      const actions = (Object.keys(dp.permissions) as PrivilegeAction[]).filter(
        (act) => dp.permissions[act]
      );
      if (actions.length === 0) return;

      const actionsSql = actions.join(', ');
      const schemaClause = dp.schema.trim() ? `IN SCHEMA "${dp.schema.trim()}" ` : '';
      statements.push(
        `ALTER DEFAULT PRIVILEGES ${schemaClause}GRANT ${actionsSql} ON ${dp.targetType} TO ${roleNameIdent};`
      );
    });
  }

  // 5. Session Parameters / Settings (ALTER ROLE SET)
  const activeParams = data.parameters.filter(
    (param) => param.name.trim() !== '' && param.value.trim() !== ''
  );

  if (activeParams.length > 0) {
    statements.push('\n-- Session Parameters / Guardrails');
    activeParams.forEach((param) => {
      const val = param.value.trim();
      const formattedVal = val.startsWith("'") || !isNaN(Number(val)) ? val : `'${val.replace(/'/g, "''")}'`;
      statements.push(`ALTER ROLE ${roleNameIdent} SET ${param.name.trim()} = ${formattedVal};`);
    });
  }

  // 6. Comments
  if (data.comment && data.comment.trim().length > 0) {
    statements.push(`\n-- Comment\nCOMMENT ON ROLE ${roleNameIdent} IS '${data.comment.replace(/'/g, "''")}';`);
  }

  return statements.join('\n');
}

/** Security Advisor Rules Engine */
export function analyzeRoleSecurity(data: PgRoleFormData): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];

  if (data.isSuperuser) {
    warnings.push({
      level: 'critical',
      message: 'SUPERUSER grants unrestricted access to all databases, files, and server functions. Use least-privilege roles instead of SUPERUSER for applications.',
    });
    if (!data.password && data.canLogin) {
      warnings.push({
        level: 'critical',
        message: 'SUPERUSER account is configured with LOGIN but has no password set.',
      });
    }
  }

  if (data.canReplicate) {
    warnings.push({
      level: 'warning',
      message: 'REPLICATION permission allows streaming replication and raw WAL inspection.',
    });
  }

  if (data.bypassRls) {
    warnings.push({
      level: 'warning',
      message: 'BYPASSRLS ignores all Row-Level Security policies across all tables in every database.',
    });
  }

  if (data.canLogin && data.connectionLimit === -1 && !data.isSuperuser) {
    warnings.push({
      level: 'info',
      message: 'Connection limit is unlimited (-1). Consider setting a connection pool budget for this service role.',
    });
  }

  if (data.passwordEncryption === 'PLAINTEXT' || data.passwordEncryption === 'MD5') {
    warnings.push({
      level: 'warning',
      message: `${data.passwordEncryption} encryption is deprecated or insecure. Use SCRAM-SHA-256 for secure password storage.`,
    });
  }

  return warnings;
}

/** 1-Click RBAC Preset Template Engine */
export function applyRbacPreset(formData: PgRoleFormData, presetId: RbacPresetId): PgRoleFormData {
  const db = formData.selectedDatabase || 'postgres';

  switch (presetId) {
    case 'read_only': {
      const readOnlyPrivs: PgPrivilege[] = [
        {
          id: `priv_db_${Date.now()}_1`,
          targetType: 'DATABASE',
          database: db,
          objectName: db,
          permissions: {
            CONNECT: true,
            CREATE: false,
            DELETE: false,
            EXECUTE: false,
            INSERT: false,
            REFERENCES: false,
            SELECT: false,
            TEMPORARY: false,
            TRIGGER: false,
            TRUNCATE: false,
            UPDATE: false,
            USAGE: false,
          },
        },
        {
          id: `priv_schema_${Date.now()}_2`,
          targetType: 'SCHEMA',
          database: db,
          schema: 'public',
          objectName: 'public',
          permissions: {
            CONNECT: false,
            CREATE: false,
            DELETE: false,
            EXECUTE: false,
            INSERT: false,
            REFERENCES: false,
            SELECT: false,
            TEMPORARY: false,
            TRIGGER: false,
            TRUNCATE: false,
            UPDATE: false,
            USAGE: true,
          },
        },
      ];

      const readOnlyDefaults: PgDefaultPrivilege[] = [
        {
          id: `def_${Date.now()}_1`,
          schema: 'public',
          targetType: 'TABLES',
          permissions: { SELECT: true },
        },
      ];

      return {
        ...formData,
        canLogin: true,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        connectionLimit: 30,
        privileges: readOnlyPrivs,
        defaultPrivileges: readOnlyDefaults,
        parameters: [
          { id: 'p1', name: 'statement_timeout', value: '30s' },
          { id: 'p2', name: 'search_path', value: 'public' },
        ],
        comment: 'Read-only analyst role with 30s query timeout',
      };
    }

    case 'app_service': {
      const appPrivs: PgPrivilege[] = [
        {
          id: `priv_db_${Date.now()}_1`,
          targetType: 'DATABASE',
          database: db,
          objectName: db,
          permissions: {
            CONNECT: true,
            CREATE: false,
            DELETE: false,
            EXECUTE: false,
            INSERT: false,
            REFERENCES: false,
            SELECT: false,
            TEMPORARY: true,
            TRIGGER: false,
            TRUNCATE: false,
            UPDATE: false,
            USAGE: false,
          },
        },
        {
          id: `priv_schema_${Date.now()}_2`,
          targetType: 'SCHEMA',
          database: db,
          schema: 'public',
          objectName: 'public',
          permissions: {
            CONNECT: false,
            CREATE: false,
            DELETE: false,
            EXECUTE: false,
            INSERT: false,
            REFERENCES: false,
            SELECT: false,
            TEMPORARY: false,
            TRIGGER: false,
            TRUNCATE: false,
            UPDATE: false,
            USAGE: true,
          },
        },
      ];

      const appDefaults: PgDefaultPrivilege[] = [
        {
          id: `def_${Date.now()}_1`,
          schema: 'public',
          targetType: 'TABLES',
          permissions: { SELECT: true, INSERT: true, UPDATE: true, DELETE: true },
        },
        {
          id: `def_${Date.now()}_2`,
          schema: 'public',
          targetType: 'SEQUENCES',
          permissions: { USAGE: true, SELECT: true, UPDATE: true },
        },
        {
          id: `def_${Date.now()}_3`,
          schema: 'public',
          targetType: 'FUNCTIONS',
          permissions: { EXECUTE: true },
        },
      ];

      return {
        ...formData,
        canLogin: true,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        connectionLimit: 100,
        privileges: appPrivs,
        defaultPrivileges: appDefaults,
        parameters: [
          { id: 'p1', name: 'idle_in_transaction_session_timeout', value: '15s' },
          { id: 'p2', name: 'search_path', value: 'public' },
        ],
        comment: 'Application service account with standard CRUD and sequence permissions',
      };
    }

    case 'data_engineer': {
      return {
        ...formData,
        canLogin: true,
        isSuperuser: false,
        canCreateDb: true,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        connectionLimit: 20,
        privileges: [
          {
            id: `priv_db_${Date.now()}_1`,
            targetType: 'DATABASE',
            database: db,
            objectName: db,
            permissions: {
              CONNECT: true,
              CREATE: true,
              DELETE: true,
              EXECUTE: true,
              INSERT: true,
              REFERENCES: true,
              SELECT: true,
              TEMPORARY: true,
              TRIGGER: true,
              TRUNCATE: true,
              UPDATE: true,
              USAGE: true,
            },
          },
        ],
        defaultPrivileges: [
          {
            id: `def_${Date.now()}_1`,
            schema: 'public',
            targetType: 'TABLES',
            permissions: { SELECT: true, INSERT: true, UPDATE: true, DELETE: true, TRUNCATE: true, REFERENCES: true, TRIGGER: true },
          },
        ],
        parameters: [
          { id: 'p1', name: 'work_mem', value: '128MB' },
          { id: 'p2', name: 'statement_timeout', value: '300s' },
        ],
        comment: 'Data engineer / migration executor with DDL & database creation access',
      };
    }

    case 'minimal_login':
    default: {
      return {
        ...formData,
        canLogin: true,
        isSuperuser: false,
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        connectionLimit: 10,
        privileges: [
          {
            id: `priv_db_${Date.now()}_1`,
            targetType: 'DATABASE',
            database: db,
            objectName: db,
            permissions: {
              CONNECT: true,
              CREATE: false,
              DELETE: false,
              EXECUTE: false,
              INSERT: false,
              REFERENCES: false,
              SELECT: false,
              TEMPORARY: false,
              TRIGGER: false,
              TRUNCATE: false,
              UPDATE: false,
              USAGE: false,
            },
          },
        ],
        defaultPrivileges: [],
        parameters: [],
        comment: 'Minimal login user with connect-only privileges',
      };
    }
  }
}
