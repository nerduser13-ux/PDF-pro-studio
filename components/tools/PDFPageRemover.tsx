import React, { useState } from "react";
import { ToolProps } from "../../types";
import {
  Eraser,
  Download,
  Loader2,
  FileText,
  FileSearch,
  X,
} from "lucide-react";
import { API_BASE } from "../../App";

interface PDFPageRemoverProps extends ToolProps {
  action: "remove" | "extract";
}

export const PDFPageRemover: React.FC<PDFPageRemoverProps> = ({
  action,
  files,
  activeFileIndex,
  pages,
  setPages,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const file = files[activeFileIndex];

  const process = async () => {
    if (!file || !pages || !setPages) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file.blob);
      formData.append("pages", pages);

      const response = await fetch(`${API_BASE}/remove-pages`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Backend processing failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${action}_${file.name}`;
      link.click();
    } catch (error) {
      alert(`Error: Check engine and page range validity.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const config =
    action === "remove"
      ? {
          icon: <Eraser className="text-red-500" />,
          title: "Remove Pages",
          color: "bg-red-600",
          hover: "hover:bg-red-700",
          shadow: "shadow-red-600/20",
          accent: "bg-red-50 border-red-100",
          text: "text-red-600",
        }
      : {
          icon: <FileSearch className="text-emerald-500" />,
          title: "Extract Pages",
          color: "bg-emerald-600",
          hover: "hover:bg-emerald-700",
          shadow: "shadow-emerald-600/20",
          accent: "bg-emerald-50 border-emerald-100",
          text: "text-emerald-600",
        };

  if (!file) return null;

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className={`p-3 rounded-xl ${config.accent}`}>{config.icon}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight truncate">
            {config.title}
          </h3>
          <p className="text-slate-500 text-sm truncate">
            Target specific content to keep or discard.
          </p>
        </div>
      </div>

      <div
        className={`p-4 rounded-2xl border flex items-center gap-4 mb-8 ${config.accent} overflow-hidden`}
      >
        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-600 shrink-0">
          <FileText size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">
            {file.name}
          </p>
          <p
            className={`text-[10px] font-bold uppercase tracking-wider ${config.text}`}
          >
            Current Target
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
          {action === "remove"
            ? "Discard range (e.g., 1, 5, 10-12)"
            : "Retention range (e.g., 2-4, 8)"}
        </label>
        <div className="relative">
          <input
            type="text"
            value={pages || ""}
            onChange={(e) => setPages && setPages(e.target.value)}
            placeholder="e.g. 1, 3, 5-10"
            className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400 text-lg font-bold text-slate-900 placeholder-slate-500"
          />
          {pages && setPages && (
            <button
              onClick={() => setPages("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-500 font-medium italic">
          Tip: Click "Mark for Removal" on pages in the preview to add them
          automatically.
        </p>
      </div>

      <button
        onClick={process}
        disabled={isProcessing || !pages}
        className={`w-full flex items-center justify-center gap-3 py-4 text-white rounded-2xl font-bold shadow-xl transition-all text-lg ${config.color} ${config.hover} ${config.shadow} disabled:bg-slate-200 disabled:shadow-none`}
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={24} />
        ) : (
          <Download size={24} />
        )}
        {isProcessing ? "Processing engine..." : `Run ${config.title}`}
      </button>
    </div>
  );
};
