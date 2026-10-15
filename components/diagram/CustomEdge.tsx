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
  const cardinality = edgeData.cardinality;

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

  // High-contrast, large, clearly-visible markers for ERD relationships
  const crowfootMarkerId = `crowfoot-marker-${id}`;
  const oneMarkerId = `one-marker-${id}`;

  return (
    <>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          {/* Distinct high-visibility Crow's foot marker (Many) */}
          <marker
            id={crowfootMarkerId}
            viewBox="0 0 20 20"
            refX="18"
            refY="10"
            markerWidth="16"
            markerHeight="16"
            orient="auto"
          >
            <path
              d="M 2 2 L 18 10 L 2 18 M 18 2 L 18 18 M 12 4 L 12 16"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </marker>

          {/* Distinct high-visibility Mandatory One marker (1) */}
          <marker
            id={oneMarkerId}
            viewBox="0 0 20 20"
            refX="10"
            refY="10"
            markerWidth="14"
            markerHeight="14"
            orient="auto"
          >
            <path
              d="M 6 2 L 6 18 M 14 2 L 14 18"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </marker>
        </defs>
      </svg>

      <BaseEdge
        id={id}
        path={path}
        style={{
          ...style,
          stroke: selected ? '#06b6d4' : strokeColor,
          strokeWidth: selected ? Number(strokeWidth) + 1.5 : strokeWidth,
          strokeDasharray,
        }}
        markerEnd={
          cardinality === '1:N' || cardinality === 'N:M'
            ? `url(#${crowfootMarkerId})`
            : markerEnd
        }
        markerStart={
          cardinality === '1:N' || cardinality === '1:1'
            ? `url(#${oneMarkerId})`
            : markerStart
        }
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
