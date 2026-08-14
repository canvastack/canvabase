import { useState, useEffect, type FormEvent, type JSX } from 'react';
import type { AppStore } from '../store';
import type { ConnectionSummary } from '@canvabase/contracts';

interface ConnectionModalProps {
  store: AppStore;
  isOpen: boolean;
  editConnection?: ConnectionSummary | null;
  onClose: () => void;
}

export function ConnectionModal({
  store,
  isOpen,
  editConnection,
  onClose,
}: ConnectionModalProps): JSX.Element | null {
  const createConnection = store((s) => s.createConnection);
  const updateConnection = store((s) => s.updateConnection);
  const testConnection = store((s) => s.testConnection);

  const [tab, setTab] = useState<'general' | 'ssl' | 'ssh'>('general');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    engine: 'mysql' as 'mysql' | 'postgresql' | 'sqlite',
    host: 'localhost',
    port: '3306',
    database: '',
    username: 'root',
    password: '',
    ssl: 'disabled' as 'disabled' | 'required' | 'verify',
  });

  useEffect(() => {
    if (editConnection) {
      const defaultUser = editConnection.username || (editConnection.engine === 'postgresql' ? 'postgres' : 'root');
      setForm({
        name: editConnection.name,
        engine: editConnection.engine,
        host: editConnection.host || 'localhost',
        port: String(editConnection.port || (editConnection.engine === 'postgresql' ? 5432 : 3306)),
        database: editConnection.database || '',
        username: defaultUser,
        password: '',
        ssl: 'disabled',
      });
    } else {
      setForm({
        name: '',
        engine: 'mysql',
        host: 'localhost',
        port: '3306',
        database: '',
        username: 'root',
        password: '',
        ssl: 'disabled',
      });
    }
    setTestResult(null);
  }, [editConnection, isOpen]);

  if (!isOpen) return null;

  const onEngineChange = (engine: 'mysql' | 'postgresql' | 'sqlite') => {
    const defaultPorts = { mysql: '3306', postgresql: '5432', sqlite: '' };
    const defaultUsers = { mysql: 'root', postgresql: 'postgres', sqlite: '' };
    setForm((f) => ({ ...f, engine, port: defaultPorts[engine], username: defaultUsers[engine] }));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    // SSH tunnel belum diimplementasikan (v1.1) — selalu kirim sshEnabled=false
    const res = await testConnection({
      name: form.name || 'Test',
      engine: form.engine,
      host: form.host,
      port: Number(form.port) || 0,
      database: form.database,
      username: form.username,
      password: form.password,
      ssl: form.ssl,
    });
    setTesting(false);
    if (res.ok) {
      setTestResult({ ok: true, message: `Connection Successful! (${res.latencyMs ?? 10}ms)` });
    } else {
      setTestResult({ ok: false, message: res.error || 'Failed to connect to database server.' });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    let success = false;
    // SSH tunnel belum diimplementasikan (v1.1) — force false agar tidak ada
    // state "SSH aktif tapi tidak berfungsi".
    if (editConnection) {
      success = await updateConnection(editConnection.id, {
        name: form.name,
        engine: form.engine,
        host: form.host,
        port: Number(form.port) || 0,
        database: form.database,
        username: form.username,
        ...(form.password ? { password: form.password } : {}),
      });
    } else {
      success = await createConnection({
        name: form.name,
        engine: form.engine,
        host: form.host,
        port: Number(form.port) || 0,
        database: form.database,
        username: form.username,
        password: form.password,
      });
    }
    setSaving(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="cb-modal-overlay" onClick={onClose}>
      <div className="cb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cb-modal-header">
          <div className="cb-modal-title">
            {editConnection ? '✏️ Edit Connection' : '🔌 New Connection'}
          </div>
          <button className="cb-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cb-modal-tabs">
          <button
            className={`cb-modal-tab ${tab === 'general' ? 'active' : ''}`}
            onClick={() => setTab('general')}
          >
            ⚙️ General
          </button>
          <button
            className={`cb-modal-tab ${tab === 'ssl' ? 'active' : ''}`}
            onClick={() => setTab('ssl')}
          >
            🔒 SSL / TLS
          </button>
          <button
            type="button"
            className="cb-modal-tab"
            disabled
            title="SSH tunneling will be available in v1.1"
            style={{ opacity: 0.5, cursor: 'not-allowed' }}
          >
            🔐 SSH Tunnel <span className="cb-badge">v1.1</span>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="cb-modal-body">
            {tab === 'general' && (
              <div className="cb-form-grid">
                <div className="cb-form-group">
                  <label className="cb-label">Connection Name *</label>
                  <input
                    className="cb-input"
                    placeholder="e.g. Local MySQL Main"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="cb-form-group">
                  <label className="cb-label">Database Engine</label>
                  <select
                    className="cb-select"
                    value={form.engine}
                    onChange={(e) => onEngineChange(e.target.value as 'mysql' | 'postgresql' | 'sqlite')}
                  >
                    <option value="mysql">MySQL / MariaDB</option>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="sqlite">SQLite</option>
                  </select>
                </div>

                {form.engine !== 'sqlite' ? (
                  <>
                    <div className="cb-form-row">
                      <div className="cb-form-group flex-1">
                        <label className="cb-label">Host / IP Address</label>
                        <input
                          className="cb-input"
                          placeholder="localhost"
                          value={form.host}
                          onChange={(e) => setForm({ ...form, host: e.target.value })}
                        />
                      </div>
                      <div className="cb-form-group w-32">
                        <label className="cb-label">Port</label>
                        <input
                          className="cb-input"
                          placeholder="3306"
                          value={form.port}
                          onChange={(e) => setForm({ ...form, port: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="cb-form-group">
                      <label className="cb-label">Database Name</label>
                      <input
                        className="cb-input"
                        placeholder="e.g. my_database"
                        value={form.database}
                        onChange={(e) => setForm({ ...form, database: e.target.value })}
                      />
                    </div>

                    <div className="cb-form-row">
                      <div className="cb-form-group flex-1">
                        <label className="cb-label">Username</label>
                        <input
                          className="cb-input"
                          placeholder="root"
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: e.target.value })}
                        />
                      </div>
                      <div className="cb-form-group flex-1">
                        <label className="cb-label">Password</label>
                        <input
                          className="cb-input"
                          type="password"
                          placeholder={editConnection ? '(Unchanged)' : 'Password'}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="cb-form-group">
                    <label className="cb-label">Database File Path</label>
                    <input
                      className="cb-input"
                      placeholder="C:/path/to/database.db or :memory:"
                      value={form.database}
                      onChange={(e) => setForm({ ...form, database: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {tab === 'ssl' && (
              <div className="cb-form-grid">
                <div className="cb-form-group">
                  <label className="cb-label">SSL Mode</label>
                  <select
                    className="cb-select"
                    value={form.ssl}
                    onChange={(e) => setForm({ ...form, ssl: e.target.value as 'disabled' | 'required' | 'verify' })}
                  >
                    <option value="disabled">Disabled</option>
                    <option value="required">Required (Encrypted)</option>
                    <option value="verify">Verify Certificate</option>
                  </select>
                </div>
              </div>
            )}

            {tab === 'ssh' && (
              <div className="cb-form-grid">
                <p className="cb-muted">
                  🔐 SSH tunneling will be available in <strong>v1.1</strong>. This form is currently disabled.
                </p>
              </div>
            )}

            {testResult && (
              <div className={`cb-alert ${testResult.ok ? 'cb-alert-success' : 'cb-alert-error'}`}>
                {testResult.message}
              </div>
            )}
          </div>

          <div className="cb-modal-footer">
            <button
              type="button"
              className="cb-button"
              onClick={() => void handleTest()}
              disabled={testing}
            >
              {testing ? 'Testing…' : '⚡ Test Connection'}
            </button>

            <div className="flex-spacer" />

            <button type="button" className="cb-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cb-button cb-button-primary" disabled={saving}>
              {saving ? 'Saving…' : editConnection ? 'Update Connection' : 'Save & Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
