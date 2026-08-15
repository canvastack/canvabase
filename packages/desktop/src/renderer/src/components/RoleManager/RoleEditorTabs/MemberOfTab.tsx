// packages/desktop/src/renderer/src/components/RoleManager/RoleEditorTabs/MemberOfTab.tsx
import { useState, type JSX } from 'react';
import type { PgRoleMembership } from '../types';

interface MemberOfTabProps {
  memberships: PgRoleMembership[];
  onToggleMembership: (roleName: string, field: 'granted' | 'adminOption', value: boolean) => void;
}

export function MemberOfTab({ memberships, onToggleMembership }: MemberOfTabProps): JSX.Element {
  const [filterText, setFilterText] = useState('');

  const filtered = memberships.filter((m) =>
    m.roleName.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Select parent roles to grant membership (Equivalent to: <code style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>GRANT role TO user</code>)
        </span>
        <input
          type="text"
          placeholder="Filter roles..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="role-mgr-search-input"
          style={{ width: '200px' }}
        />
      </div>

      <div className="role-mgr-table-wrapper">
        <table className="role-mgr-table">
          <thead>
            <tr>
              <th style={{ minWidth: '240px' }}>Role Name</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Granted</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Admin Option</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No roles found.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.roleName}>
                  <td className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px' }}>👥</span>
                    <span style={{ fontWeight: 600 }}>{item.roleName}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={item.granted}
                      onChange={(e) => onToggleMembership(item.roleName, 'granted', e.target.checked)}
                      style={{ width: '15px', height: '15px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={item.adminOption}
                      disabled={!item.granted}
                      onChange={(e) => onToggleMembership(item.roleName, 'adminOption', e.target.checked)}
                      style={{
                        width: '15px',
                        height: '15px',
                        accentColor: 'var(--accent)',
                        opacity: item.granted ? 1 : 0.35,
                        cursor: item.granted ? 'pointer' : 'not-allowed',
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
