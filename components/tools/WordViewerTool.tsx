import React from "react";
import { ToolProps } from "../../types";
import {
  Eye,
  FileText,
  Upload,
  Info,
  AlertCircle,
  FileCheck,
  CheckCircle2,
} from "lucide-react";

export const WordViewerTool: React.FC<ToolProps> = ({
  files,
  setFiles,
  activeFileIndex,
  setActiveFileIndex,
}) => {
  const file = files[activeFileIndex];

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((f) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: f.name,
        size: f.size,
        type: f.type,
        blob: f,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      setActiveFileIndex(files.length);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Eye size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">
              File Workspace Inspector
            </h3>
            <p className="text-slate-500 text-sm font-medium truncate">
              Inspect and manage document session.
            </p>
          </div>
        </div>

        {file ? (
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-4 mb-8 overflow-hidden">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100">
              <FileCheck size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm truncate">
                {file.name}
              </p>
              <p className="text-[10px] text-indigo-600 font-black uppercase tracking-[0.1em]">
                Target Component Loaded
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-3 mb-8 overflow-hidden text-slate-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold uppercase tracking-widest">
              No active selection
            </p>
          </div>
        )}

        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
            Session Management
          </label>
          <div className="relative">
            <input
              type="file"
              id="file-viewer-upload"
              className="hidden"
              onChange={handleUpload}
              multiple
            />
            <label
              htmlFor="file-viewer-upload"
              className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 font-black text-sm uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 transition-all cursor-pointer group"
            >
              <Upload
                size={20}
                className="group-hover:scale-110 transition-transform"
              />
              Import Assets
            </label>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <CheckCircle2
              size={16}
              className="text-emerald-500 mt-0.5 shrink-0"
            />
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                Multi-Engine Active
              </span>
              <p className="text-[9px] text-slate-500 leading-normal font-medium">
                The viewer automatically detects file formats and initializes
                the appropriate rendering engine (Mammoth for Word, SheetJS for
                Excel, PDF.js for PDF, and ZIP-Explorer).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
