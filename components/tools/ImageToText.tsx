import React, { useState } from "react";
import { ToolProps } from "../../types";
import {
  ScanText,
  Copy,
  Check,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import { API_BASE } from "../../App";

export const ImageToText: React.FC<ToolProps> = ({
  files,
  activeFileIndex,
  isBackendOnline,
  ocrSelection,
  setOcrSelection,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const file = files[activeFileIndex];

  const extractText = async () => {
    if (!file) return;
    setIsProcessing(true);
    setExtractedText("");
    setError(null);
    try {
      if (ocrSelection?.sourceType === "text" && ocrSelection.text) {
        setExtractedText(ocrSelection.text);
        return;
      }

      const payload = ocrSelection?.blob || file.blob;
      const formData = new FormData();
      formData.append("files", payload, file.name);

      const response = await fetch(`${API_BASE}/image-to-text`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("OCR engine failed to process the image.");
      }

      const contentType = response.headers.get("content-type") || "";
      const blob = await response.blob();

      if (contentType.includes("application/zip")) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "images_text.zip";
        link.click();
        URL.revokeObjectURL(url);
        setExtractedText("ZIP result downloaded.");
        return;
      }

      const text = await blob.text();
      setExtractedText(text || "No text could be identified in this selection.");
    } catch (err) {
      setError("Extraction failed. Ensure backend is running.");
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!file) return null;

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
          <ScanText size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight truncate">
            Text Extraction
          </h3>
          <p className="text-slate-500 text-sm truncate">
            Snip on preview, then extract from selected region.
          </p>
        </div>
      </div>

      <div className="mb-8 space-y-4">
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4 overflow-hidden">
          <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-emerald-600 shrink-0 overflow-hidden">
            <ImageIcon size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 text-sm truncate">{file.name}</p>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
              Hold Shift and drag on main preview area
            </p>
          </div>
          {ocrSelection && (
            <button
              onClick={() => setOcrSelection?.(null)}
              className="px-3 py-1.5 bg-white text-slate-600 rounded-lg border border-slate-200 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50"
            >
              Clear Selection
            </button>
          )}
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 font-medium leading-relaxed">
          Selection is done directly on the preview pane (left). Hold Shift while dragging.
          {!ocrSelection && (
            <div className="mt-2 flex items-start gap-2 text-amber-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>No selection yet. Extraction will run on full file.</span>
            </div>
          )}
          {ocrSelection && (
            <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
              Selection captured: {Math.round(ocrSelection.rect.width)} x{" "}
              {Math.round(ocrSelection.rect.height)} px (
              {ocrSelection.sourceType})
            </div>
          )}
        </div>
      </div>

      <button
        onClick={extractText}
        disabled={isProcessing || isBackendOnline === false}
        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl transition-all flex items-center justify-center gap-3 text-lg uppercase tracking-widest hover:bg-black disabled:bg-slate-200 disabled:shadow-none"
      >
        {isProcessing ? (
          <Loader2 className="animate-spin" size={24} />
        ) : (
          <ScanText size={24} />
        )}
        {isProcessing
          ? "Extracting..."
          : ocrSelection
            ? "Run Extraction (Selection)"
            : "Run Extraction (Full File)"}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold">
          {error}
        </div>
      )}

      {extractedText && (
        <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Extracted Text Result
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all text-[10px] font-bold uppercase tracking-wider"
            >
              {copied ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <Copy size={14} />
              )}
              {copied ? "Copied" : "Copy Text"}
            </button>
          </div>
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl max-h-[300px] overflow-y-auto custom-scrollbar shadow-inner">
            <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
              {extractedText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
