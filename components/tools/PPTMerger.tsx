import React, { useState, useEffect } from "react";
import { ToolProps, FileData } from "../../types";
import {
  Download,
  RefreshCcw,
  GripVertical,
  Presentation,
  CheckCircle2,
  Circle,
  AlertCircle,
} from "lucide-react";
import { API_BASE } from "../../App";

export const PPTMerger: React.FC<ToolProps> = ({
  files,
  setActiveFileIndex,
  activeFileIndex,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderedFiles, setOrderedFiles] = useState<FileData[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ppts = files.filter(
      (f) =>
        f.type ===
          "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
        f.type === "application/vnd.ms-powerpoint" ||
        f.name.endsWith(".pptx") ||
        f.name.endsWith(".ppt"),
    );
    setOrderedFiles((prev) => {
      const existingIds = new Set(ppts.map((f) => f.id));
      const filtered = prev.filter((f) => existingIds.has(f.id));
      const newFiles = ppts.filter((f) => !prev.find((p) => p.id === f.id));
      return [...filtered, ...newFiles];
    });
  }, [files]);

  useEffect(() => {
    if (selectedIds.size === 0 && orderedFiles.length > 0) {
      setSelectedIds(new Set(orderedFiles.map((f) => f.id)));
    }
  }, [orderedFiles]);

  const toggleFile = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleFileClick = (fileId: string) => {
    const mainIdx = files.findIndex((f) => f.id === fileId);
    if (mainIdx !== -1) setActiveFileIndex(mainIdx);
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newItems = [...orderedFiles];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setOrderedFiles(newItems);
  };

  const onDragEnd = () => setDraggedIndex(null);

  const mergePPTs = async () => {
    const selectedFiles = orderedFiles.filter((f) => selectedIds.has(f.id));
    if (selectedFiles.length < 2) return;
    setIsProcessing(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("files", f.blob));

      const response = await fetch(`${API_BASE}/merge-ppt`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Backend PPT merge failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `merged_presentation_${Date.now()}.pptx`;
      link.click();
    } catch (e) {
      console.error(e);
      alert("Failed to merge PowerPoint files.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Presentation size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Slide Deck Assembler
            </h3>
            <p className="text-slate-500 text-sm font-medium">
              Click to preview, drag to reorder.
            </p>
          </div>
        </div>

        {orderedFiles.length < 2 && (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 mb-6">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <p className="text-xs text-amber-900 leading-tight">
              <strong>Requirement:</strong> At least 2 PPT files are required in
              the tray.
            </p>
          </div>
        )}

        <div className="space-y-3 mb-8">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">
            Presentation Order
          </label>
          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {orderedFiles.map((file, index) => {
              const isSelected = selectedIds.has(file.id);
              const isDragging = draggedIndex === index;
              const isCurrentlyPreviewed =
                files[activeFileIndex]?.id === file.id;

              return (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  onClick={() => handleFileClick(file.id)}
                  className={`flex items-center gap-4 p-4 border-2 rounded-2xl transition-all cursor-move ${
                    isDragging
                      ? "opacity-40 border-dashed border-amber-400 scale-95"
                      : isCurrentlyPreviewed
                        ? "border-amber-600 bg-amber-50 shadow-inner"
                        : isSelected
                          ? "bg-amber-50/30 border-amber-600 shadow-md ring-4 ring-amber-600/5"
                          : "bg-white border-slate-50 opacity-60 grayscale"
                  } group hover:border-amber-300`}
                >
                  <div className="text-slate-300 group-hover:text-amber-600 transition-colors">
                    <GripVertical size={20} />
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFile(file.id);
                    }}
                    className={`transition-colors cursor-pointer ${isSelected ? "text-amber-600" : "text-slate-300"}`}
                  >
                    {isSelected ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Circle size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-black truncate transition-colors ${isSelected ? "text-slate-900" : "text-slate-400"}`}
                    >
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Position {index + 1} • {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={mergePPTs}
          disabled={
            orderedFiles.filter((f) => selectedIds.has(f.id)).length < 2 ||
            isProcessing
          }
          className="w-full flex items-center justify-center gap-3 py-5 bg-amber-600 text-white rounded-2xl font-black shadow-xl shadow-amber-600/30 hover:bg-amber-700 active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none transition-all text-lg uppercase tracking-wider"
        >
          {isProcessing ? (
            <RefreshCcw className="animate-spin" size={24} />
          ) : (
            <Download size={24} />
          )}
          {isProcessing
            ? "Assembling..."
            : `Assemble ${selectedIds.size} Slide Decks`}
        </button>
      </div>
    </div>
  );
};
