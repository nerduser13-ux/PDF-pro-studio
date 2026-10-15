import React, { useState } from "react";
import { ToolProps } from "../../types";
import {
  FileType,
  Download,
  Loader2,
  FileCheck,
  AlertTriangle,
} from "lucide-react";
import { API_BASE } from "../../App";

interface OfficeToPDFProps extends ToolProps {
  format: "word" | "ppt" | "excel";
}

export const OfficeToPDF: React.FC<OfficeToPDFProps> = ({
  files,
  activeFileIndex,
  format,
  isBackendOnline,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const file = files[activeFileIndex];

  const convert = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file.blob);

      const endpoint = `${API_BASE}/office-to-pdf`;
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Conversion failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.[^/.]+$/, ".pdf");
      link.click();
    } catch (error) {
      alert("Error: Conversion engine failed or port 8000 unreachable.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) return null;

  const config = {
    word: {
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      label: "Word to PDF",
    },
    ppt: {
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-100",
      label: "PowerPoint to PDF",
    },
    excel: {
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      label: "Excel to PDF",
    },
  }[format];

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className={`p-3 rounded-xl ${config.bg} ${config.color}`}>
          <FileType size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight truncate">
            {config.label}
          </h3>
          <p className="text-slate-500 text-sm truncate">
            Convert office assets to PDF format.
          </p>
        </div>
      </div>

      {isBackendOnline === false && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700 text-xs font-bold uppercase">
          <AlertTriangle size={18} className="shrink-0" />
          Engine Offline
        </div>
      )}

      <div
        className={`p-4 ${config.bg} border ${config.border} rounded-2xl flex items-center gap-4 mb-8 overflow-hidden`}
      >
        <FileCheck className={`${config.color} shrink-0`} size={32} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">
            {file.name}
          </p>
          <p
            className={`text-[10px] ${config.color} font-bold uppercase tracking-wider`}
          >
            Format conversion ready
          </p>
        </div>
      </div>

      <button
        onClick={convert}
        disabled={isProcessing || isBackendOnline === false}
        className={`w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl transition-all flex items-center justify-center gap-3 text-lg uppercase tracking-widest hover:bg-black disabled:bg-slate-200`}
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={24} />
        ) : (
          <Download size={24} />
        )}
        {isProcessing ? "Processing..." : "Run Conversion"}
      </button>
    </div>
  );
};
