// packages/desktop/src/renderer/src/components/RoleManager/RoleEditorTabs/DefaultPrivilegesTab.tsx
import { useState, type JSX } from 'react';
import type {
  PgDefaultPrivilege,
  DefaultPrivilegeTargetType,
  PrivilegeAction,
} from '../types';

interface DefaultPrivilegesTabProps {
  defaultPrivileges: PgDefaultPrivilege[];
  onAddDefaultPrivilege: (newDef: PgDefaultPrivilege) => void;
  onDeleteDefaultPrivilege: (id: string) => void;
  onTogglePermission: (id: string, action: PrivilegeAction, nextValue: boolean) => void;
}

const DEFAULT_PRIV_ACTIONS: Record<DefaultPrivilegeTargetType, PrivilegeAction[]> = {
  TABLES: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'],
  SEQUENCES: ['USAGE', 'SELECT', 'UPDATE'],
  FUNCTIONS: ['EXECUTE'],
  TYPES: ['USAGE'],
  SCHEMAS: ['USAGE', 'CREATE'],
};

export function DefaultPrivilegesTab({
  defaultPrivileges,
  onAddDefaultPrivilege,
  onDeleteDefaultPrivilege,
  onTogglePermission,
}: DefaultPrivilegesTabProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newSchema, setNewSchema] = useState('public');
  const [newTargetType, setNewTargetType] = useState<DefaultPrivilegeTargetType>('TABLES');

  const handleAdd = (): void => {
    const newId = `def_${Date.now()}`;
    const initialPerms: Partial<Record<PrivilegeAction, boolean>> = {};
    const relevantActions = DEFAULT_PRIV_ACTIONS[newTargetType] || ['SELECT'];
    relevantActions.forEach((act) => {
      initialPerms[act] = true;
    });

    const newDef: PgDefaultPrivilege = {
      id: newId,
      schema: newSchema.trim() || 'public',
      targetType: newTargetType,
      permissions: initialPerms,
    };

    onAddDefaultPrivilege(newDef);
    setSelectedId(newId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Informational Banner */}
      <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--accent)' }}>ALTER DEFAULT PRIVILEGES:</strong> Automatically grants permissions on objects created in the future.
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Schema:</span>
          <input
            type="text"
            value={newSchema}
            onChange={(e) => setNewSchema(e.target.value)}
            className="role-form-input font-mono"
            style={{ width: '100px', padding: '3px 6px', fontSize: '11px' }}
            placeholder="public"
          />

          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '4px' }}>For:</span>
          <select
            value={newTargetType}
            onChange={(e) => setNewTargetType(e.target.value as DefaultPrivilegeTargetType)}
            className="cb-select"
            style={{ padding: '3px 6px', fontSize: '11px' }}
          >
            <option value="TABLES">TABLES</option>
            <option value="SEQUENCES">SEQUENCES</option>
            <option value="FUNCTIONS">FUNCTIONS</option>
            <option value="TYPES">TYPES</option>
            <option value="SCHEMAS">SCHEMAS</option>
          </select>

          <button
            type="button"
            onClick={handleAdd}
            className="role-mgr-btn"
            style={{ padding: '3px 8px', fontSize: '11px' }}
          >
            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>＋</span> Add Rule
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="role-mgr-table-wrapper">
        <table className="role-mgr-table">
          <thead>
            <tr>
              <th style={{ width: '140px' }}>Schema</th>
              <th style={{ width: '140px' }}>Target Type</th>
              <th>Configured Default Permissions</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {defaultPrivileges.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No default privilege rules defined. Click &quot;+ Add Rule&quot; above to auto-grant access to new tables or functions.
                </td>
              </tr>
            ) : (
              defaultPrivileges.map((item) => {
                const isSelected = selectedId === item.id;
                const actions = DEFAULT_PRIV_ACTIONS[item.targetType] || [];

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={isSelected ? 'selected' : ''}
                  >
                    <td className="font-mono" style={{ fontWeight: 600 }}>
                      {item.schema}
                    </td>
                    <td>
                      <span className="role-mgr-badge" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                        {item.targetType}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {actions.map((act) => {
                          const isChecked = !!item.permissions[act];
                          return (
                            <label
                              key={act}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => onTogglePermission(item.id, act, e.target.checked)}
                                style={{ width: '13px', height: '13px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                              />
                              <span>{act}</span>
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onDeleteDefaultPrivilege(item.id)}
                        className="role-mgr-btn role-mgr-btn-danger"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        title="Delete Rule"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
