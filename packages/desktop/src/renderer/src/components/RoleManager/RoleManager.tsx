// packages/desktop/src/renderer/src/components/RoleManager/RoleManager.tsx
import { useState, useEffect, type JSX } from 'react';
import type { AppStore } from '../../store';
import { RoleList } from './RoleList';
import { RoleEditor } from './RoleEditor';
import { generateRoleSql } from './sqlGenerator';
import type { PgRole, PgRoleFormData, PgRoleMembership } from './types';

const DEFAULT_PG_ROLES: PgRole[] = [
  { roleId: 32993, roleName: 'dms_admin', canLogin: true, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 4544, roleName: 'pg_checkpoint', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 6304, roleName: 'pg_create_subscription', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 6171, roleName: 'pg_database_owner', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 4571, roleName: 'pg_execute_server_program', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 6337, roleName: 'pg_maintain', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 3373, roleName: 'pg_monitor', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 6181, roleName: 'pg_read_all_data', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 3374, roleName: 'pg_read_all_settings', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 3375, roleName: 'pg_read_all_stats', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 4569, roleName: 'pg_read_server_files', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 6392, roleName: 'pg_signal_autovacuum_worker', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 4200, roleName: 'pg_signal_backend', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 3377, roleName: 'pg_stat_scan_tables', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 4550, roleName: 'pg_use_reserved_connections', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 6182, roleName: 'pg_write_all_data', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 4570, roleName: 'pg_write_server_files', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 10, roleName: 'postgres', canLogin: true, isSuperuser: true, canCreateDb: true, canCreateRole: true, inherit: true, canReplicate: true, bypassRls: true, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 0, roleName: 'public', canLogin: false, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: false, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
  { roleId: 49132, roleName: 'user', canLogin: true, isSuperuser: false, canCreateDb: false, canCreateRole: false, inherit: true, canReplicate: false, bypassRls: false, connectionLimit: -1, expiryDate: null, passwordEncryption: 'SCRAM-SHA-256' },
];

const FALLBACK_DBS = [
  'postgres',
  'canvabase_test',
  'dms_cms',
  'persija_manual',
  'posmid',
  'posmid_db',
  'posmid_test',
  'stencil_canvastack',
];

interface RoleManagerProps {
  store: AppStore;
}

export function RoleManager({ store }: RoleManagerProps): JSX.Element {
  const browser = store((s) => s.browser);
  const activeConnectionId = store((s) => s.activeConnectionId);
  const activeConnection = store((s) =>
    s.connections.find((c) => c.id === activeConnectionId)
  );

  const [roles, setRoles] = useState<PgRole[]>(DEFAULT_PG_ROLES);
  const [selectedRoleName, setSelectedRoleName] = useState<string | null>('dms_admin');
  const [mode, setMode] = useState<'list' | 'editor'>('list');
  const [editorData, setEditorData] = useState<PgRoleFormData | null>(null);

  // Sync databases from store if available
  const availableDatabases =
    browser.databases && browser.databases.length > 0
      ? browser.databases.map((d) => d.name)
      : FALLBACK_DBS;

  useEffect(() => {
    // If browser.users is populated from real database connection
    if (browser.users && browser.users.length > 0) {
      const liveRoles: PgRole[] = browser.users.map((u, idx) => ({
        roleId: typeof u.id === 'number' ? u.id : 1000 + idx,
        roleName: u.name,
        canLogin: true,
        isSuperuser: u.name === 'postgres' || u.name === 'root',
        canCreateDb: false,
        canCreateRole: false,
        inherit: true,
        canReplicate: false,
        bypassRls: false,
        connectionLimit: -1,
        expiryDate: null,
        passwordEncryption: 'SCRAM-SHA-256',
        comment: u.comment,
      }));
      setRoles(liveRoles);
    }
  }, [browser.users]);

  const handleNewRole = (): void => {
    const defaultMemberships: PgRoleMembership[] = roles.map((r) => ({
      roleName: r.roleName,
      granted: false,
      adminOption: false,
    }));

    const newFormData: PgRoleFormData = {
      isNew: true,
      roleName: 'new_role',
      canLogin: true,
      password: '',
      confirmPassword: '',
      passwordEncryption: 'SCRAM-SHA-256',
      connectionLimit: -1,
      expiryDate: null,
      isSuperuser: false,
      canCreateDb: false,
      canCreateRole: false,
      inherit: true,
      canReplicate: false,
      bypassRls: false,
      memberships: defaultMemberships,
      selectedDatabase: availableDatabases[0] ?? 'postgres',
      privileges: [],
      defaultPrivileges: [],
      parameters: [],
    };

    setEditorData(newFormData);
    setMode('editor');
  };

  const handleEditRole = (role: PgRole): void => {
    const memberships: PgRoleMembership[] = roles
      .filter((r) => r.roleName !== role.roleName)
      .map((r) => ({
        roleName: r.roleName,
        granted: false,
        adminOption: false,
      }));

    const editFormData: PgRoleFormData = {
      isNew: false,
      initialRoleName: role.roleName,
      roleName: role.roleName,
      roleId: role.roleId,
      canLogin: role.canLogin,
      password: '',
      confirmPassword: '',
      passwordEncryption: role.passwordEncryption,
      connectionLimit: role.connectionLimit,
      expiryDate: role.expiryDate,
      isSuperuser: role.isSuperuser,
      canCreateDb: role.canCreateDb,
      canCreateRole: role.canCreateRole,
      inherit: role.inherit,
      canReplicate: role.canReplicate,
      bypassRls: role.bypassRls,
      comment: role.comment,
      memberships,
      selectedDatabase: availableDatabases[0] ?? 'postgres',
      privileges: [
        {
          id: 'priv_db_root',
          targetType: 'DATABASE',
          database: availableDatabases[0] ?? 'postgres',
          objectName: availableDatabases[0] ?? 'postgres',
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
      ],
      defaultPrivileges: [],
      parameters: [],
    };

    setEditorData(editFormData);
    setMode('editor');
  };

  const handleDeleteRole = (role: PgRole): void => {
    if (window.confirm(`Are you sure you want to drop role "${role.roleName}"?`)) {
      setRoles((prev) => prev.filter((r) => r.roleName !== role.roleName));
      if (selectedRoleName === role.roleName) {
        setSelectedRoleName(null);
      }
    }
  };

  const handleSaveEditor = async (saved: PgRoleFormData): Promise<void> => {
    const sql = generateRoleSql(saved);
    console.info('[RoleManager] Generated SQL:', sql);

    if (activeConnection && activeConnection.engine === 'postgresql') {
      try {
        const res = await store.getState().client.query.execute({
          connectionId: activeConnection.id,
          sql,
        });
        if (!res.ok) {
          const errMsg = 'message' in res.error && res.error.message ? res.error.message : 'Execution error';
          window.alert(`Database execution notice:\n${errMsg}`);
        }
      } catch (err) {
        console.warn('[RoleManager] SQL Execution bypassed or offline:', err);
      }
    }

    if (saved.isNew) {
      const newRole: PgRole = {
        roleId: Math.floor(10000 + Math.random() * 90000),
        roleName: saved.roleName,
        canLogin: saved.canLogin,
        isSuperuser: saved.isSuperuser,
        canCreateDb: saved.canCreateDb,
        canCreateRole: saved.canCreateRole,
        inherit: saved.inherit,
        canReplicate: saved.canReplicate,
        bypassRls: saved.bypassRls,
        connectionLimit: saved.connectionLimit,
        expiryDate: saved.expiryDate,
        passwordEncryption: saved.passwordEncryption,
        comment: saved.comment ?? null,
      };
      setRoles((prev) => [...prev, newRole]);
      setSelectedRoleName(newRole.roleName);
    } else {
      setRoles((prev) =>
        prev.map((r) =>
          r.roleName === saved.initialRoleName
            ? {
                ...r,
                roleName: saved.roleName,
                canLogin: saved.canLogin,
                isSuperuser: saved.isSuperuser,
                canCreateDb: saved.canCreateDb,
                canCreateRole: saved.canCreateRole,
                inherit: saved.inherit,
                canReplicate: saved.canReplicate,
                bypassRls: saved.bypassRls,
                connectionLimit: saved.connectionLimit,
                expiryDate: saved.expiryDate,
                passwordEncryption: saved.passwordEncryption,
                comment: saved.comment ?? null,
              }
            : r
        )
      );
      setSelectedRoleName(saved.roleName);
    }
    setMode('list');
  };

  return (
    <div className="role-mgr-container">
      {mode === 'list' ? (
        <RoleList
          roles={roles}
          selectedRoleName={selectedRoleName}
          onSelectRole={(r) => setSelectedRoleName(r.roleName)}
          onNewRole={handleNewRole}
          onEditRole={handleEditRole}
          onDeleteRole={handleDeleteRole}
          onOpenPrivilegeManager={() => {
            if (selectedRoleName) {
              const r = roles.find((item) => item.roleName === selectedRoleName);
              if (r) handleEditRole(r);
            }
          }}
        />
      ) : (
        editorData && (
          <RoleEditor
            initialData={editorData}
            databaseList={availableDatabases}
            onSave={(data) => void handleSaveEditor(data)}
            onCancel={() => setMode('list')}
          />
        )
      )}
    </div>
  );
}
