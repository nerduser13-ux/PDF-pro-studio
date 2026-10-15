import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
} from '@xyflow/react';
import { DiagramEdge } from './types';

export interface CustomEdgeData extends Partial<DiagramEdge>, Record<string, unknown> {
  onEdgeClick?: (id: string) => void;
}

export const CustomDiagramEdgeComponent: React.FC<EdgeProps> = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  data,
  selected,
}) => {
  const edgeData = (data || {}) as CustomEdgeData;
  const routing = edgeData.routing || 'orthogonal';
  const label = edgeData.label;
  const strokeColor = edgeData.strokeColor || style.stroke || '#475569';
  const strokeWidth = edgeData.strokeWidth || style.strokeWidth || 2;
  const lineStyle = edgeData.style || 'solid';

  let path = '';
  let labelX = 0;
  let labelY = 0;

  if (routing === 'straight') {
    [path, labelX, labelY] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  } else if (routing === 'curved') {
    [path, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  } else {
    // Orthogonal / step
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    });
  }

  const strokeDasharray = lineStyle === 'dashed' ? '6,4' : lineStyle === 'dotted' ? '2,4' : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          ...style,
          stroke: selected ? '#06b6d4' : strokeColor,
          strokeWidth: selected ? Number(strokeWidth) + 1.5 : strokeWidth,
          strokeDasharray,
        }}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-sm transition-all select-none border ${
                selected
                  ? 'bg-cyan-50 text-cyan-800 border-cyan-400 ring-1 ring-cyan-400'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

CustomDiagramEdgeComponent.displayName = 'CustomDiagramEdgeComponent';
