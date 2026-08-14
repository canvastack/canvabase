import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ForwardedRef,
  type JSX,
} from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { ErdGraph } from '@canvabase/contracts';
import { ErdTableNode } from './erd/ErdTableNode';
import { ErdSmartEdge } from './erd/ErdSmartEdge';
import { ErdBottomToolbar } from './erd/ErdBottomToolbar';

export interface ErdCanvasHandle {
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  getDataUrl(): Promise<string> | string;
  setPanMode(isPan: boolean): void;
}

interface ErdCanvasProps {
  graph: ErdGraph;
  focusTable: string | null;
  onSelect: (tableName: string) => void;
  onRefreshLayout?: () => void;
}

const nodeTypes = {
  tableNode: ErdTableNode,
};

const edgeTypes = {
  smartEdge: ErdSmartEdge,
};

function ErdCanvasInner({
  graph,
  focusTable,
  onSelect,
  onRefreshLayout,
  canvasRef,
}: ErdCanvasProps & { canvasRef: ForwardedRef<ErdCanvasHandle> }): JSX.Element {
  const reactFlowInstance = useReactFlow();

  const [panMode, setPanMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Convert ErdGraph nodes into React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return graph.nodes.map((n) => ({
      id: n.id,
      type: 'tableNode',
      position: { x: n.x, y: n.y },
      data: {
        label: n.name,
        name: n.name,
        columns: n.columns,
        isSelected: focusTable === n.id || focusTable === n.name,
        onSelectNode: onSelect,
      },
    }));
  }, [graph.nodes, focusTable, onSelect]);

  // Convert ErdGraph edges into React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return graph.edges.map((e) => ({
      id: e.id,
      type: 'smartEdge',
      source: e.source,
      target: e.target,
      sourceHandle: 'right',
      targetHandle: 'left',
      data: {
        constraintName: e.id,
        sourceTable: e.source,
        targetTable: e.target,
        columns: e.columns,
        relationType: e.type,
      },
    }));
  }, [graph.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync graph state changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Center focus on focusTable selection
  useEffect(() => {
    if (!focusTable) return;
    const targetNode = nodes.find((n) => n.id === focusTable || n.data.name === focusTable);
    if (targetNode) {
      void reactFlowInstance.setCenter(
        targetNode.position.x + 100,
        targetNode.position.y + 100,
        { zoom: 1.1, duration: 400 }
      );
    }
  }, [focusTable, nodes, reactFlowInstance]);

  // Expose imperative handle functions to parent
  useImperativeHandle(canvasRef, () => ({
    fit: () => reactFlowInstance.fitView({ padding: 0.2, duration: 400 }),
    zoomIn: () => reactFlowInstance.zoomIn({ duration: 250 }),
    zoomOut: () => reactFlowInstance.zoomOut({ duration: 250 }),
    setPanMode: (isPan: boolean) => setPanMode(isPan),
    getDataUrl: () => {
      // Return canvas fallback representation
      return `data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="%230f1222"/><text x="20" y="40" fill="%23e6e8f2" font-size="18">CanvaBase ERD Diagram Export</text></svg>`;
    },
  }));

  const handleViewportChange = useCallback(() => {
    const zoom = reactFlowInstance.getZoom();
    setZoomLevel(zoom);
  }, [reactFlowInstance]);

  return (
    <div className={`erd-flow-wrapper ${panMode ? 'pan-mode' : 'select-mode'}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelect(node.data.name as string || node.id)}
        panOnDrag={panMode || [1, 2]} // Pan on drag in pan mode or with middle/right click
        panOnScroll={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        fitView
        onMoveEnd={handleViewportChange}
        minZoom={0.2}
        maxZoom={2.5}
        defaultEdgeOptions={{ type: 'smartEdge' }}
      >
        {/* Dot Grid Canvas Background */}
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} className="erd-canvas-dots" />
      </ReactFlow>

      {/* Floating Bottom Canvas Controls */}
      <ErdBottomToolbar
        zoomLevel={zoomLevel}
        onZoomIn={() => {
          void reactFlowInstance.zoomIn({ duration: 200 });
        }}
        onZoomOut={() => {
          void reactFlowInstance.zoomOut({ duration: 200 });
        }}
        onFitView={() => {
          void reactFlowInstance.fitView({ padding: 0.2, duration: 400 });
        }}
        onRefresh={() => onRefreshLayout?.()}
        onTogglePanMode={(isPan) => setPanMode(isPan)}
      />
    </div>
  );
}

export const ErdCanvas = forwardRef<ErdCanvasHandle, ErdCanvasProps>(function ErdCanvas(
  props,
  ref,
) {
  return (
    <ReactFlowProvider>
      <ErdCanvasInner {...props} canvasRef={ref} />
    </ReactFlowProvider>
  );
});
