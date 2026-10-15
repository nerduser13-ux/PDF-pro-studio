import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { DiagramNode } from './types';
import { DiagramIcon } from './DiagramIcon';

export interface CustomNodeData extends DiagramNode, Record<string, unknown> {
  onNodeChange?: (id: string, updates: Partial<DiagramNode>) => void;
  onAddCol?: (id: string) => void;
  onRemoveCol?: (id: string, colIdx: number) => void;
  isEditingText?: boolean;
}

export const CustomDiagramNodeComponent: React.FC<NodeProps> = memo(({ id, data, selected }) => {
  const nodeData = data as unknown as CustomNodeData;
  const {
    type = 'rectangle',
    text = '',
    headerText,
    badgeText,
    iconName,
    fillColor = '#eff6ff',
    strokeColor = '#2563eb',
    strokeWidth = 2,
    strokeDash = 'solid',
    textColor = '#1e293b',
    fontSize = 13,
    fontBold,
    fontItalic,
    fontUnderline,
    fontFamily = 'Inter, sans-serif',
    textAlign = 'center',
    cornerRadius = 8,
    shadow = true,
    fields,
    umlMembers,
    onNodeChange,
    onAddCol,
    onRemoveCol,
  } = nodeData;

  const borderDashClass = strokeDash === 'dashed' ? 'border-dashed' : strokeDash === 'dotted' ? 'border-dotted' : 'border-solid';

  // Render multiple connection Handles per side to allow separate connection points
  const renderHandles = () => (
    <>
      {/* Top handles: 25%, 50%, 75% */}
      <Handle
        type="target"
        position={Position.Top}
        id="top-left-target"
        style={{ top: -6, left: '25%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-left"
        style={{ top: -6, left: '25%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        style={{ top: -6, left: '50%', transform: 'translateX(-50%)' }}
        className="!w-3 !h-3 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        style={{ top: -6, left: '50%', transform: 'translateX(-50%)' }}
        className="!w-3 !h-3 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      <Handle
        type="target"
        position={Position.Top}
        id="top-right-target"
        style={{ top: -6, left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-right"
        style={{ top: -6, left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      {/* Right handles: 35%, 50%, 65% */}
      <Handle
        type="target"
        position={Position.Right}
        id="right-top-target"
        style={{ right: -6, top: '35%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-top"
        style={{ right: -6, top: '35%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        className="!w-3 !h-3 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ right: -6, top: '50%', transform: 'translateY(-50%)' }}
        className="!w-3 !h-3 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      <Handle
        type="target"
        position={Position.Right}
        id="right-bottom-target"
        style={{ right: -6, top: '65%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-bottom"
        style={{ right: -6, top: '65%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      {/* Bottom handles: 25%, 50%, 75% */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-left-target"
        style={{ bottom: -6, left: '25%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-left"
        style={{ bottom: -6, left: '25%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        style={{ bottom: -6, left: '50%', transform: 'translateX(-50%)' }}
        className="!w-3 !h-3 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ bottom: -6, left: '50%', transform: 'translateX(-50%)' }}
        className="!w-3 !h-3 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-right-target"
        style={{ bottom: -6, left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-right"
        style={{ bottom: -6, left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      {/* Left handles: 35%, 50%, 65% */}
      <Handle
        type="target"
        position={Position.Left}
        id="left-top-target"
        style={{ left: -6, top: '35%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-top"
        style={{ left: -6, top: '35%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
        className="!w-3 !h-3 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }}
        className="!w-3 !h-3 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />

      <Handle
        type="target"
        position={Position.Left}
        id="left-bottom-target"
        style={{ left: -6, top: '65%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-bottom"
        style={{ left: -6, top: '65%' }}
        className="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-full opacity-0 group-hover:opacity-100 !z-30 hover:!scale-125 transition-all"
      />
    </>
  );

  // 1. Modern Information Card (PESTEL, SWOT, Gibbs)
  if (type === 'card') {
    return (
      <div className="relative w-full h-full group">
        <NodeResizer
          isVisible={selected}
          minWidth={160}
          minHeight={90}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <div
          style={{
            borderRadius: `${cornerRadius || 16}px`,
            borderColor: strokeColor,
            borderWidth: `${strokeWidth}px`,
            backgroundColor: '#ffffff',
          }}
          className={`w-full h-full border flex flex-col overflow-hidden ${borderDashClass} ${
            shadow ? 'shadow-md hover:shadow-lg' : ''
          } ${selected ? 'ring-2 ring-cyan-500' : ''}`}
        >
          {/* Header Bar */}
          <div
            style={{ backgroundColor: fillColor }}
            className="px-3.5 py-2 flex items-center justify-between text-white shrink-0"
          >
            <div className="flex items-center gap-2 truncate">
              {iconName && <DiagramIcon name={iconName} size={15} className="text-white shrink-0" />}
              <span className="font-black text-xs uppercase tracking-wider truncate">
                {headerText || 'CARD'}
              </span>
            </div>
            {badgeText && (
              <span
                className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-black text-[10px] shrink-0"
                style={{ color: fillColor }}
              >
                {badgeText}
              </span>
            )}
          </div>
          {/* Body */}
          <div
            className="p-3.5 flex-1 overflow-auto custom-scrollbar flex flex-col justify-start"
            style={{
              fontFamily,
              color: textColor,
              fontSize: `${fontSize}px`,
              fontWeight: fontBold ? 700 : 500,
              fontStyle: fontItalic ? 'italic' : 'normal',
              textDecoration: fontUnderline ? 'underline' : 'none',
              textAlign,
            }}
          >
            <span className="whitespace-pre-line leading-relaxed nodrag select-text">
              {text}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. ER Database Table
  if (type === 'er-table') {
    return (
      <div className="relative w-full h-full group">
        <NodeResizer
          isVisible={selected}
          minWidth={180}
          minHeight={100}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <div
          style={{
            borderRadius: `${cornerRadius || 8}px`,
            borderColor: strokeColor,
            borderWidth: `${strokeWidth}px`,
          }}
          className={`bg-white border flex flex-col overflow-hidden w-full h-full ${borderDashClass} ${
            shadow ? 'shadow-md hover:shadow-lg' : ''
          } ${selected ? 'ring-2 ring-cyan-500' : ''}`}
        >
          <div
            style={{ backgroundColor: fillColor, color: textColor || '#ffffff' }}
            className="px-3 py-2 flex items-center justify-between shrink-0"
          >
            <span className="font-black text-xs uppercase tracking-wider truncate">{text || 'TABLE'}</span>
            {onAddCol && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddCol(id);
                }}
                className="p-1 hover:bg-black/25 rounded text-white nodrag"
                title="Add column"
              >
                +
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100 bg-white flex-1 overflow-y-auto custom-scrollbar">
            {fields?.map((f, fIdx) => (
              <div
                key={f.id || fIdx}
                className="px-3 py-1.5 flex items-center justify-between text-[11px] group/col hover:bg-slate-50"
              >
                <span className="font-semibold text-slate-700 truncate">{f.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-slate-400">{f.type}</span>
                  {f.isPk && <span className="px-1 py-0.2 bg-red-100 text-red-600 font-black text-[9px] rounded">PK</span>}
                  {f.isFk && <span className="px-1 py-0.2 bg-indigo-100 text-indigo-600 font-black text-[9px] rounded">FK</span>}
                  {onRemoveCol && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCol(id, fIdx);
                      }}
                      className="opacity-0 group-col-hover:opacity-100 text-slate-300 hover:text-red-500 nodrag"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. UML Class
  if (type === 'uml-class') {
    return (
      <div className="relative w-full h-full group">
        <NodeResizer
          isVisible={selected}
          minWidth={160}
          minHeight={90}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <div
          style={{
            borderRadius: `${cornerRadius || 6}px`,
            borderColor: strokeColor,
            borderWidth: `${strokeWidth}px`,
          }}
          className={`bg-white border flex flex-col overflow-hidden w-full h-full ${borderDashClass} ${
            shadow ? 'shadow-md hover:shadow-lg' : ''
          } ${selected ? 'ring-2 ring-cyan-500' : ''}`}
        >
          <div
            style={{ backgroundColor: fillColor }}
            className="px-3 py-1.5 border-b border-slate-200 text-center shrink-0"
          >
            <span className="font-black text-xs text-slate-800">{text || 'ClassName'}</span>
          </div>
          <div className="p-2 space-y-1 flex-1 overflow-y-auto custom-scrollbar text-[10px] font-mono text-slate-600">
            {umlMembers?.map((m, mIdx) => (
              <div key={m.id || mIdx} className="truncate">
                <span className="font-bold text-slate-400 mr-1">{m.visibility}</span>
                <span>{m.name}</span>
                {m.type && <span className="text-slate-400">: {m.type}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 4. Decision Diamond
  if (type === 'diamond') {
    return (
      <div className="relative w-full h-full group flex items-center justify-center">
        <NodeResizer
          isVisible={selected}
          minWidth={80}
          minHeight={60}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <svg className="w-full h-full absolute inset-0 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
          <polygon
            points="50,2 98,50 50,98 2,50"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash === 'dashed' ? '5,5' : strokeDash === 'dotted' ? '2,3' : undefined}
          />
        </svg>
        <div
          className="relative z-10 px-4 text-center select-text nodrag"
          style={{
            fontFamily,
            color: textColor,
            fontSize: `${fontSize}px`,
            fontWeight: fontBold ? 700 : 500,
            fontStyle: fontItalic ? 'italic' : 'normal',
            textDecoration: fontUnderline ? 'underline' : 'none',
            textAlign,
          }}
        >
          <span className="whitespace-pre-line leading-tight">{text}</span>
        </div>
      </div>
    );
  }

  // 5. Parallelogram (Data I/O)
  if (type === 'parallelogram') {
    return (
      <div className="relative w-full h-full group flex items-center justify-center">
        <NodeResizer
          isVisible={selected}
          minWidth={90}
          minHeight={50}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <svg className="w-full h-full absolute inset-0 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
          <polygon
            points="18,2 98,2 82,98 2,98"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDash === 'dashed' ? '5,5' : strokeDash === 'dotted' ? '2,3' : undefined}
          />
        </svg>
        <div
          className="relative z-10 px-4 text-center select-text nodrag"
          style={{
            fontFamily,
            color: textColor,
            fontSize: `${fontSize}px`,
            fontWeight: fontBold ? 700 : 500,
            fontStyle: fontItalic ? 'italic' : 'normal',
            textAlign,
          }}
        >
          <span className="whitespace-pre-line leading-tight">{text}</span>
        </div>
      </div>
    );
  }

  // 6. Cylinder (Database)
  if (type === 'cylinder') {
    return (
      <div className="relative w-full h-full group flex items-center justify-center">
        <NodeResizer
          isVisible={selected}
          minWidth={90}
          minHeight={60}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <svg className="w-full h-full absolute inset-0 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
          <path
            d="M 2 18 A 48 14 0 0 0 98 18 A 48 14 0 0 0 2 18 Z M 2 18 L 2 82 A 48 14 0 0 0 98 82 L 98 18"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <ellipse cx="50" cy="18" rx="48" ry="14" fill={fillColor} stroke={strokeColor} strokeWidth={strokeWidth} />
        </svg>
        <div
          className="relative z-10 px-4 text-center select-text nodrag mt-4"
          style={{
            fontFamily,
            color: textColor,
            fontSize: `${fontSize}px`,
            fontWeight: fontBold ? 700 : 500,
            fontStyle: fontItalic ? 'italic' : 'normal',
            textAlign,
          }}
        >
          <span className="whitespace-pre-line leading-tight">{text}</span>
        </div>
      </div>
    );
  }

  // 7. Stadium / Terminal (Start/End)
  if (type === 'stadium') {
    return (
      <div className="relative w-full h-full group flex items-center justify-center">
        <NodeResizer
          isVisible={selected}
          minWidth={80}
          minHeight={40}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <div
          style={{
            backgroundColor: fillColor,
            borderColor: strokeColor,
            borderWidth: `${strokeWidth}px`,
            borderRadius: '9999px',
          }}
          className={`w-full h-full flex items-center justify-center px-4 ${borderDashClass} ${
            shadow ? 'shadow-md hover:shadow-lg' : ''
          } ${selected ? 'ring-2 ring-cyan-500' : ''}`}
        >
          <span
            className="select-text nodrag whitespace-pre-line leading-tight text-center"
            style={{
              fontFamily,
              color: textColor,
              fontSize: `${fontSize}px`,
              fontWeight: fontBold ? 700 : 500,
              fontStyle: fontItalic ? 'italic' : 'normal',
              textAlign,
            }}
          >
            {text}
          </span>
        </div>
      </div>
    );
  }

  // 8. Circle / State
  if (type === 'circle') {
    return (
      <div className="relative w-full h-full group flex items-center justify-center">
        <NodeResizer
          isVisible={selected}
          minWidth={60}
          minHeight={60}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <div
          style={{
            backgroundColor: fillColor,
            borderColor: strokeColor,
            borderWidth: `${strokeWidth}px`,
            borderRadius: '50%',
          }}
          className={`w-full h-full flex items-center justify-center p-3 ${borderDashClass} ${
            shadow ? 'shadow-md hover:shadow-lg' : ''
          } ${selected ? 'ring-2 ring-cyan-500' : ''}`}
        >
          <span
            className="select-text nodrag whitespace-pre-line leading-tight text-center"
            style={{
              fontFamily,
              color: textColor,
              fontSize: `${fontSize}px`,
              fontWeight: fontBold ? 700 : 500,
              fontStyle: fontItalic ? 'italic' : 'normal',
              textAlign,
            }}
          >
            {text}
          </span>
        </div>
      </div>
    );
  }

  // 9. Sticky Note
  if (type === 'sticky') {
    return (
      <div className="relative w-full h-full group">
        <NodeResizer
          isVisible={selected}
          minWidth={100}
          minHeight={80}
          lineClassName="!border-cyan-500"
          handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
        />
        {renderHandles()}
        <div
          style={{
            backgroundColor: fillColor || '#fef08a',
            borderColor: strokeColor || '#ca8a04',
            borderWidth: `${strokeWidth}px`,
            borderRadius: '4px',
          }}
          className={`w-full h-full p-3 shadow-md hover:shadow-lg flex flex-col justify-start rotate-[-1deg] ${
            selected ? 'ring-2 ring-cyan-500' : ''
          }`}
        >
          <span
            className="select-text nodrag whitespace-pre-line leading-relaxed"
            style={{
              fontFamily,
              color: textColor,
              fontSize: `${fontSize}px`,
              fontWeight: fontBold ? 700 : 500,
              fontStyle: fontItalic ? 'italic' : 'normal',
              textAlign,
            }}
          >
            {text}
          </span>
        </div>
      </div>
    );
  }

  // 10. Default Rectangle / Rounded / Process
  return (
    <div className="relative w-full h-full group flex items-center justify-center">
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={40}
        lineClassName="!border-cyan-500"
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-cyan-600 !rounded-sm"
      />
      {renderHandles()}
      <div
        style={{
          backgroundColor: fillColor,
          borderColor: strokeColor,
          borderWidth: `${strokeWidth}px`,
          borderRadius: `${type === 'rounded' ? 16 : cornerRadius || 8}px`,
        }}
        className={`w-full h-full flex items-center justify-center px-4 py-2 ${borderDashClass} ${
          shadow ? 'shadow-md hover:shadow-lg' : ''
        } ${selected ? 'ring-2 ring-cyan-500' : ''}`}
      >
        <span
          className="select-text nodrag whitespace-pre-line leading-tight text-center"
          style={{
            fontFamily,
            color: textColor,
            fontSize: `${fontSize}px`,
            fontWeight: fontBold ? 700 : 500,
            fontStyle: fontItalic ? 'italic' : 'normal',
            textDecoration: fontUnderline ? 'underline' : 'none',
            textAlign,
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
});

CustomDiagramNodeComponent.displayName = 'CustomDiagramNodeComponent';
