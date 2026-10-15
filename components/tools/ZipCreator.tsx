import React, { useState } from "react";
import { ToolProps } from "../../types";
import {
  Archive,
  Download,
  Loader2,
  File as FileIcon,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";
import { API_BASE } from "../../App";

export const ZipCreator: React.FC<ToolProps> = ({
  files,
  setActiveFileIndex,
  activeFileIndex,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    files.map((f) => f.id),
  );

  const toggleFile = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleFileClick = (fileId: string) => {
    const mainIdx = files.findIndex((f) => f.id === fileId);
    if (mainIdx !== -1) setActiveFileIndex(mainIdx);
  };

  const createZip = async () => {
    const selectedFiles = files.filter((f) => selectedIds.includes(f.id));
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("files", f.blob));

      const response = await fetch(`${API_BASE}/zip`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Zip creation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `document_archive_${Date.now()}.zip`;
      link.click();
    } catch (error) {
      alert("Error: Zip engine failure on port 8000.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
          <Archive size={24} />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Archive Builder
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            Bundle your workspace
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
          Selection
        </label>
        <div className="max-h-64 overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl space-y-1 p-1 bg-slate-50/50">
          {files.map((file) => {
            const isSelected = selectedIds.includes(file.id);
            const isCurrentlyPreviewed = files[activeFileIndex]?.id === file.id;

            return (
              <div
                key={file.id}
                onClick={() => handleFileClick(file.id)}
                className={`p-3 flex items-center gap-3 rounded-lg border transition-all cursor-pointer group ${isCurrentlyPreviewed ? "border-amber-400 bg-amber-50" : isSelected ? "bg-white border-slate-200" : "bg-transparent border-transparent opacity-50"}`}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFile(file.id);
                  }}
                  className={`transition-colors ${isSelected ? "text-amber-500" : "text-slate-300"}`}
                >
                  {isSelected ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Circle size={16} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-[11px] font-black truncate block ${isSelected ? "text-slate-800" : "text-slate-400"}`}
                  >
                    {file.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={createZip}
        disabled={isProcessing || selectedIds.length === 0}
        className="w-full flex items-center justify-center gap-3 py-5 bg-amber-600 text-white rounded-2xl font-black shadow-lg shadow-amber-600/20 hover:bg-amber-700 disabled:bg-slate-200 transition-all text-sm uppercase tracking-widest"
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Download size={18} />
        )}
        <span>
          {isProcessing ? "Packaging..." : `Create ZIP (${selectedIds.length})`}
        </span>
      </button>
    </div>
  );
};
