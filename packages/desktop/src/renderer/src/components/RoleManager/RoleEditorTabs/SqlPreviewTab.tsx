// packages/desktop/src/renderer/src/components/RoleManager/RoleEditorTabs/SqlPreviewTab.tsx
import { useState, type JSX } from 'react';
import { generateRoleSql } from '../sqlGenerator';
import type { PgRoleFormData } from '../types';

interface SqlPreviewTabProps {
  formData: PgRoleFormData;
}

export function SqlPreviewTab({ formData }: SqlPreviewTabProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const sql = generateRoleSql(formData);

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: 'var(--bg-input)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Generated PostgreSQL Query (Real-time Preview)</span>
        <button
          type="button"
          onClick={handleCopy}
          className="role-mgr-btn"
          style={{ padding: '4px 10px', fontSize: '11px' }}
        >
          {copied ? '✓ Copied' : '📋 Copy SQL'}
        </button>
      </div>
      <div style={{ flex: 1, padding: '14px', overflow: 'auto' }}>
        <pre
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: '1.6',
            color: 'var(--success)',
            whiteSpace: 'pre-wrap',
            userSelect: 'text',
            margin: 0,
          }}
        >
          {sql}
        </pre>
      </div>
    </div>
  );
}
