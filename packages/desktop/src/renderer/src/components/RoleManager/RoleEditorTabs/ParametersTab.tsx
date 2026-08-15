// packages/desktop/src/renderer/src/components/RoleManager/RoleEditorTabs/ParametersTab.tsx
import { useState, type JSX } from 'react';
import type { PgRoleParameter } from '../types';

interface ParametersTabProps {
  parameters: PgRoleParameter[];
  onAddParameter: (param: PgRoleParameter) => void;
  onUpdateParameter: (id: string, name: string, value: string) => void;
  onDeleteParameter: (id: string) => void;
}

const COMMON_PARAMS = [
  { name: 'statement_timeout', defaultVal: '30s', desc: 'Abort any statement taking more than the specified duration' },
  { name: 'idle_in_transaction_session_timeout', defaultVal: '15s', desc: 'Terminate sessions idling with open transactions' },
  { name: 'search_path', defaultVal: 'app, public', desc: 'Schema search order for unqualified object names' },
  { name: 'work_mem', defaultVal: '64MB', desc: 'Memory budget for complex sorts and hash tables' },
  { name: 'lock_timeout', defaultVal: '10s', desc: 'Max time to wait for acquiring a table lock' },
  { name: 'log_min_duration_statement', defaultVal: '500ms', desc: 'Log slow queries taking longer than threshold' },
];

export function ParametersTab({
  parameters,
  onAddParameter,
  onUpdateParameter,
  onDeleteParameter,
}: ParametersTabProps): JSX.Element {
  const [paramName, setParamName] = useState('');
  const [paramVal, setParamVal] = useState('');

  const handleAdd = (): void => {
    if (!paramName.trim() || !paramVal.trim()) return;
    onAddParameter({
      id: `param_${Date.now()}`,
      name: paramName.trim(),
      value: paramVal.trim(),
    });
    setParamName('');
    setParamVal('');
  };

  const handleSelectPreset = (name: string, defaultVal: string): void => {
    setParamName(name);
    setParamVal(defaultVal);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Top Parameter Add Bar */}
      <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--accent)' }}>ALTER ROLE SET:</strong> Define runtime session defaults and guardrails for this role.
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="text"
              placeholder="Parameter name..."
              value={paramName}
              onChange={(e) => setParamName(e.target.value)}
              className="role-form-input font-mono"
              style={{ width: '180px', padding: '3px 8px', fontSize: '11px' }}
            />
            <span style={{ color: 'var(--text-muted)' }}>=</span>
            <input
              type="text"
              placeholder="Value (e.g. 30s)..."
              value={paramVal}
              onChange={(e) => setParamVal(e.target.value)}
              className="role-form-input font-mono"
              style={{ width: '140px', padding: '3px 8px', fontSize: '11px' }}
            />
            <button
              type="button"
              disabled={!paramName.trim() || !paramVal.trim()}
              onClick={handleAdd}
              className="role-mgr-btn"
              style={{ padding: '3px 10px', fontSize: '11px' }}
            >
              <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>＋</span> Set Parameter
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Quick Presets:</span>
          {COMMON_PARAMS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => handleSelectPreset(p.name, p.defaultVal)}
              className="role-mgr-btn"
              style={{ padding: '2px 6px', fontSize: '10.5px', fontFamily: 'var(--font-mono)' }}
              title={p.desc}
            >
              +{p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Table */}
      <div className="role-mgr-table-wrapper">
        <table className="role-mgr-table">
          <thead>
            <tr>
              <th style={{ width: '260px' }}>Parameter Name</th>
              <th>Configured Value</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {parameters.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No session parameters configured. Use quick presets above to set query timeouts or search paths.
                </td>
              </tr>
            ) : (
              parameters.map((param) => (
                <tr key={param.id}>
                  <td className="font-mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                    {param.name}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => onUpdateParameter(param.id, param.name, e.target.value)}
                      className="role-form-input font-mono"
                      style={{ maxWidth: '300px', padding: '3px 8px', fontSize: '11px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onDeleteParameter(param.id)}
                      className="role-mgr-btn role-mgr-btn-danger"
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                      title="Remove Parameter"
                    >
                      ✕
                    </button>
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
