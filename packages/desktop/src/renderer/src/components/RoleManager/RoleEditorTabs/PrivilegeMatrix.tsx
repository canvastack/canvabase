// packages/desktop/src/renderer/src/components/RoleManager/RoleEditorTabs/PrivilegeMatrix.tsx
import { type JSX } from 'react';
import { ALL_PRIVILEGE_ACTIONS, type PgPrivilege, type PrivilegeAction } from '../types';

interface PrivilegeMatrixProps {
  privileges: PgPrivilege[];
  selectedPrivilegeId: string | null;
  onSelectRow: (id: string) => void;
  onTogglePermission: (id: string, action: PrivilegeAction, nextValue: boolean) => void;
  onToggleAllForRow: (id: string, nextValue: boolean) => void;
}

export function PrivilegeMatrix({
  privileges,
  selectedPrivilegeId,
  onSelectRow,
  onTogglePermission,
  onToggleAllForRow,
}: PrivilegeMatrixProps): JSX.Element {
  return (
    <div className="role-mgr-table-wrapper" style={{ borderTop: '1px solid var(--border)' }}>
      <table className="role-mgr-table privilege-matrix-table">
        <thead>
          <tr>
            <th style={{ width: '32px', textAlign: 'center' }}>#</th>
            <th style={{ minWidth: '90px' }}>Type</th>
            <th style={{ minWidth: '90px' }}>Schema</th>
            <th style={{ minWidth: '140px' }}>Name</th>
            {ALL_PRIVILEGE_ACTIONS.map((action) => (
              <th
                key={action}
                style={{ width: '70px', textAlign: 'center', fontSize: '10.5px' }}
                title={action}
              >
                {action.charAt(0) + action.slice(1).toLowerCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {privileges.length === 0 ? (
            <tr>
              <td
                colSpan={4 + ALL_PRIVILEGE_ACTIONS.length}
                style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                No privileges assigned yet. Click &quot;+ Add Privilege&quot; above to grant object access.
              </td>
            </tr>
          ) : (
            privileges.map((item) => {
              const isSelected = selectedPrivilegeId === item.id;
              const allChecked = ALL_PRIVILEGE_ACTIONS.every((a) => item.permissions[a]);

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectRow(item.id)}
                  className={isSelected ? 'selected' : ''}
                >
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => onToggleAllForRow(item.id, e.target.checked)}
                      title="Toggle all permissions for this row"
                      style={{ width: '14px', height: '14px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {item.targetType}
                  </td>
                  <td className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {item.schema || '-'}
                  </td>
                  <td className="font-mono" style={{ fontWeight: 600 }}>
                    {item.objectName}
                  </td>

                  {ALL_PRIVILEGE_ACTIONS.map((action) => {
                    const isChecked = !!item.permissions[action];
                    return (
                      <td
                        key={action}
                        style={{ textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => onTogglePermission(item.id, action, e.target.checked)}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
