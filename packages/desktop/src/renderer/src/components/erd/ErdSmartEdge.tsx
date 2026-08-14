import { useState, memo, type JSX } from 'react';
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';

export interface ErdSmartEdgeData extends Record<string, unknown> {
  constraintName?: string;
  sourceTable?: string;
  targetTable?: string;
  columns?: string[];
  relationType?: 'one-many' | 'one-one' | 'many-many';
}

export type ErdSmartEdgeType = Edge<ErdSmartEdgeData, 'smartEdge'>;

export const ErdSmartEdge = memo(function ErdSmartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<ErdSmartEdgeType>): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const constraintName = data?.constraintName || `fk_${id}`;
  const columnsStr = data?.columns && data.columns.length > 0 ? data.columns.join(', ') : 'id';
  const targetTable = data?.targetTable || 'Target Table';
  const relationType = data?.relationType === 'one-one' ? '1 : 1' : data?.relationType === 'many-many' ? 'N : M' : '1 : N';

  const isHighlighted = selected || isHovered;

  return (
    <>
      {/* Invisible wider hit area stroke for easy hover */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        className="erd-edge-hitarea"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Main Visible Relationship Edge Line */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        className={`erd-edge-path ${isHighlighted ? 'highlighted' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Edge Midpoint Label Badge & Floating Hover Tooltip */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="erd-edge-label-container"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Link Icon Badge */}
          <div className={`erd-edge-badge ${isHighlighted ? 'highlighted' : ''}`}>
            🔗
          </div>

          {/* Floating Hover Tooltip */}
          {isHovered && (
            <div className="erd-edge-tooltip">
              <div className="erd-tooltip-header">
                <span className="erd-tooltip-icon">⛓️</span>
                <span className="erd-tooltip-constraint">{constraintName}</span>
                <span className="erd-tooltip-relation-badge">{relationType}</span>
              </div>
              <div className="erd-tooltip-body">
                <span className="erd-tooltip-label">Referencing:</span>
                <span className="erd-tooltip-value">
                  {targetTable} ({columnsStr})
                </span>
              </div>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
