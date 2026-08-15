// packages/desktop/src/renderer/src/components/RoleManager/RoleEditorTabs/PrivilegesTab.tsx
import { useState, type JSX } from 'react';
import { PrivilegeMatrix } from './PrivilegeMatrix';
import type { PgPrivilege, PrivilegeAction } from '../types';

interface PrivilegesTabProps {
  databaseList: string[];
  selectedDatabase: string;
  onSelectDatabase: (db: string) => void;
  privileges: PgPrivilege[];
  onAddPrivilege: (newPriv: PgPrivilege) => void;
  onDeletePrivilege: (id: string) => void;
  onTogglePermission: (id: string, action: PrivilegeAction, nextValue: boolean) => void;
  onToggleAllForRow: (id: string, nextValue: boolean) => void;
}

export function PrivilegesTab({
  databaseList,
  selectedDatabase,
  onSelectDatabase,
  privileges,
  onAddPrivilege,
  onDeletePrivilege,
  onTogglePermission,
  onToggleAllForRow,
}: PrivilegesTabProps): JSX.Element {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const handleAddDefault = (): void => {
    const newId = `priv_${Date.now()}`;
    const newPriv: PgPrivilege = {
      id: newId,
      targetType: 'SCHEMA',
      database: selectedDatabase,
      schema: 'public',
      objectName: 'public',
      permissions: {
        CONNECT: false,
        CREATE: false,
        DELETE: false,
        EXECUTE: false,
        INSERT: false,
        REFERENCES: false,
        SELECT: true,
        TEMPORARY: false,
        TRIGGER: false,
        TRUNCATE: false,
        UPDATE: false,
        USAGE: true,
      },
    };
    onAddPrivilege(newPriv);
    setSelectedRowId(newId);
  };

  const handleDelete = (): void => {
    if (selectedRowId) {
      onDeletePrivilege(selectedRowId);
      setSelectedRowId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Top Action Toolbar */}
      <div className="role-mgr-toolbar">
        <div className="role-mgr-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Database:</span>
            <select
              value={selectedDatabase}
              onChange={(e) => onSelectDatabase(e.target.value)}
              className="cb-select font-mono"
              style={{ padding: '3px 8px', fontSize: '12px' }}
            >
              {databaseList.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          </div>

          <div className="role-mgr-divider" />

          <button
            type="button"
            onClick={handleAddDefault}
            className="role-mgr-btn"
            title="Add Privilege for Schema/Table"
          >
            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>＋</span>
            <span>Add Privilege</span>
          </button>

          <button
            type="button"
            disabled={!selectedRowId}
            onClick={handleDelete}
            className="role-mgr-btn role-mgr-btn-danger"
            title="Delete Selected Privilege"
          >
            <span style={{ color: 'var(--error)', fontWeight: 'bold' }}>－</span>
            <span>Delete Privilege</span>
          </button>
        </div>
      </div>

      {/* Checkbox Matrix Grid */}
      <PrivilegeMatrix
        privileges={privileges.filter((p) => p.database === selectedDatabase)}
        selectedPrivilegeId={selectedRowId}
        onSelectRow={setSelectedRowId}
        onTogglePermission={onTogglePermission}
        onToggleAllForRow={onToggleAllForRow}
      />
    </div>
  );
}
