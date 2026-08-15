// packages/desktop/src/renderer/src/components/RoleManager/RoleEditorTabs/GeneralTab.tsx
import { type JSX } from 'react';
import type { PgRoleFormData, PasswordEncryptionType } from '../types';

interface GeneralTabProps {
  formData: PgRoleFormData;
  onChange: <K extends keyof PgRoleFormData>(field: K, value: PgRoleFormData[K]) => void;
}

export function GeneralTab({ formData, onChange }: GeneralTabProps): JSX.Element {
  return (
    <div style={{ maxWidth: '720px' }}>
      <div className="role-form-grid">
        <label className="role-form-label">Role Name:</label>
        <input
          type="text"
          value={formData.roleName}
          onChange={(e) => onChange('roleName', e.target.value)}
          placeholder="e.g. dms_admin"
          className="role-form-input font-mono"
        />

        <label className="role-form-label">Role ID:</label>
        <input
          type="text"
          readOnly
          disabled
          value={formData.roleId !== undefined ? formData.roleId : '(Auto-generated)'}
          className="role-form-input font-mono"
        />

        <div />
        <div>
          <label className="role-form-checkbox-label">
            <input
              type="checkbox"
              checked={formData.canLogin}
              onChange={(e) => onChange('canLogin', e.target.checked)}
            />
            <span style={{ fontWeight: 600 }}>Can login</span>
          </label>
        </div>

        <label className="role-form-label">Password:</label>
        <input
          type="password"
          value={formData.password ?? ''}
          onChange={(e) => onChange('password', e.target.value)}
          placeholder="••••••••"
          className="role-form-input"
        />

        <label className="role-form-label">Confirm Password:</label>
        <input
          type="password"
          value={formData.confirmPassword ?? ''}
          onChange={(e) => onChange('confirmPassword', e.target.value)}
          placeholder="••••••••"
          className="role-form-input"
        />

        <label className="role-form-label">Password Encryption:</label>
        <select
          value={formData.passwordEncryption}
          onChange={(e) => onChange('passwordEncryption', e.target.value as PasswordEncryptionType)}
          className="role-form-input"
        >
          <option value="SCRAM-SHA-256">SCRAM-SHA-256 (Recommended)</option>
          <option value="MD5">MD5</option>
          <option value="DEFAULT">Default</option>
          <option value="PLAINTEXT">Plaintext</option>
        </select>

        <label className="role-form-label">Connection Limit:</label>
        <input
          type="number"
          value={formData.connectionLimit}
          onChange={(e) => onChange('connectionLimit', parseInt(e.target.value, 10) || -1)}
          className="role-form-input font-mono"
          style={{ width: '120px' }}
        />

        <label className="role-form-label">Expiry Date:</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="date"
            value={formData.expiryDate ?? ''}
            onChange={(e) => onChange('expiryDate', e.target.value || null)}
            className="role-form-input"
            style={{ width: '180px' }}
          />
          {formData.expiryDate && (
            <button
              type="button"
              onClick={() => onChange('expiryDate', null)}
              className="role-mgr-btn"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Clear
            </button>
          )}
        </div>

        <label className="role-form-label">Comment:</label>
        <input
          type="text"
          value={formData.comment ?? ''}
          onChange={(e) => onChange('comment', e.target.value)}
          placeholder="Role description or notes"
          className="role-form-input"
        />
      </div>

      <div className="role-attributes-section">
        <div className="role-attributes-title">PostgreSQL Role Attributes</div>
        <div className="role-attributes-grid">
          <label className="role-form-checkbox-label">
            <input
              type="checkbox"
              checked={formData.isSuperuser}
              onChange={(e) => onChange('isSuperuser', e.target.checked)}
            />
            <span>Superuser</span>
          </label>

          <label className="role-form-checkbox-label">
            <input
              type="checkbox"
              checked={formData.canCreateDb}
              onChange={(e) => onChange('canCreateDb', e.target.checked)}
            />
            <span>Can create databases</span>
          </label>

          <label className="role-form-checkbox-label">
            <input
              type="checkbox"
              checked={formData.canCreateRole}
              onChange={(e) => onChange('canCreateRole', e.target.checked)}
            />
            <span>Can create roles</span>
          </label>

          <label className="role-form-checkbox-label">
            <input
              type="checkbox"
              checked={formData.inherit}
              onChange={(e) => onChange('inherit', e.target.checked)}
            />
            <span>Inherit privileges</span>
          </label>

          <label className="role-form-checkbox-label">
            <input
              type="checkbox"
              checked={formData.canReplicate}
              onChange={(e) => onChange('canReplicate', e.target.checked)}
            />
            <span>Can replicate</span>
          </label>

          <label className="role-form-checkbox-label">
            <input
              type="checkbox"
              checked={formData.bypassRls}
              onChange={(e) => onChange('bypassRls', e.target.checked)}
            />
            <span>Can bypass RLS</span>
          </label>
        </div>
      </div>
    </div>
  );
}
