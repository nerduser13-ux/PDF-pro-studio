import React, { useState, useEffect } from "react";
import { ToolProps, FileData } from "../../types";
import {
  FileStack,
  Download,
  RefreshCcw,
  GripVertical,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { API_BASE } from "../../App";
import { PDFDocument } from "pdf-lib";

export const PDFMerger: React.FC<ToolProps> = ({
  files,
  setActiveFileIndex,
  activeFileIndex,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderedFiles, setOrderedFiles] = useState<FileData[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const pdfs = files.filter((f) => f.type === "application/pdf");
    setOrderedFiles((prev) => {
      const existingIds = new Set(pdfs.map((f) => f.id));
      const filtered = prev.filter((f) => existingIds.has(f.id));
      const newFiles = pdfs.filter((f) => !prev.find((p) => p.id === f.id));
      return [...filtered, ...newFiles];
    });
  }, [files]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    e.dataTransfer.setData("text/plain", index.toString());
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

  const onDragEnd = () => {
    setDraggedIndex(null);
  };

  const mergePDFs = async () => {
    const selectedFiles = orderedFiles.filter((f) => selectedIds.has(f.id));
    if (selectedFiles.length < 2) return;
    setIsProcessing(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach((f) => formData.append("files", f.blob));

      const response = await fetch(`${API_BASE}/merge`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Backend merge failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `merged_${Date.now()}.pdf`;
      link.click();
    } catch (e) {
      console.warn("Backend merge failed, falling back to client-side", e);
      try {
        const mergedPdf = await PDFDocument.create();

        for (const fileData of selectedFiles) {
          const bytes = await fileData.blob.arrayBuffer();
          const pdf = await PDFDocument.load(bytes);
          const copiedPages = await mergedPdf.copyPages(
            pdf,
            pdf.getPageIndices(),
          );
          copiedPages.forEach((page: any) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([new Uint8Array(mergedPdfBytes)], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `merged_${Date.now()}.pdf`;
        link.click();
      } catch (clientErr) {
        alert("Merge failed. Ensure all files are valid PDFs.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileStack size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              PDF Assembler
            </h3>
            <p className="text-slate-500 text-sm font-medium">
              Drag items to reorder. Click to preview.
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">
            Merge Queue
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
                      ? "opacity-40 border-dashed border-blue-400 scale-95"
                      : isCurrentlyPreviewed
                        ? "border-blue-500 bg-blue-50/50 shadow-inner"
                        : isSelected
                          ? "bg-blue-50/30 border-blue-100 shadow-sm"
                          : "bg-white border-slate-50 opacity-60 grayscale"
                  } group hover:border-blue-200`}
                >
                  <div className="text-slate-300 group-hover:text-blue-400 transition-colors">
                    <GripVertical size={20} />
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFile(file.id);
                    }}
                    className={`transition-colors cursor-pointer ${isSelected ? "text-blue-600" : "text-slate-300"}`}
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
                      Position {index + 1} •{" "}
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              );
            })}
            {orderedFiles.length === 0 && (
              <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                  No PDF files in tray
                </p>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={mergePDFs}
          disabled={
            orderedFiles.filter((f) => selectedIds.has(f.id)).length < 2 ||
            isProcessing
          }
          className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/30 hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none transition-all text-lg uppercase tracking-wider"
        >
          {isProcessing ? (
            <RefreshCcw className="animate-spin" size={24} />
          ) : (
            <Download size={24} />
          )}
          {isProcessing
            ? "Processing..."
            : `Merge ${selectedIds.size} PDF Files`}
        </button>
      </div>
    </div>
  );
};
