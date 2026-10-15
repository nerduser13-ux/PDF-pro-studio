import React, { useState } from "react";
import { ToolProps } from "../../types";
import {
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Archive,
  Download,
  FileCheck,
} from "lucide-react";
import { API_BASE } from "../../App";

export const PDFToImage: React.FC<ToolProps> = ({
  files,
  activeFileIndex,
  isBackendOnline,
  pages = "",
  setPages,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = files[activeFileIndex];

  const parsePages = (input: string): number[] => {
    const result: number[] = [];
    input.split(",").forEach((part) => {
      const range = part.split("-").map((n) => parseInt(n.trim(), 10));
      if (range.length === 1 && !isNaN(range[0])) {
        result.push(range[0]);
      } else if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
        for (let i = range[0]; i <= range[1]; i++) result.push(i);
      }
    });
    return result;
  };

  const downloadPagesSeparately = async (pagesArray: number[]) => {
    if (!file) return;
    try {
      for (let pageNum of pagesArray) {
        const formData = new FormData();
        formData.append("file", file.blob);
        formData.append("pages", String(pageNum));
        const response = await fetch(`${API_BASE}/pdf-to-images`, {
          method: "POST",
          body: formData,
        });
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${file.name.split(".")[0]}_page_${pageNum}.jpg`;
          link.click();
          URL.revokeObjectURL(url);
        } else {
          throw new Error(`Failed to download page ${pageNum}`);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to download pages.");
    }
  };

  const convertToImages = async (mode: "zip" | "first") => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const pageNums = pages.trim() ? parsePages(pages) : [];
      if (mode === "first" && pageNums.length > 1) {
        await downloadPagesSeparately(pageNums);
        return;
      }
      const formData = new FormData();
      formData.append("file", file.blob);
      if (pages.trim()) formData.append("pages", pages);
      const endpoint = `${API_BASE}/pdf-to-images`;
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      if (response.ok) {
        const blob = await response.blob();
        const contentType = response.headers.get("content-type");
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        if (mode === "zip" || contentType?.includes("zip")) {
          link.download = `${file.name.split(".")[0]}_images.zip`;
        } else {
          const pageNum = pageNums.length === 1 ? pageNums[0] : 1;
          link.download = `${file.name.split(".")[0]}_page_${pageNum}.jpg`;
        }
        link.click();
      } else {
        throw new Error("Conversion engine failed.");
      }
    } catch (error: any) {
      setError(error.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) return null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
          <ImageIcon size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight truncate">
            Rasterization Hub
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            High-fidelity export
          </p>
        </div>
      </div>

      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4 mb-8 overflow-hidden">
        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 shrink-0">
          <FileCheck size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-xs truncate mb-0.5">
            {file.name}
          </p>
          <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">
            Format verified
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
          Scope Selection
        </label>
        <input
          type="text"
          value={pages}
          onChange={(e) => setPages?.(e.target.value)}
          placeholder="All pages if empty (e.g. 1, 3-5)"
          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold text-slate-900"
        />
      </div>

      <div className="space-y-3">
        <button
          onClick={() => convertToImages("zip")}
          disabled={isProcessing || isBackendOnline === false}
          className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 disabled:bg-slate-100 transition-all text-sm uppercase tracking-widest"
        >
          {isProcessing ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Archive size={18} />
          )}
          <span>{isProcessing ? "Baking..." : "Download ZIP Bundle"}</span>
        </button>
        <button
          onClick={() => convertToImages("first")}
          disabled={isProcessing || isBackendOnline === false}
          className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-emerald-600 text-emerald-600 rounded-2xl font-black hover:bg-emerald-50 disabled:opacity-30 transition-all text-[10px] uppercase tracking-widest"
        >
          <ImageIcon size={16} />
          <span>Export Separate Frames</span>
        </button>
      </div>
    </div>
  );
};
