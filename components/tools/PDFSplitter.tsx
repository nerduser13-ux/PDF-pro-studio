import React, { useState, useEffect } from "react";
import { ToolProps } from "../../types";
import {
  Scissors,
  FileText,
  Download,
  Loader2,
  Columns2,
  FileCheck,
} from "lucide-react";
import { API_BASE } from "../../App";
import * as pdfjsLib from "pdfjs-dist";

export const PDFSplitter: React.FC<ToolProps> = ({
  files,
  activeFileIndex,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitPoint, setSplitPoint] = useState<number>(1);
  const [numPages, setNumPages] = useState(0);

  const file = files[activeFileIndex];

  useEffect(() => {
    const getPages = async () => {
      if (!file) return;
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setNumPages(pdf.numPages);
        setSplitPoint(Math.floor(pdf.numPages / 2) || 1);
      } catch (err) {}
    };
    getPages();
  }, [file]);

  const extractPages = async (pageRange: string, partName: string) => {
    if (!file || !pageRange) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file.blob);
      formData.append("pages", pageRange);
      const response = await fetch(`${API_BASE}/extract-pages`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Backend processing failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${partName}_${file.name}`;
      link.click();
    } catch (error) {
      alert(`Error: Connection failure on port 8000.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSplit = (type: "part1" | "part2" | "both") => {
    if (type === "part1") extractPages(`1-${splitPoint}`, "part1");
    else if (type === "part2")
      extractPages(`${splitPoint + 1}-${numPages}`, "part2");
    else {
      extractPages(`1-${splitPoint}`, "part1");
      setTimeout(
        () => extractPages(`${splitPoint + 1}-${numPages}`, "part2"),
        1000,
      );
    }
  };

  if (!file) return null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-orange-50 text-orange-500 rounded-xl">
          <Scissors size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Binary Splitter
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            Divide document into parts
          </p>
        </div>
      </div>

      <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-4 mb-8 overflow-hidden">
        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-orange-500 shrink-0">
          <FileCheck size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-xs truncate mb-0.5">
            {file.name}
          </p>
          <p className="text-[9px] text-orange-600 font-black uppercase tracking-widest">
            {numPages} Total Pages
          </p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
          Split at page
        </label>
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 shadow-inner">
          <input
            type="number"
            value={splitPoint}
            min={1}
            max={numPages - 1}
            onChange={(e) => setSplitPoint(parseInt(e.target.value) || 1)}
            className="w-full bg-transparent focus:outline-none text-sm font-black text-slate-900"
          />
          <span className="text-slate-300 text-xs">/ {numPages}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50/50 rounded-lg border border-orange-100/50">
          <Columns2 size={12} className="text-orange-400" />
          <p className="text-[9px] text-orange-800 font-black uppercase tracking-widest">
            A: 1-{splitPoint} • B: {splitPoint + 1}-{numPages}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSplit("part1")}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 py-3 bg-white border border-orange-500 text-orange-600 rounded-xl font-black text-[10px] uppercase hover:bg-orange-50 transition-all"
          >
            <Download size={14} /> Part 1
          </button>
          <button
            onClick={() => handleSplit("part2")}
            disabled={isProcessing}
            className="flex items-center justify-center gap-2 py-3 bg-white border border-orange-500 text-orange-600 rounded-xl font-black text-[10px] uppercase hover:bg-orange-50 transition-all"
          >
            <Download size={14} /> Part 2
          </button>
        </div>
        <button
          onClick={() => handleSplit("both")}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-3 py-5 bg-orange-600 text-white rounded-2xl font-black shadow-xl shadow-orange-600/20 hover:bg-orange-700 disabled:bg-slate-100 transition-all text-sm uppercase tracking-widest"
        >
          {isProcessing ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Download size={18} />
          )}
          <span>{isProcessing ? "Processing..." : "Download Both Parts"}</span>
        </button>
      </div>
    </div>
  );
};
