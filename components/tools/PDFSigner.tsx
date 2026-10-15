import React, { useState, useRef, useEffect } from 'react';
import { ToolProps } from '../../types';
import { 
  Signature, 
  Upload, 
  Eraser, 
  Download, 
  ZoomIn,
  ZoomOut,
  Trash2,
  Layers,
  RefreshCcw,
  Plus,
  Undo2,
  Redo2,
  Eye
} from 'lucide-react';
import * as fabric from 'fabric';

interface SignerControlsProps extends ToolProps {
  zoom: number;
  setZoom: (z: number) => void;
  activeSignature: string | null;
  setActiveSignature: (s: string | null) => void;
}

export const PDFSignerControls: React.FC<SignerControlsProps> = ({ 
  files, 
  activeFileIndex, 
  zoom, 
  setZoom,
  activeSignature,
  setActiveSignature
}) => {
  const file = files[activeFileIndex];
  const padRef = useRef<HTMLCanvasElement>(null);
  const fabricPad = useRef<fabric.Canvas | null>(null);
  const [signApplyMode, setSignApplyMode] = useState<'all' | 'range'>('all');
  const [range, setRange] = useState("");

  useEffect(() => {
    if (padRef.current) {
      const canvas = new fabric.Canvas(padRef.current, {
        isDrawingMode: true,
        backgroundColor: 'transparent',
        width: 300,
        height: 150
      });
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = 3;
      canvas.freeDrawingBrush.color = '#000000';
      fabricPad.current = canvas;
    }
    return () => {
      fabricPad.current?.dispose();
    };
  }, []);

  const clearPad = () => {
    if (fabricPad.current) {
      fabricPad.current.clear();
      fabricPad.current.backgroundColor = 'transparent';
      fabricPad.current.renderAll();
    }
  };

  const captureSignature = () => {
    if (!fabricPad.current) return;
    const dataUrl = fabricPad.current.toDataURL({
        format: 'png',
        quality: 1.0,
        multiplier: 2
    });
    setActiveSignature(dataUrl);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (f) => {
        setActiveSignature(f.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!file) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">1. Create Signature</h4>
        
        <div className="rounded-2xl overflow-hidden mb-4 bg-slate-50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-slate-100">
          <canvas ref={padRef} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button 
            onClick={clearPad}
            className="flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
          >
            <Eraser size={14} /> Clear
          </button>
          <button 
            onClick={captureSignature}
            className="flex items-center justify-center gap-2 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
          >
            <Signature size={14} /> Use Drawing
          </button>
        </div>

        <div className="relative">
          <input type="file" id="sig-upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
          <label 
            htmlFor="sig-upload"
            className="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-[10px] font-black uppercase hover:border-rose-300 hover:text-rose-500 transition-all cursor-pointer"
          >
            <Upload size={14} /> Upload Image
          </label>
        </div>
      </div>

      {activeSignature && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 shadow-sm animate-in zoom-in-95">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <Eye size={12} className="text-rose-500" />
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">2. Active Preview</span>
             </div>
             <button onClick={() => setActiveSignature(null)} className="text-rose-300 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
          </div>

          <div className="mb-6 p-4 bg-white rounded-xl border border-rose-100 shadow-sm flex items-center justify-center relative overflow-hidden group">
            {/* Checkerboard transparency grid */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
            <img 
              src={activeSignature} 
              alt="Signature Preview" 
              className="max-w-full max-h-24 object-contain relative z-10 transition-transform group-hover:scale-105" 
            />
          </div>
          
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('signer:add-to-page', { detail: { image: activeSignature } }))}
            className="w-full py-4 bg-white border-2 border-rose-600 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-2 mb-6 shadow-sm"
          >
            <Plus size={16} /> Add to Current Page
          </button>
          
          <div className="space-y-4 border-t border-rose-100 pt-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">3. Replicate Selection</label>
            <p className="text-[9px] text-slate-500 leading-tight mb-2 italic">Adjust the signature above, then sync its exact position to other pages.</p>
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => setSignApplyMode('all')}
                className={`py-2 px-1 rounded-lg border text-[8px] font-black uppercase transition-all ${signApplyMode === 'all' ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}
              >
                All Pages
              </button>
              <button 
                onClick={() => setSignApplyMode('range')}
                className={`py-2 px-1 rounded-lg border text-[8px] font-black uppercase transition-all ${signApplyMode === 'range' ? 'bg-rose-600 border-rose-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-400'}`}
              >
                Custom Range
              </button>
            </div>

            {signApplyMode === 'range' && (
              <input 
                type="text"
                placeholder="e.g. 1-3, 5"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-rose-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            )}

            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent('signer:sync-selection', { 
                  detail: { mode: signApplyMode, range: range } 
                }));
              }}
              className="w-full py-3 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-600/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
            >
              <Layers size={16} /> Propagate Position
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viewport Scale</label>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('signer:reset-canvas'))}
              className="flex items-center gap-1 text-[8px] font-black text-red-500 uppercase hover:underline"
            >
              <RefreshCcw size={10} /> Reset Page
            </button>
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
            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
          />
          <button onClick={() => setZoom(Math.min(2.5, zoom + 0.2))} className="p-2 hover:bg-white rounded-lg transition-all text-slate-500"><ZoomIn size={16} /></button>
        </div>
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('signer:download'))}
        className="w-full flex items-center justify-center gap-3 py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-900/30 hover:bg-black transition-all text-lg uppercase tracking-widest"
      >
        <Download size={22} />
        Bake & Download
      </button>
    </div>
  );
};