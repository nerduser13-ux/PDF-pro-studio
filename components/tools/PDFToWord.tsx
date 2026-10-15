import React, { useState } from "react";
import { ToolProps } from "../../types";
import {
  FileText,
  Loader2,
  Download,
  FileCheck,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";
import { API_BASE } from "../../App";

export const PDFToWord: React.FC<ToolProps> = ({
  files,
  activeFileIndex,
  rotations,
  isBackendOnline,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const file = files[activeFileIndex];
  const fileRotations = file ? rotations?.[file.id] || {} : {};
  const hasRotations = Object.keys(fileRotations).length > 0;

  const convertToWord = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setStatus("Analyzing layout...");

    try {
      const formData = new FormData();
      formData.append("file", file.blob);
      if (hasRotations) {
        formData.append("rotation_hints", JSON.stringify(fileRotations));
      }
      const response = await fetch(`${API_BASE}/pdf-to-word`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok)
        throw new Error("Engine encountered an error during reconstruction.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(".pdf", ".docx");
      link.click();
      setStatus("Success!");
    } catch (error: any) {
      setError(error.message || "Engine unreachable.");
      setStatus("");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) return null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
          <FileText size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight truncate">
            PDF to Word
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            Native .docx reconstruction
          </p>
        </div>
      </div>

      <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-4 mb-8 overflow-hidden">
        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 shrink-0">
          <FileCheck size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-xs truncate mb-0.5">
            {file.name}
          </p>
          <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest">
            Ready for analysis
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {status && (
          <div className="p-3 rounded-lg text-[10px] font-black text-center bg-blue-50 text-blue-700 animate-pulse border border-blue-100 uppercase tracking-widest">
            {status}
          </div>
        )}
        <button
          onClick={convertToWord}
          disabled={isProcessing || isBackendOnline === false}
          className="w-full flex items-center justify-center gap-3 py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-700 disabled:bg-slate-100 transition-all text-sm uppercase tracking-widest"
        >
          {isProcessing ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <Download size={18} />
          )}
          <span>{isProcessing ? "Processing..." : "Reconstruct Word"}</span>
        </button>
      </div>
    </div>
  );
};
