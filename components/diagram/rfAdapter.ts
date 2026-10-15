import { Node as RFNode, Edge as RFEdge, MarkerType } from '@xyflow/react';
import { DiagramDocument, DiagramNode, DiagramEdge } from './types';
import { CustomNodeData } from './CustomNode';
import { CustomEdgeData } from './CustomEdge';

/**
 * Converts internal DiagramDocument nodes to React Flow nodes
 */
export function documentNodesToReactFlow(
  nodes: DiagramNode[],
  handlers?: {
    onNodeChange?: (id: string, updates: Partial<DiagramNode>) => void;
    onAddCol?: (id: string) => void;
    onRemoveCol?: (id: string, colIdx: number) => void;
  }
): RFNode<CustomNodeData>[] {
  return nodes.map(n => ({
    id: n.id,
    type: 'custom',
    position: { x: n.x, y: n.y },
    style: {
      width: n.width,
      height: n.height,
    },
    data: {
      ...n,
      ...handlers,
    },
  }));
}

/**
 * Converts internal DiagramDocument edges to React Flow edges
 * Distributes multiple edges connected to the same source or target among handles
 */
export function documentEdgesToReactFlow(edges: DiagramEdge[]): RFEdge<CustomEdgeData>[] {
  // Count how many edges originate from each node and terminate at each node
  const sourceCount = new Map<string, number>();
  const targetCount = new Map<string, number>();
  edges.forEach(e => {
    sourceCount.set(e.from, (sourceCount.get(e.from) || 0) + 1);
    targetCount.set(e.to, (targetCount.get(e.to) || 0) + 1);
  });

  const sourceIndex = new Map<string, number>();
  const targetIndex = new Map<string, number>();

  return edges.map(e => {
    let markerEnd: any = undefined;
    if (e.arrowEnd === 'arrow') {
      markerEnd = {
        type: MarkerType.ArrowClosed,
        color: e.strokeColor || '#475569',
      };
    }

    const sIdx = sourceIndex.get(e.from) || 0;
    sourceIndex.set(e.from, sIdx + 1);
    const sTotal = sourceCount.get(e.from) || 1;

    const tIdx = targetIndex.get(e.to) || 0;
    targetIndex.set(e.to, tIdx + 1);
    const tTotal = targetCount.get(e.to) || 1;

    // Distribute sourceHandle if multiple edges exist
    let sourceHandle: string = e.fromAnchor || 'bottom';
    if (sTotal > 1) {
      if (sTotal === 2) {
        sourceHandle = sIdx === 0 ? 'bottom-left' : 'bottom-right';
      } else {
        const slots = ['bottom-left', 'bottom', 'bottom-right'];
        sourceHandle = slots[sIdx % slots.length];
      }
    }

    // Distribute targetHandle if multiple edges exist
    let targetHandle = e.toAnchor ? `${e.toAnchor}-target` : 'top-target';
    if (tTotal > 1) {
      if (tTotal === 2) {
        targetHandle = tIdx === 0 ? 'top-left-target' : 'top-right-target';
      } else {
        const slots = ['top-left-target', 'top-target', 'top-right-target'];
        targetHandle = slots[tIdx % slots.length];
      }
    }

    return {
      id: e.id,
      source: e.from,
      target: e.to,
      sourceHandle,
      targetHandle,
      type: 'custom',
      data: {
        ...e,
      },
      markerEnd,
    };
  });
}

/**
 * Re-constructs a DiagramDocument from React Flow nodes and edges
 */
export function reactFlowToDocument(
  docBase: DiagramDocument,
  rfNodes: RFNode<CustomNodeData>[],
  rfEdges: RFEdge<CustomEdgeData>[]
): DiagramDocument {
  const nodes: DiagramNode[] = rfNodes.map(n => {
    const data = n.data || ({} as CustomNodeData);
    const width = typeof n.style?.width === 'number' ? n.style.width : (data.width || 160);
    const height = typeof n.style?.height === 'number' ? n.style.height : (data.height || 80);

    return {
      ...data,
      id: n.id,
      type: data.type || 'rectangle',
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      width: Math.round(width),
      height: Math.round(height),
      text: data.text || '',
      fillColor: data.fillColor || '#eff6ff',
      strokeColor: data.strokeColor || '#2563eb',
      strokeWidth: data.strokeWidth ?? 2,
      textColor: data.textColor || '#1e293b',
      fontSize: data.fontSize || 13,
      cornerRadius: data.cornerRadius ?? 8,
    };
  });

  const edges: DiagramEdge[] = rfEdges.map(e => {
    const data = e.data || {};
    const fromAnchor = (e.sourceHandle?.replace('-target', '').replace('-left', '').replace('-right', '') || data.fromAnchor || 'bottom') as any;
    const toAnchor = (e.targetHandle?.replace('-target', '').replace('-left', '').replace('-right', '') || data.toAnchor || 'top') as any;

    return {
      id: e.id,
      from: e.source,
      to: e.target,
      fromAnchor,
      toAnchor,
      label: data.label,
      style: data.style || 'solid',
      routing: data.routing || 'orthogonal',
      strokeColor: data.strokeColor || '#475569',
      strokeWidth: data.strokeWidth || 2,
      arrowEnd: data.arrowEnd || 'arrow',
      cardinality: data.cardinality,
    };
  });

  return {
    ...docBase,
    nodes,
    edges,
    metadata: {
      ...docBase.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}
