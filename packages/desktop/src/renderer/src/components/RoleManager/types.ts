// packages/desktop/src/renderer/src/components/RoleManager/types.ts

export type PasswordEncryptionType = 'SCRAM-SHA-256' | 'MD5' | 'PLAINTEXT' | 'DEFAULT';

export type PrivilegeTargetType = 'DATABASE' | 'SCHEMA' | 'TABLE' | 'VIEW' | 'FUNCTION' | 'SEQUENCE';

export type DefaultPrivilegeTargetType = 'TABLES' | 'SEQUENCES' | 'FUNCTIONS' | 'TYPES' | 'SCHEMAS';

export type PrivilegeAction =
  | 'CONNECT'
  | 'CREATE'
  | 'DELETE'
  | 'EXECUTE'
  | 'INSERT'
  | 'REFERENCES'
  | 'SELECT'
  | 'TEMPORARY'
  | 'TRIGGER'
  | 'TRUNCATE'
  | 'UPDATE'
  | 'USAGE';

export const ALL_PRIVILEGE_ACTIONS: readonly PrivilegeAction[] = [
  'CONNECT',
  'CREATE',
  'DELETE',
  'EXECUTE',
  'INSERT',
  'REFERENCES',
  'SELECT',
  'TEMPORARY',
  'TRIGGER',
  'TRUNCATE',
  'UPDATE',
  'USAGE',
] as const;

/** Representation of PostgreSQL role (`pg_roles` / `pg_authid`) */
export interface PgRole {
  roleId: number;
  roleName: string;
  canLogin: boolean;
  isSuperuser: boolean;
  canCreateDb: boolean;
  canCreateRole: boolean;
  inherit: boolean;
  canReplicate: boolean;
  bypassRls: boolean;
  connectionLimit: number;
  expiryDate: string | null; // ISO Date string 'YYYY-MM-DD' or null
  passwordEncryption: PasswordEncryptionType;
  comment?: string | null | undefined;
}

/** Representation of role membership (GRANT role TO user [WITH ADMIN OPTION]) */
export interface PgRoleMembership {
  roleName: string;
  granted: boolean;
  adminOption: boolean;
}

/** Representation of specific object privileges */
export interface PgPrivilege {
  id: string;
  targetType: PrivilegeTargetType;
  database: string;
  schema?: string | undefined;
  objectName: string;
  permissions: Record<PrivilegeAction, boolean>;
  grantablePermissions?: Record<PrivilegeAction, boolean> | undefined;
}

/** Representation of Default Privileges for future objects (ALTER DEFAULT PRIVILEGES) */
export interface PgDefaultPrivilege {
  id: string;
  schema: string;
  targetType: DefaultPrivilegeTargetType;
  permissions: Partial<Record<PrivilegeAction, boolean>>;
}

/** Representation of Runtime Session Configuration / Parameters (ALTER ROLE SET) */
export interface PgRoleParameter {
  id: string;
  name: string;
  value: string;
}

export type RbacPresetId = 'read_only' | 'app_service' | 'data_engineer' | 'minimal_login';

export interface SecurityWarning {
  level: 'critical' | 'warning' | 'info';
  message: string;
}

/** Form data structure for creating / editing role */
export interface PgRoleFormData {
  isNew: boolean;
  initialRoleName?: string | undefined;
  // General Tab
  roleName: string;
  roleId?: number | undefined;
  canLogin: boolean;
  password?: string | undefined;
  confirmPassword?: string | undefined;
  passwordEncryption: PasswordEncryptionType;
  connectionLimit: number;
  expiryDate: string | null;
  isSuperuser: boolean;
  canCreateDb: boolean;
  canCreateRole: boolean;
  inherit: boolean;
  canReplicate: boolean;
  bypassRls: boolean;
  comment?: string | null | undefined;

  // Member Of Tab
  memberships: PgRoleMembership[];

  // Privileges Tab
  selectedDatabase: string;
  privileges: PgPrivilege[];

  // Enterprise Enhancements
  defaultPrivileges: PgDefaultPrivilege[];
  parameters: PgRoleParameter[];
}

export type RoleEditorTabId =
  | 'general'
  | 'member_of'
  | 'privileges'
  | 'default_privileges'
  | 'parameters'
  | 'sql_preview';
