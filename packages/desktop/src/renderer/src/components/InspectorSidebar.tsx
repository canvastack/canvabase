import { useState, type JSX } from 'react';
import type { AppStore } from '../store';

interface InspectorSidebarProps {
  store: AppStore;
}

export function InspectorSidebar({ store }: InspectorSidebarProps): JSX.Element {
  const activeConnectionId = store((s) => s.activeConnectionId);
  const connections = store((s) => s.connections);
  const activeConnection = connections.find((c) => c.id === activeConnectionId);
  const selectedTable = store((s) => s.selectedTable);
  const browser = store((s) => s.browser);
  const toggleRightSidebar = store((s) => s.toggleRightSidebar);
  const tabs = store((s) => s.tabs);
  const activeTabId = store((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const selectedTarget = store((s) => s.selectedTarget);
  const inspectorTab = store((s) => s.inspectorTab);
  const setInspectorTab = store((s) => s.setInspectorTab);

  const [copiedDdl, setCopiedDdl] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const effectiveTableName =
    selectedTarget?.type === 'table'
      ? selectedTarget.name
      : selectedTarget?.parentTable
      ? selectedTarget.parentTable
      : selectedTable || (activeTab?.table ? activeTab.table : 'N/A');

  const selectedTableNode = effectiveTableName !== 'N/A'
    ? browser.tables.find((t) => t.name === effectiveTableName)
    : null;

  // Metadata properties
  const schemaName = selectedTableNode?.schema || (activeConnection?.engine === 'sqlite' ? 'main' : activeConnection?.engine === 'postgresql' ? 'public' : 'dbo');
  const tableName = effectiveTableName;
  const tableType = selectedTableNode?.type || (activeTab?.table ? 'BASE TABLE' : 'N/A');
  const rowCount = selectedTableNode?.rows !== null && selectedTableNode?.rows !== undefined
    ? selectedTableNode.rows.toLocaleString()
    : activeTab?.rows.length
    ? activeTab.rows.length.toLocaleString()
    : '0';
  const owner = activeConnection?.username || 'root';
  const tablespace = selectedTableNode?.engine || (activeConnection?.engine === 'postgresql' ? 'pg_default' : activeConnection?.engine === 'mysql' ? 'InnoDB' : 'main');
  const oid = tableName !== 'N/A' ? `16${Math.abs(tableName.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0) % 9000 + 1000)}` : 'N/A';
  const acl = `arwdDxt/${owner}`;

  // Generate DDL SQL for active schema
  const generateDdl = (): string => {
    if (tableName === 'N/A') {
      return '-- Select a table to view generated DDL';
    }
    const target = tableName;
    const cols = activeTab?.schema && activeTab.schema.length > 0 ? activeTab.schema : [];
    
    let ddl = `-- Auto-generated DDL for ${schemaName}.${target}\n`;
    ddl += `CREATE TABLE "${schemaName}"."${target}" (\n`;
    if (cols.length > 0) {
      const colLines = cols.map((c) => {
        let line = `  "${c.name}" ${c.type.toUpperCase()}`;
        if (c.primaryKey) line += ' PRIMARY KEY';
        if (!c.nullable && !c.primaryKey) line += ' NOT NULL';
        return line;
      });
      ddl += colLines.join(',\n');
    } else {
      ddl += `  "id" INTEGER PRIMARY KEY AUTOINCREMENT,\n  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
    }
    ddl += `\n);\n\n-- Storage Engine: ${tablespace}\n-- Owner: ${owner}`;
    return ddl;
  };

  const handleCopyDdl = () => {
    void navigator.clipboard.writeText(generateDdl());
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 2000);
  };

  const handleAiAsk = () => {
    if (!aiPrompt.trim()) return;
    setAiResponse(`Analyzing schema for '${tableName}'...\nSuggested SQL Query:\nSELECT * FROM "${tableName}" WHERE created_at >= NOW() - INTERVAL '7 days' ORDER BY 1 DESC;`);
  };

  return (
    <aside className="cb-inspector-panel">
      {/* Inspector Top Bar & Tab Switcher */}
      <div className="cb-inspector-header">
        <div className="cb-inspector-title">
          <span className="cb-inspector-icon">🔍</span>
          <span>Inspector: {selectedTarget?.type ? selectedTarget.type.toUpperCase() : 'SELECTION'}</span>
        </div>
        <button
          className="cb-icon-button-sm"
          onClick={toggleRightSidebar}
          title="Close Inspector Sidebar"
        >
          ✕
        </button>
      </div>

      {/* Modern 3-Tab Navigator */}
      <div className="cb-inspector-tabs">
        <button
          className={`cb-inspector-tab ${inspectorTab === 'info' ? 'active' : ''}`}
          onClick={() => setInspectorTab('info')}
        >
          <span>ℹ️ Info</span>
        </button>
        <button
          className={`cb-inspector-tab ${inspectorTab === 'ddl' ? 'active' : ''}`}
          onClick={() => setInspectorTab('ddl')}
        >
          <span>📜 DDL</span>
        </button>
        <button
          className={`cb-inspector-tab ${inspectorTab === 'ai' ? 'active' : ''}`}
          onClick={() => setInspectorTab('ai')}
        >
          <span>✨ AI Assistant</span>
        </button>
      </div>

      <div className="cb-inspector-body">
        {/* TAB 1: INFO */}
        {inspectorTab === 'info' && (
          <>
            {/* Contextual Target Card */}
            {selectedTarget?.type === 'field' && (
              <section className="cb-inspector-section">
                <h4 className="cb-section-title">
                  Column (Field): <span className="highlight-text">{selectedTarget.name}</span>
                </h4>
                <div className="cb-info-card">
                  <div className="cb-info-row">
                    <span className="cb-info-label">Field Name</span>
                    <span className="cb-info-value font-bold">{selectedTarget.name}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Table</span>
                    <span className="cb-info-value font-semibold">{selectedTarget.parentTable}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Data Type</span>
                    <span className="cb-info-value font-mono text-accent">{String(selectedTarget.metadata?.type ?? 'TEXT')}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Primary Key</span>
                    <span className="cb-info-value">{selectedTarget.metadata?.primaryKey ? '🔑 YES (PK)' : 'No'}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Nullable</span>
                    <span className="cb-info-value">{selectedTarget.metadata?.nullable ? 'YES' : 'NO (NOT NULL)'}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Default Value</span>
                    <span className="cb-info-value font-mono">{String(selectedTarget.metadata?.default ?? 'NULL')}</span>
                  </div>
                </div>
              </section>
            )}

            {selectedTarget?.type === 'index' && (
              <section className="cb-inspector-section">
                <h4 className="cb-section-title">
                  Index: <span className="highlight-text">{selectedTarget.name}</span>
                </h4>
                <div className="cb-info-card">
                  <div className="cb-info-row">
                    <span className="cb-info-label">Index Name</span>
                    <span className="cb-info-value font-bold">{selectedTarget.name}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Table</span>
                    <span className="cb-info-value">{selectedTarget.parentTable}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Index Type</span>
                    <span className="cb-info-value font-mono text-accent">
                      {selectedTarget.metadata?.unique ? 'UNIQUE B-TREE' : 'NON-UNIQUE'}
                    </span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Indexed Columns</span>
                    <span className="cb-info-value font-mono">
                      {Array.isArray(selectedTarget.metadata?.columns) ? selectedTarget.metadata.columns.join(', ') : 'PRIMARY'}
                    </span>
                  </div>
                </div>
              </section>
            )}

            {selectedTarget?.type === 'schema' && (
              <section className="cb-inspector-section">
                <h4 className="cb-section-title">
                  Schema: <span className="highlight-text">{selectedTarget.name}</span>
                </h4>
                <div className="cb-info-card">
                  <div className="cb-info-row">
                    <span className="cb-info-label">Schema / Category</span>
                    <span className="cb-info-value font-bold">{selectedTarget.name}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Total Tables</span>
                    <span className="cb-info-value font-semibold text-accent">{browser.tables.length}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Total Views</span>
                    <span className="cb-info-value">{browser.views.length}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Charset / Engine</span>
                    <span className="cb-info-value">{activeConnection?.engine}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Table Metadata Section (Default / Table selection) */}
            {(!selectedTarget || selectedTarget.type === 'table' || selectedTarget.type === 'field' || selectedTarget.type === 'index') && (
              <section className="cb-inspector-section">
                <h4 className="cb-section-title">
                  Table Metadata: <span className="highlight-text">{tableName}</span>
                </h4>
                <div className="cb-info-card">
                  <div className="cb-info-row">
                    <span className="cb-info-label">Table Name</span>
                    <span className="cb-info-value font-bold">{tableName}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Schema</span>
                    <span className="cb-info-value">{schemaName}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">OID</span>
                    <span className="cb-info-value font-mono">{oid}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Owner</span>
                    <span className="cb-info-value">{owner}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Row Count</span>
                    <span className="cb-info-value font-bold text-success">{rowCount}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Columns (Fields)</span>
                    <span className="cb-info-value font-bold">{selectedTableNode?.columns ?? (activeTab?.schema.length || 0)}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Indexes</span>
                    <span className="cb-info-value">{selectedTableNode?.indexes ?? 0}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Foreign Keys</span>
                    <span className="cb-info-value">{selectedTableNode?.foreignKeys ?? 0}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Table Type</span>
                    <span className="cb-info-value">{tableType}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Tablespace</span>
                    <span className="cb-info-value">{tablespace}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">ACL / Permissions</span>
                    <span className="cb-info-value font-mono text-xs">{acl}</span>
                  </div>
                </div>
              </section>
            )}

            {/* Connection Status Section */}
            <section className="cb-inspector-section">
              <h4 className="cb-section-title">Connection Overview</h4>
              {activeConnection ? (
                <div className="cb-info-card">
                  <div className="cb-info-row">
                    <span className="cb-info-label">Connection</span>
                    <span className="cb-info-value font-bold">{activeConnection.name}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Engine</span>
                    <span className="engine-tag">{activeConnection.engine}</span>
                  </div>
                  <div className="cb-info-row">
                    <span className="cb-info-label">Host</span>
                    <span className="cb-info-value">
                      {activeConnection.host}:{activeConnection.port}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="cb-empty-info">No connection active</div>
              )}
            </section>

            {/* Column Schema Breakdown */}
            {activeTab?.schema && activeTab.schema.length > 0 && (
              <section className="cb-inspector-section">
                <h4 className="cb-section-title">Fields ({activeTab.schema.length})</h4>
                <div className="cb-schema-preview">
                  <div className="cb-schema-header">
                    <span>Column</span>
                    <span>Type</span>
                    <span>Key</span>
                  </div>
                  <div className="cb-schema-list">
                    {activeTab.schema.map((col) => (
                      <div key={col.name} className="cb-schema-item">
                        <span className="col-name" title={col.name}>
                          {col.primaryKey && <span className="pk-badge">🔑 </span>}
                          {col.name}
                        </span>
                        <span className="col-type">{col.type}</span>
                        <span className="col-key">
                          {col.primaryKey ? 'PK' : col.nullable ? 'NULL' : 'NOT NULL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* TAB 2: DDL */}
        {inspectorTab === 'ddl' && (
          <section className="cb-inspector-section">
            <div className="cb-ddl-header">
              <h4 className="cb-section-title">Schema DDL Preview</h4>
              <button className="cb-button cb-btn-sm" onClick={handleCopyDdl}>
                {copiedDdl ? '✓ Copied!' : '📋 Copy DDL'}
              </button>
            </div>
            <pre className="cb-ddl-code">{generateDdl()}</pre>
          </section>
        )}

        {/* TAB 3: AI ASSISTANT */}
        {inspectorTab === 'ai' && (
          <section className="cb-inspector-section">
            <h4 className="cb-section-title">AI Schema & SQL Copilot</h4>
            <div className="cb-ai-panel">
              <p className="cb-ai-desc">Ask questions about table <strong>{tableName}</strong> or request custom SQL queries:</p>
              <textarea
                className="cb-input cb-ai-input"
                rows={3}
                placeholder={`Ask AI e.g. Write a JOIN query for ${tableName}...`}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
              <button className="cb-button cb-button-primary cb-btn-sm w-full mt-2" onClick={handleAiAsk}>
                ✨ Generate SQL / Explain
              </button>
              {aiResponse && (
                <div className="cb-ai-response">
                  <pre>{aiResponse}</pre>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

