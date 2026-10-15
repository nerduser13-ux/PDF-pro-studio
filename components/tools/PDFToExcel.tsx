import React, { useState } from "react";
import { ToolProps } from "../../types";
import { FileSpreadsheet, Download, Loader2, FileCheck } from "lucide-react";
import { API_BASE } from "../../App";

export const PDFToExcel: React.FC<ToolProps> = ({ files, activeFileIndex }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const file = files[activeFileIndex];

  const convert = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file.blob);
      const response = await fetch(`${API_BASE}/pdf-to-excel`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Conversion failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(".pdf", ".xlsx");
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
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
          <FileSpreadsheet size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Tabular Extraction
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            Automated Table Scoping
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
            Ready for analysis
          </p>
        </div>
      </div>

      <button
        onClick={convert}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 disabled:bg-slate-100 transition-all text-sm uppercase tracking-widest"
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Download size={18} />
        )}
        <span>{isProcessing ? "Extracting..." : "Extract to Excel"}</span>
      </button>
    </div>
  );
};
