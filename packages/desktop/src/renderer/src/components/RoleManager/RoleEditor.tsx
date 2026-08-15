// packages/desktop/src/renderer/src/components/RoleManager/RoleEditor.tsx
import { useState, type JSX } from 'react';
import { GeneralTab } from './RoleEditorTabs/GeneralTab';
import { MemberOfTab } from './RoleEditorTabs/MemberOfTab';
import { PrivilegesTab } from './RoleEditorTabs/PrivilegesTab';
import { DefaultPrivilegesTab } from './RoleEditorTabs/DefaultPrivilegesTab';
import { ParametersTab } from './RoleEditorTabs/ParametersTab';
import { SqlPreviewTab } from './RoleEditorTabs/SqlPreviewTab';
import { analyzeRoleSecurity, applyRbacPreset } from './sqlGenerator';
import type {
  PgRoleFormData,
  PrivilegeAction,
  RoleEditorTabId,
  PgPrivilege,
  PgDefaultPrivilege,
  PgRoleParameter,
  RbacPresetId,
} from './types';

interface RoleEditorProps {
  initialData: PgRoleFormData;
  databaseList: string[];
  onSave: (data: PgRoleFormData) => void;
  onCancel: () => void;
}

export function RoleEditor({
  initialData,
  databaseList,
  onSave,
  onCancel,
}: RoleEditorProps): JSX.Element {
  const [formData, setFormData] = useState<PgRoleFormData>(initialData);
  const [activeTab, setActiveTab] = useState<RoleEditorTabId>('general');

  const securityWarnings = analyzeRoleSecurity(formData);

  const updateField = <K extends keyof PgRoleFormData>(field: K, value: PgRoleFormData[K]): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleApplyPreset = (presetId: RbacPresetId): void => {
    setFormData((prev) => applyRbacPreset(prev, presetId));
  };

  const handleToggleMembership = (roleName: string, field: 'granted' | 'adminOption', value: boolean): void => {
    setFormData((prev) => ({
      ...prev,
      memberships: prev.memberships.map((m) =>
        m.roleName === roleName ? { ...m, [field]: value } : m
      ),
    }));
  };

  const handleAddPrivilege = (newPriv: PgPrivilege): void => {
    setFormData((prev) => ({
      ...prev,
      privileges: [...prev.privileges, newPriv],
    }));
  };

  const handleDeletePrivilege = (id: string): void => {
    setFormData((prev) => ({
      ...prev,
      privileges: prev.privileges.filter((p) => p.id !== id),
    }));
  };

  const handleTogglePermission = (id: string, action: PrivilegeAction, nextValue: boolean): void => {
    setFormData((prev) => ({
      ...prev,
      privileges: prev.privileges.map((p) =>
        p.id === id
          ? { ...p, permissions: { ...p.permissions, [action]: nextValue } }
          : p
      ),
    }));
  };

  const handleToggleAllForRow = (id: string, nextValue: boolean): void => {
    setFormData((prev) => ({
      ...prev,
      privileges: prev.privileges.map((p) => {
        if (p.id !== id) return p;
        const updatedPermissions = { ...p.permissions };
        (Object.keys(updatedPermissions) as PrivilegeAction[]).forEach((act) => {
          updatedPermissions[act] = nextValue;
        });
        return { ...p, permissions: updatedPermissions };
      }),
    }));
  };

  // Default Privileges handlers
  const handleAddDefaultPriv = (newDef: PgDefaultPrivilege): void => {
    setFormData((prev) => ({
      ...prev,
      defaultPrivileges: [...prev.defaultPrivileges, newDef],
    }));
  };

  const handleDeleteDefaultPriv = (id: string): void => {
    setFormData((prev) => ({
      ...prev,
      defaultPrivileges: prev.defaultPrivileges.filter((dp) => dp.id !== id),
    }));
  };

  const handleToggleDefaultPerm = (id: string, action: PrivilegeAction, nextValue: boolean): void => {
    setFormData((prev) => ({
      ...prev,
      defaultPrivileges: prev.defaultPrivileges.map((dp) =>
        dp.id === id
          ? { ...dp, permissions: { ...dp.permissions, [action]: nextValue } }
          : dp
      ),
    }));
  };

  // Parameters handlers
  const handleAddParam = (param: PgRoleParameter): void => {
    setFormData((prev) => ({
      ...prev,
      parameters: [...prev.parameters, param],
    }));
  };

  const handleUpdateParam = (id: string, name: string, value: string): void => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters.map((p) =>
        p.id === id ? { ...p, name, value } : p
      ),
    }));
  };

  const handleDeleteParam = (id: string): void => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((p) => p.id !== id),
    }));
  };

  return (
    <div className="role-mgr-container">
      {/* Top Action Toolbar */}
      <div className="role-mgr-toolbar">
        <div className="role-mgr-actions">
          <button
            type="button"
            onClick={() => onSave(formData)}
            className="role-mgr-btn role-mgr-btn-primary"
            title="Save Role Changes"
          >
            <span>💾</span>
            <span>Save</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="role-mgr-btn"
          >
            Cancel
          </button>

          <div className="role-mgr-divider" />

          {/* 1-Click RBAC Template Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Template:</span>
            <select
              className="cb-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  handleApplyPreset(e.target.value as RbacPresetId);
                  e.target.value = '';
                }
              }}
              style={{ padding: '3px 8px', fontSize: '11px' }}
            >
              <option value="" disabled>⚡ Apply Preset...</option>
              <option value="read_only">🔍 Read-Only Analyst</option>
              <option value="app_service">⚙️ Application Service</option>
              <option value="data_engineer">🛠️ Data Engineer / DDL</option>
              <option value="minimal_login">👤 Minimal Login User</option>
            </select>
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
          {formData.isNew ? 'New Role Definition' : `Editing: ${formData.initialRoleName ?? ''}`}
        </div>
      </div>

      {/* Security Advisor Alert Banner */}
      {securityWarnings.length > 0 && (
        <div
          style={{
            padding: '6px 12px',
            background: securityWarnings.some((w) => w.level === 'critical')
              ? 'rgba(239, 68, 68, 0.12)'
              : 'rgba(245, 158, 11, 0.12)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
          }}
        >
          <span style={{ fontSize: '13px' }}>
            {securityWarnings.some((w) => w.level === 'critical') ? '🚨' : '⚠️'}
          </span>
          <span style={{ fontWeight: 600, color: securityWarnings.some((w) => w.level === 'critical') ? 'var(--error)' : 'var(--accent)' }}>
            Security Advisor ({securityWarnings.length}):
          </span>
          <span style={{ color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {securityWarnings[0]?.message}
          </span>
        </div>
      )}

      {/* Tabs Header Bar */}
      <div className="role-editor-tabs-bar">
        {[
          { id: 'general', label: 'General' },
          { id: 'member_of', label: 'Member Of' },
          { id: 'privileges', label: 'Privileges' },
          {
            id: 'default_privileges',
            label: `Default Privileges ${formData.defaultPrivileges.length > 0 ? `(${formData.defaultPrivileges.length})` : ''}`,
          },
          {
            id: 'parameters',
            label: `Parameters ${formData.parameters.length > 0 ? `(${formData.parameters.length})` : ''}`,
          },
          { id: 'sql_preview', label: 'SQL Preview' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as RoleEditorTabId)}
              className={`role-editor-tab-btn ${isActive ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div
        className="role-editor-body"
        style={{
          padding:
            activeTab === 'general' ? '16px' : '0',
        }}
      >
        {activeTab === 'general' && <GeneralTab formData={formData} onChange={updateField} />}
        {activeTab === 'member_of' && (
          <MemberOfTab memberships={formData.memberships} onToggleMembership={handleToggleMembership} />
        )}
        {activeTab === 'privileges' && (
          <PrivilegesTab
            databaseList={databaseList}
            selectedDatabase={formData.selectedDatabase}
            onSelectDatabase={(db) => updateField('selectedDatabase', db)}
            privileges={formData.privileges}
            onAddPrivilege={handleAddPrivilege}
            onDeletePrivilege={handleDeletePrivilege}
            onTogglePermission={handleTogglePermission}
            onToggleAllForRow={handleToggleAllForRow}
          />
        )}
        {activeTab === 'default_privileges' && (
          <DefaultPrivilegesTab
            defaultPrivileges={formData.defaultPrivileges}
            onAddDefaultPrivilege={handleAddDefaultPriv}
            onDeleteDefaultPrivilege={handleDeleteDefaultPriv}
            onTogglePermission={handleToggleDefaultPerm}
          />
        )}
        {activeTab === 'parameters' && (
          <ParametersTab
            parameters={formData.parameters}
            onAddParameter={handleAddParam}
            onUpdateParameter={handleUpdateParam}
            onDeleteParameter={handleDeleteParam}
          />
        )}
        {activeTab === 'sql_preview' && <SqlPreviewTab formData={formData} />}
      </div>
    </div>
  );
}
