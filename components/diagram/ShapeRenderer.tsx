import React from 'react';
import { DiagramNode } from './types';
import { DiagramIcon } from './DiagramIcon';

interface ShapeRendererProps {
  node: DiagramNode;
  isEditing: boolean;
  onTextChange?: (val: string) => void;
  onBlur?: () => void;
  onAddCol?: () => void;
  onRemoveCol?: (idx: number) => void;
}

export const ShapeRenderer: React.FC<ShapeRendererProps> = ({
  node,
  isEditing,
  onTextChange,
  onBlur,
  onAddCol,
  onRemoveCol,
}) => {
  const { width, height, type, text, fillColor, strokeColor, strokeWidth, textColor, cornerRadius } = node;

  // 1. Interactive ER Database Table
  if (type === 'er-table') {
    return (
      <div
        style={{
          borderRadius: `${cornerRadius}px`,
          borderColor: strokeColor,
          borderWidth: `${strokeWidth}px`,
        }}
        className="bg-white border flex flex-col overflow-hidden w-full h-full shadow-sm"
      >
        <div
          style={{ backgroundColor: fillColor, color: textColor }}
          className="px-3 py-2 flex items-center justify-between shrink-0"
        >
          <span className="font-black text-xs uppercase tracking-wider truncate">{text}</span>
          {onAddCol && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddCol(); }}
              className="p-1 hover:bg-black/20 rounded text-white"
              title="Add column"
            >
              +
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-100 bg-white flex-1 overflow-y-auto custom-scrollbar">
          {node.fields?.map((f, fIdx) => (
            <div key={f.id} className="px-3 py-1.5 flex items-center justify-between text-[11px] group/col hover:bg-slate-50">
              <span className="font-semibold text-slate-700 truncate">{f.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-400">{f.type}</span>
                {f.isPk && <span className="px-1 py-0.2 bg-red-100 text-red-600 font-black text-[9px] rounded">PK</span>}
                {f.isFk && <span className="px-1 py-0.2 bg-indigo-100 text-indigo-600 font-black text-[9px] rounded">FK</span>}
                {onRemoveCol && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveCol(fIdx); }}
                    className="opacity-0 group-col-hover:opacity-100 text-slate-300 hover:text-red-500"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Modern Information Card (with colored header pill & optional badge/icon)
  if (type === 'card') {
    const headerH = 36;
    return (
      <div
        style={{
          borderRadius: `${cornerRadius || 16}px`,
          borderColor: strokeColor,
          borderWidth: `${strokeWidth}px`,
          backgroundColor: '#ffffff',
        }}
        className="w-full h-full border flex flex-col overflow-hidden shadow-sm"
      >
        {/* Header Pill */}
        <div
          style={{ backgroundColor: fillColor }}
          className="px-3 py-1.5 flex items-center justify-between text-white shrink-0"
        >
          <div className="flex items-center gap-2 truncate">
            {node.iconName && <DiagramIcon name={node.iconName} size={15} className="text-white shrink-0" />}
            <span className="font-black text-xs uppercase tracking-wider truncate">{node.headerText || 'CARD'}</span>
          </div>
          {node.badgeText && (
            <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center font-black text-[10px]" style={{ color: fillColor }}>
              {node.badgeText}
            </span>
          )}
        </div>
        {/* Body Text */}
        <div className="p-3 flex-1 overflow-auto custom-scrollbar flex flex-col justify-start">
          {isEditing ? (
            <textarea
              autoFocus
              value={text}
              onChange={(e) => onTextChange?.(e.target.value)}
              onBlur={onBlur}
              className="w-full h-full bg-slate-50 p-1.5 rounded text-xs text-slate-800 outline-none resize-none font-medium leading-relaxed"
            />
          ) : (
            <span className="text-xs whitespace-pre-line leading-relaxed font-medium text-slate-700">
              {text}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 3. UML Class Box
  if (type === 'uml-class') {
    return (
      <div
        style={{
          borderRadius: `${cornerRadius}px`,
          borderColor: strokeColor,
          borderWidth: `${strokeWidth}px`,
        }}
        className="bg-white border flex flex-col overflow-hidden w-full h-full shadow-sm"
      >
        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 text-center font-black text-xs text-slate-800">
          {text}
        </div>
        <div className="p-2 space-y-1 text-[11px] font-mono flex-1 overflow-y-auto custom-scrollbar">
          {node.umlMembers?.map(m => (
            <div key={m.id} className="text-slate-600">
              <span className="font-bold text-slate-400 mr-1">{m.visibility}</span>
              <span>{m.name}</span>
              {m.type && <span className="text-slate-400">: {m.type}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4. Vector Geometry Shapes (Diamond, Parallelogram, Circle, Cylinder, Stadium, Rounded, Rect)
  let clipPath: string | undefined = undefined;
  let borderRadiusStyle = `${cornerRadius}px`;

  if (type === 'circle') {
    borderRadiusStyle = '9999px';
  } else if (type === 'stadium') {
    borderRadiusStyle = '9999px';
  } else if (type === 'diamond') {
    clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
  } else if (type === 'parallelogram') {
    clipPath = 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)';
  } else if (type === 'trapezoid') {
    clipPath = 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)';
  } else if (type === 'cylinder') {
    borderRadiusStyle = '14px';
  }

  return (
    <div
      style={{
        backgroundColor: fillColor,
        borderColor: strokeColor,
        borderWidth: `${strokeWidth}px`,
        borderRadius: borderRadiusStyle,
        clipPath,
        color: textColor,
        width: '100%',
        height: '100%',
      }}
      className={`flex items-center justify-center p-3 border text-center font-bold text-xs ${
        node.textAlign === 'left' ? 'text-left justify-start' : node.textAlign === 'right' ? 'text-right justify-end' : 'text-center justify-center'
      }`}
    >
      {isEditing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => onTextChange?.(e.target.value)}
          onBlur={onBlur}
          className="w-full h-full bg-white/80 p-1 rounded font-bold text-xs text-slate-800 outline-none resize-none"
        />
      ) : (
        <span className="whitespace-pre-line leading-relaxed font-semibold">
          {text}
        </span>
      )}
    </div>
  );
};
