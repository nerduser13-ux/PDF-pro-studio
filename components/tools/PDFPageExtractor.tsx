import React, { useState } from "react";
import { ToolProps } from "../../types";
import {
  FileSearch,
  Download,
  Loader2,
  FileText,
  Info,
  ImageIcon,
  Archive,
  Copy,
  FileCheck,
} from "lucide-react";
import { API_BASE } from "../../App";

export const PDFPageExtractor: React.FC<ToolProps> = ({
  files,
  activeFileIndex,
  pages = "",
  setPages,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const file = files[activeFileIndex];

  const parsePages = (input: string): number[] => {
    const result: number[] = [];
    input.split(",").forEach((part) => {
      const p = part.trim();
      if (p.includes("-")) {
        const range = p.split("-").map((n) => parseInt(n.trim(), 10));
        if (range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
          for (let i = range[0]; i <= range[1]; i++) result.push(i);
        }
      } else {
        const n = parseInt(p, 10);
        if (!isNaN(n)) result.push(n);
      }
    });
    return Array.from(new Set(result)).sort((a, b) => a - b);
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
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    } catch (err: any) {
      alert("Failed to download individual pages.");
    }
  };

  const processPages = async (
    mode: "pdf" | "images-zip" | "images-individual",
  ) => {
    if (!file || !pages.trim()) return;
    setIsProcessing(true);
    try {
      const pageNums = parsePages(pages);
      if (mode === "images-individual") {
        await downloadPagesSeparately(pageNums);
        return;
      }
      const formData = new FormData();
      formData.append("file", file.blob);
      formData.append("pages", pages);
      const endpoint =
        mode === "pdf"
          ? `${API_BASE}/extract-pages`
          : `${API_BASE}/pdf-to-images`;
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Backend processing failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        mode === "pdf"
          ? `extracted_${file.name}`
          : `extracted_images_${file.name.split(".")[0]}.zip`;
      link.click();
    } catch (error) {
      alert(`Error: Ensure your Python engine is running and range is valid.`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) return null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
          <FileSearch size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight truncate">
            Advanced Extraction
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            Precision page slicing
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
            Active session
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
          Range Index
        </label>
        <input
          type="text"
          value={pages}
          onChange={(e) => setPages?.(e.target.value)}
          placeholder="e.g. 1, 2, 5-8"
          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold text-slate-900 shadow-inner"
        />
      </div>

      <div className="space-y-3">
        <button
          onClick={() => processPages("pdf")}
          disabled={isProcessing || !pages.trim()}
          className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 disabled:bg-slate-100 transition-all text-sm uppercase tracking-widest"
        >
          {isProcessing ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Download size={18} />
          )}
          <span>{isProcessing ? "Slicing..." : "Extract as PDF"}</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => processPages("images-zip")}
            disabled={isProcessing || !pages.trim()}
            className="flex items-center justify-center gap-2 py-3 bg-white border border-emerald-600 text-emerald-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-50 transition-all"
          >
            <Archive size={14} /> ZIP
          </button>
          <button
            onClick={() => processPages("images-individual")}
            disabled={isProcessing || !pages.trim()}
            className="flex items-center justify-center gap-2 py-3 bg-white border border-emerald-600 text-emerald-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-50 transition-all"
          >
            <Copy size={14} /> JPGs
          </button>
        </div>
      </div>
    </div>
  );
};
