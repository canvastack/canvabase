import { useState, memo, type JSX } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ErdColumn } from '@canvabase/contracts';

export interface ErdTableNodeData extends Record<string, unknown> {
  label: string;
  name: string;
  columns: ErdColumn[];
  isSelected?: boolean;
  onSelectNode?: (tableName: string) => void;
}

export type ErdTableNodeType = Node<ErdTableNodeData, 'tableNode'>;

const DEFAULT_VISIBLE_COLS = 6;

export const ErdTableNode = memo(function ErdTableNode({
  id,
  data,
  selected,
}: NodeProps<ErdTableNodeType>): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const columns = data.columns || [];
  const hasMore = columns.length > DEFAULT_VISIBLE_COLS;
  const visibleColumns = expanded ? columns : columns.slice(0, DEFAULT_VISIBLE_COLS);
  const hiddenCount = columns.length - DEFAULT_VISIBLE_COLS;

  const isNodeSelected = selected || data.isSelected;

  return (
    <div
      className={`erd-table-node ${isNodeSelected ? 'selected' : ''}`}
      onClick={() => data.onSelectNode?.(data.name || id)}
    >
      {/* React Flow Handles for smart edge routing */}
      <Handle type="target" position={Position.Left} id="left" className="erd-handle" />
      <Handle type="source" position={Position.Right} id="right" className="erd-handle" />
      <Handle type="target" position={Position.Top} id="top" className="erd-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="erd-handle" />

      {/* Node Header */}
      <div className="erd-node-header">
        <div className="erd-node-title-group">
          <span className="erd-node-icon">📋</span>
          <span className="erd-node-name" title={data.name}>
            {data.name}
          </span>
        </div>
        <span className="erd-col-count-badge" title={`${columns.length} total columns`}>
          {columns.length}
        </span>
      </div>

      {/* Node Columns List */}
      <div className="erd-node-body">
        {visibleColumns.map((col) => (
          <div
            key={col.name}
            className={`erd-col-row ${col.primaryKey ? 'is-pk' : ''}`}
            title={`${col.name} (${col.type})${col.primaryKey ? ' - Primary Key' : ''}${col.nullable ? ' (NULLABLE)' : ''}`}
          >
            <span className="erd-col-pk-icon">{col.primaryKey ? '🔑' : '🔹'}</span>
            <span className="erd-col-name">{col.name}</span>
            <span className="erd-col-type">{col.type}</span>
          </div>
        ))}

        {/* Collapsible Toggle for long column lists */}
        {hasMore && (
          <button
            type="button"
            className="erd-node-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            {expanded ? (
              <>🔼 Collapse columns</>
            ) : (
              <>🔽 +{hiddenCount} more columns...</>
            )}
          </button>
        )}
      </div>
    </div>
  );
});
