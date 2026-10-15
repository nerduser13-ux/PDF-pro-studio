import React, { useState, useEffect } from "react";
import {
  Layers,
  Download,
  Loader2,
  GripVertical,
  CheckCircle2,
  Circle,
  AlertCircle,
  ImageIcon,
} from "lucide-react";
import { ToolProps, FileData } from "../../types";
import { API_BASE } from "../../App";

export const ImageToPDF: React.FC<ToolProps> = ({ files }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderedImages, setOrderedImages] = useState<FileData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    setOrderedImages((prev) => {
      const existingIds = new Set(images.map((f) => f.id));
      const filtered = prev.filter((f) => existingIds.has(f.id));
      const newFiles = images.filter((f) => !prev.find((p) => p.id === f.id));
      return [...filtered, ...newFiles];
    });

    // Generate thumbnails for new images
    images.forEach((img) => {
      if (!thumbnails[img.id]) {
        const url = URL.createObjectURL(img.blob);
        setThumbnails((prev) => ({ ...prev, [img.id]: url }));
      }
    });
  }, [files]);

  useEffect(() => {
    if (selectedIds.size === 0 && orderedImages.length > 0) {
      setSelectedIds(new Set(orderedImages.map((f) => f.id)));
    }
  }, [orderedImages]);

  const toggleImage = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newItems = [...orderedImages];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    setOrderedImages(newItems);
  };

  const convert = async () => {
    const targetImages = orderedImages.filter((f) => selectedIds.has(f.id));
    if (targetImages.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      targetImages.forEach((f) => formData.append("files", f.blob));
      const response = await fetch(`${API_BASE}/image-to-pdf`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Conversion engine failure.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `compiled_images.pdf`;
      link.click();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-pink-50 text-pink-600 rounded-xl">
          <Layers size={24} />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-900 tracking-tight">
            Visual Assembler
          </h3>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            Compile images to PDF
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
        {orderedImages.map((file, index) => {
          const isSelected = selectedIds.has(file.id);
          return (
            <div
              key={file.id}
              draggable
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-move ${isSelected ? "bg-pink-50/30 border-pink-200 shadow-sm" : "bg-slate-50 border-slate-100 opacity-60"}`}
            >
              <div className="text-slate-300 shrink-0">
                <GripVertical size={16} />
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleImage(file.id);
                }}
                className={`cursor-pointer shrink-0 transition-colors ${isSelected ? "text-pink-600" : "text-slate-300"}`}
              >
                {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </div>

              {/* Thumbnail Container */}
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                {thumbnails[file.id] ? (
                  <img
                    src={thumbnails[file.id]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon size={14} className="text-slate-300" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <span
                  className={`text-[11px] font-black truncate block ${isSelected ? "text-slate-900" : "text-slate-500"}`}
                >
                  {file.name}
                </span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              </div>
            </div>
          );
        })}
        {orderedImages.length === 0 && (
          <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
              Add images to tray to begin
            </p>
          </div>
        )}
      </div>

      <button
        onClick={convert}
        disabled={isProcessing || selectedIds.size === 0}
        className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-pink-600 text-white rounded-2xl font-black shadow-xl shadow-pink-600/30 hover:bg-pink-700 active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none transition-all text-sm uppercase tracking-widest"
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <Download size={20} />
        )}
        <span>
          {isProcessing
            ? "Combining..."
            : `Export to PDF (${selectedIds.size})`}
        </span>
      </button>
    </div>
  );
};
