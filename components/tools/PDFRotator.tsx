import React, { useState } from "react";
import { ToolProps } from "../../types";
import {
  RotateCw,
  Download,
  Loader2,
  LayoutGrid,
  Layers,
  AlertCircle,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { API_BASE } from "../../App";

interface PDFRotatorProps extends ToolProps {
  rotations: Record<string, Record<number, number>>;
  setRotations: React.Dispatch<
    React.SetStateAction<Record<string, Record<number, number>>>
  >;
}

export const PDFRotator: React.FC<PDFRotatorProps> = ({
  files,
  activeFileIndex,
  rotations,
  setRotations,
}) => {
  const [angle, setAngle] = useState(90);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<"all" | "specific">("all");
  const [pageRange, setPageRange] = useState("");

  const file = files[activeFileIndex];

  const updatePreview = (newAngle: number) => {
    if (!file) return;
    setAngle(newAngle);

    setRotations((prev) => {
      const fileRotations = { ...(prev[file.id] || {}) };

      if (mode === "all") {
        fileRotations[-1] = newAngle;
        Object.keys(fileRotations).forEach((key) => {
          if (key !== "-1") delete fileRotations[parseInt(key)];
        });
      } else {
        const pages = parsePageRange(pageRange);
        pages.forEach((p) => {
          fileRotations[p] = newAngle;
        });
        delete fileRotations[-1];
      }

      return { ...prev, [file.id]: fileRotations };
    });
  };

  const resetRotations = () => {
    if (!file) return;
    setRotations((prev) => {
      const newState = { ...prev };
      delete newState[file.id];
      return newState;
    });
    setAngle(90);
    setPageRange("");
  };

  const parsePageRange = (range: string): number[] => {
    const result: number[] = [];
    const parts = range.split(",").map((p) => p.trim());
    parts.forEach((part) => {
      if (part.includes("-")) {
        const [start, end] = part.split("-").map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = start; i <= end; i++) result.push(i);
        }
      } else {
        const p = Number(part);
        if (!isNaN(p)) result.push(p);
      }
    });
    return result;
  };

  const rotate = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file.blob);
      formData.append("angle", angle.toString());
      if (mode === "specific" && pageRange.trim() !== "") {
        formData.append("pages", pageRange);
      }
      const response = await fetch(`${API_BASE}/rotate`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Rotation failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rotated_${file.name}`;
      link.click();
    } catch (error: any) {
      alert(`Backend Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) return null;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <RotateCw size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Precision Rotator
            </h3>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              Orientation adjustment
            </p>
          </div>
        </div>
        <button
          onClick={resetRotations}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <RefreshCcw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => {
            setMode("all");
            setPageRange("");
          }}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase transition-all border-2 ${mode === "all" ? "bg-indigo-600 text-white border-indigo-600 shadow-lg" : "bg-white text-slate-500 border-slate-100 hover:border-indigo-200"}`}
        >
          <LayoutGrid size={14} /> Entire Doc
        </button>
        <button
          onClick={() => setMode("specific")}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase transition-all border-2 ${mode === "specific" ? "bg-indigo-600 text-white border-indigo-600 shadow-lg" : "bg-white text-slate-500 border-slate-100 hover:border-indigo-200"}`}
        >
          <Layers size={14} /> Target Pages
        </button>
      </div>

      {mode === "specific" && (
        <div className="mb-6 space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            Page Indices
          </label>
          <input
            type="text"
            value={pageRange}
            onChange={(e) => setPageRange(e.target.value)}
            placeholder="e.g. 1, 3, 5-8"
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[90, 180, 270].map((a) => (
          <button
            key={a}
            onClick={() => updatePreview(a)}
            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${angle === a ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-50 bg-white text-slate-400 hover:border-indigo-200"}`}
          >
            <RotateCw
              size={18}
              className={
                a === 180 ? "rotate-180" : a === 270 ? "rotate-[-90deg]" : ""
              }
            />
            <span className="text-[9px] font-black uppercase">{a}°</span>
          </button>
        ))}
      </div>

      <button
        onClick={rotate}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-3 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 disabled:bg-slate-200 transition-all text-sm uppercase tracking-widest"
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Download size={18} />
        )}
        <span>{isProcessing ? "Processing..." : "Apply & Save"}</span>
      </button>
    </div>
  );
};
