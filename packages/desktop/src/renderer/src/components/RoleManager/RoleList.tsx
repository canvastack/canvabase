// packages/desktop/src/renderer/src/components/RoleManager/RoleList.tsx
import { useState, type JSX } from 'react';
import type { PgRole } from './types';

interface RoleListProps {
  roles: PgRole[];
  selectedRoleName: string | null;
  onSelectRole: (role: PgRole) => void;
  onNewRole: () => void;
  onEditRole: (role: PgRole) => void;
  onDeleteRole: (role: PgRole) => void;
  onOpenPrivilegeManager: () => void;
}

export function RoleList({
  roles,
  selectedRoleName,
  onSelectRole,
  onNewRole,
  onEditRole,
  onDeleteRole,
  onOpenPrivilegeManager,
}: RoleListProps): JSX.Element {
  const [search, setSearch] = useState('');

  const filteredRoles = roles.filter(
    (r) =>
      r.roleName.toLowerCase().includes(search.toLowerCase()) ||
      r.roleId.toString().includes(search)
  );

  const selectedRole = roles.find((r) => r.roleName === selectedRoleName);

  return (
    <div className="role-mgr-container">
      {/* Dense Navicat Toolbar */}
      <div className="role-mgr-toolbar">
        <div className="role-mgr-actions">
          <button
            type="button"
            onClick={onNewRole}
            className="role-mgr-btn role-mgr-btn-primary"
            title="Create New Role"
          >
            <span style={{ fontSize: '14px', lineHeight: 1 }}>⊕</span>
            <span>New Role</span>
          </button>

          <button
            type="button"
            disabled={!selectedRole}
            onClick={() => selectedRole && onEditRole(selectedRole)}
            className="role-mgr-btn"
            title="Edit Selected Role"
          >
            <span style={{ fontSize: '13px', lineHeight: 1 }}>✎</span>
            <span>Edit Role</span>
          </button>

          <button
            type="button"
            disabled={!selectedRole}
            onClick={() => selectedRole && onDeleteRole(selectedRole)}
            className="role-mgr-btn role-mgr-btn-danger"
            title="Delete Selected Role"
          >
            <span style={{ fontSize: '13px', lineHeight: 1 }}>⊖</span>
            <span>Delete Role</span>
          </button>

          <div className="role-mgr-divider" />

          <button
            type="button"
            onClick={onOpenPrivilegeManager}
            className="role-mgr-btn"
            title="Open Privilege Manager"
          >
            <span>🛡️</span>
            <span>Privilege Manager</span>
          </button>
        </div>

        {/* Search Box */}
        <div>
          <input
            type="text"
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="role-mgr-search-input"
          />
        </div>
      </div>

      {/* Data Grid Table */}
      <div className="role-mgr-table-wrapper">
        <table className="role-mgr-table">
          <thead>
            <tr>
              <th style={{ minWidth: '220px' }}>Role Name</th>
              <th style={{ width: '100px', textAlign: 'right' }}>Role ID</th>
              <th style={{ width: '100px', textAlign: 'center' }}>Can login</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Connect Limit</th>
              <th style={{ width: '140px' }}>Expiry Date</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {filteredRoles.map((role) => {
              const isSelected = selectedRoleName === role.roleName;

              return (
                <tr
                  key={role.roleName}
                  onClick={() => onSelectRole(role)}
                  onDoubleClick={() => onEditRole(role)}
                  className={isSelected ? 'selected' : ''}
                >
                  <td className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>
                      {role.isSuperuser ? '👑' : '👤'}
                    </span>
                    <span style={{ fontWeight: 600 }}>{role.roleName}</span>
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {role.roleId}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`role-mgr-badge ${role.canLogin ? 'role-mgr-badge-yes' : 'role-mgr-badge-no'}`}>
                      {role.canLogin ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="font-mono" style={{ textAlign: 'right' }}>
                    {role.connectionLimit}
                  </td>
                  <td className="font-mono">
                    {role.expiryDate || '-'}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {role.comment || ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="role-mgr-statusbar">
        <span>{filteredRoles.length} Roles</span>
        <span>PostgreSQL Server Roles</span>
      </div>
    </div>
  );
}
