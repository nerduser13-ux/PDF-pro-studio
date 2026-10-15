
import React from 'react';
import { ToolProps } from '../../types';
import { 
  PenTool, 
  Type, 
  Eraser, 
  MousePointer2, 
  Download, 
  Square,
  Circle,
  MoveRight,
  RefreshCcw,
  Palette,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Grid,
  ShieldAlert,
  Database
} from 'lucide-react';

interface EditorControlsProps extends ToolProps {
  mode: 'select' | 'pen' | 'text' | 'rect' | 'circle' | 'arrow' | 'eraser' | 'mosaic';
  setMode: (m: any) => void;
  color: string;
  setColor: (c: string) => void;
  size: number;
  setSize: (s: number) => void;
  zoom: number;
  setZoom: (z: number) => void;
}

export const PDFEditorControls: React.FC<EditorControlsProps> = ({ 
  files, 
  activeFileIndex, 
  mode, 
  setMode, 
  color, 
  setColor, 
  size, 
  setSize,
  zoom,
  setZoom
}) => {
  const file = files[activeFileIndex];

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Hand' },
    { id: 'pen', icon: PenTool, label: 'Pen' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'rect', icon: Square, label: 'Box' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'arrow', icon: MoveRight, label: 'Arrow' },
    { id: 'mosaic', icon: Grid, label: 'Redact' },
    { id: 'eraser', icon: Eraser, label: 'Erase' },
  ];

  if (!file) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Object Manipulator</h4>
        
        <div className="grid grid-cols-4 gap-2">
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = mode === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setMode(t.id)}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  isActive 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : 'bg-white border-slate-50 text-slate-400 hover:border-slate-100 hover:text-slate-600'
                }`}
                title={t.label}
              >
                <Icon size={18} />
                <span className="text-[8px] font-black uppercase">{t.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:undo'))}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 bg-white border-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={18} />
            <span className="text-[8px] font-black uppercase">Undo</span>
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:redo'))}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 bg-white border-slate-50 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-all"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={18} />
            <span className="text-[8px] font-black uppercase">Redo</span>
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:reset-page'))}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 bg-white border-slate-50 text-slate-400 hover:border-red-100 hover:text-red-500 transition-all"
            title="Clear All Annotations"
          >
            <RefreshCcw size={18} />
            <span className="text-[8px] font-black uppercase text-center leading-none">Reset</span>
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('editor:open-diagram'))}
            className="col-span-4 flex items-center justify-center gap-2 p-3 mt-1 rounded-xl border-2 border-indigo-100 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 font-bold text-xs uppercase tracking-wider transition-all shadow-sm"
            title="Create ER Diagrams, DB Relationships & Mermaid Models"
          >
            <Database size={16} className="text-indigo-600" />
            <span>Create ER / DB Diagram</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viewport Scale</label>
             <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <button onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} className="p-2 hover:bg-white rounded-lg transition-all text-slate-500"><ZoomOut size={16} /></button>
            <input 
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <button onClick={() => setZoom(Math.min(2.5, zoom + 0.2))} className="p-2 hover:bg-white rounded-lg transition-all text-slate-500"><ZoomIn size={16} /></button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stroke Color</label>
             <Palette size={14} className="text-slate-300" />
          </div>
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <input 
              type="color" 
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
            />
            <span className="text-xs font-mono font-bold text-slate-500 uppercase">{color}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Line Weight</label>
             <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{size}px</span>
          </div>
          <input 
            type="range"
            min="1"
            max="30"
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
        </div>
      </div>

      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
        <ShieldAlert size={16} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-[10px] text-indigo-800 leading-tight">
          <strong>Security:</strong> The 'Redact' tool pixelates the background content and burns it into the image layer to obscure confidential data.
        </p>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('editor:download'))}
        className="w-full flex items-center justify-center gap-3 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all text-lg uppercase tracking-widest"
      >
        <Download size={22} />
        Bake & Download
      </button>
    </div>
  );
};
