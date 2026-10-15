import React, { useState } from "react";
import { ToolProps } from "../../types";
import { ShieldCheck, Download, Loader2, FileCheck } from "lucide-react";
import { API_BASE } from "../../App";

export const PDFToPDFA: React.FC<ToolProps> = ({ files, activeFileIndex }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const file = files[activeFileIndex];

  const convert = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file.blob);
      const response = await fetch(`${API_BASE}/pdf-to-pdfa`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Conversion failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(".pdf", "_archive.pdf");
      link.click();
    } catch (error) {
      alert("Error: Engine failure on port 8000.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) return null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
          <ShieldCheck size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Archival Engine
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            ISO PDF/A Standard
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 mb-8 overflow-hidden">
        <FileCheck className="text-slate-400 shrink-0" size={24} />
        <div className="flex-1 min-w-0">
          <p className="font-black text-slate-800 text-xs truncate mb-0.5">
            {file.name}
          </p>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
            Preservation ready
          </p>
        </div>
      </div>

      <button
        onClick={convert}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-3 py-5 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-black disabled:bg-slate-200 transition-all text-sm uppercase tracking-widest"
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Download size={18} />
        )}
        <span>{isProcessing ? "Baking..." : "Convert to PDF/A"}</span>
      </button>
    </div>
  );
};
