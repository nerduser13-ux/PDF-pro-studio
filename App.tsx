import React, { useState, useEffect, useRef } from "react";
import { Sidebar } from "./components/Sidebar";
import { PDFMerger } from "./components/tools/PDFMerger";
import { PDFSplitter } from "./components/tools/PDFSplitter";
import { PDFToImage } from "./components/tools/PDFToImage";
import { PDFComparer } from "./components/tools/PDFComparer";
import { PDFToWord } from "./components/tools/PDFToWord";
import { ImageToPDF } from "./components/tools/ImageToPDF";
import { ImageToText } from "./components/tools/ImageToText";
import { PDFRotator } from "./components/tools/PDFRotator";
import { ZipCreator } from "./components/tools/ZipCreator";
import { PDFPageRemover } from "./components/tools/PDFPageRemover";
import { PDFPageExtractor } from "./components/tools/PDFPageExtractor";
import { PDFToPPTX } from "./components/tools/PDFToPPTX";
import { PDFToExcel } from "./components/tools/PDFToExcel";
import { PDFToPDFA } from "./components/tools/PDFToPDFA";
import { PDFEditorControls } from "./components/tools/PDFEditor";
import { PDFEditorCanvas } from "./components/tools/PDFEditorCanvas";
import { PDFSignerControls } from "./components/tools/PDFSigner";
import { PDFSignerCanvas } from "./components/tools/PDFSignerCanvas";
import { WordViewerTool } from "./components/tools/WordViewerTool";
import { WordMerger } from "./components/tools/WordMerger";
import { PPTMerger } from "./components/tools/PPTMerger";
import { OfficeToPDF } from "./components/tools/OfficeToPDF";
import { FileUploader } from "./components/FileUploader";
import { FilePreviewer } from "./components/FilePreviewer";
import { ComparePreviewer } from "./components/ComparePreviewer";
import {
  ToolType,
  FileData,
  DiffBox,
  ComparisonResult,
  OcrSelectionPayload,
} from "./types";
import {
  Plus,
  X,
  RefreshCw,
  Wifi,
  WifiOff,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  File as FileIcon,
  Zap,
  FolderOpen,
} from "lucide-react";

export const API_BASE = "http://127.0.0.1:8000";

const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolType>("word-viewer");
  const [files, setFiles] = useState<FileData[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [compareFileIndex, setCompareFileIndex] = useState(1);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [isTrayVisible, setIsTrayVisible] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(320);
  const [isResizingInspector, setIsResizingInspector] = useState(false);

  const [selectedPages, setSelectedPages] = useState<string>("");
  const [rotations, setRotations] = useState<
    Record<string, Record<number, number>>
  >({});
  const [diffs, setDiffs] = useState<DiffBox[]>([]);
  const [comparisonResult, setComparisonResult] =
    useState<ComparisonResult | null>(null);

  const trayInputRef = useRef<HTMLInputElement>(null);
  const trayScrollRef = useRef<HTMLDivElement>(null);
  const previewHostRef = useRef<HTMLDivElement>(null);
  const snipStartRef = useRef<{ x: number; y: number } | null>(null);
  const snipRectRef = useRef<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const [ocrSelection, setOcrSelection] = useState<OcrSelectionPayload | null>(
    null,
  );
  const [isSnipping, setIsSnipping] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [snipRect, setSnipRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const [editorMode, setEditorMode] = useState<
    | "select"
    | "pen"
    | "text"
    | "rect"
    | "circle"
    | "arrow"
    | "eraser"
    | "mosaic"
  >("select");
  const [editorColor, setEditorColor] = useState("#4f46e5");
  const [editorSize, setEditorSize] = useState(3);
  const [editorZoom, setEditorZoom] = useState(1.2);

  const [signerZoom, setSignerZoom] = useState(1.2);
  const [activeSignature, setActiveSignature] = useState<string | null>(null);

  const checkHealth = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch(`${API_BASE}/health`, { mode: "cors" });
      setIsBackendOnline(res.ok);
    } catch (err) {
      setIsBackendOnline(false);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(false);
    };
    const onBlur = () => setIsShiftPressed(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    // Keep comparisonResult persistent. Only clear page selections when switching.
    setSelectedPages("");
    if (activeTool !== "img2text") {
      setSnipRect(null);
      setIsSnipping(false);
      setOcrSelection(null);
      snipStartRef.current = null;
    }
  }, [activeTool, activeFileIndex]);

  useEffect(() => {
    if (!isResizingInspector) return;
    const onMove = (e: MouseEvent) => {
      const next = window.innerWidth - e.clientX;
      setInspectorWidth(Math.min(560, Math.max(260, next)));
    };
    const onUp = () => setIsResizingInspector(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isResizingInspector]);

  const intersectArea = (a: DOMRect, b: DOMRect) => {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    if (right <= left || bottom <= top) return 0;
    return (right - left) * (bottom - top);
  };

  const collectTextFromRect = (root: HTMLElement, rect: DOMRect) => {
    const nodes = root.querySelectorAll(
      ".textLayer span, p, h1, h2, h3, h4, h5, h6, td, th, li, pre, code, span",
    );
    const out: string[] = [];
    const seen = new Set<string>();
    nodes.forEach((node) => {
      const text = node.textContent?.trim();
      if (!text) return;
      const r = node.getBoundingClientRect();
      if (!intersectArea(rect, r)) return;
      if (seen.has(text)) return;
      seen.add(text);
      out.push(text);
    });
    return out.join("\n");
  };

  const cropFromImage = async (root: HTMLElement, rect: DOMRect) => {
    const imgs = Array.from(root.querySelectorAll("img"));
    let best: Element | null = null;
    let bestArea = 0;
    imgs.forEach((img) => {
      const area = intersectArea(rect, img.getBoundingClientRect());
      if (area > bestArea) {
        bestArea = area;
        best = img;
      }
    });
    if (!best || bestArea <= 0) return null;
    const imgEl = best as HTMLImageElement;

    const imgRect = imgEl.getBoundingClientRect();
    const sx = Math.max(0, rect.left - imgRect.left);
    const sy = Math.max(0, rect.top - imgRect.top);
    const sw = Math.min(rect.width, imgRect.width - sx);
    const sh = Math.min(rect.height, imgRect.height - sy);
    if (sw <= 1 || sh <= 1) return null;

    const naturalWidth = imgEl.naturalWidth || imgEl.width;
    const naturalHeight = imgEl.naturalHeight || imgEl.height;
    const scaleX = naturalWidth / imgRect.width;
    const scaleY = naturalHeight / imgRect.height;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(sw * scaleX));
    canvas.height = Math.max(1, Math.floor(sh * scaleY));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      imgEl,
      sx * scaleX,
      sy * scaleY,
      sw * scaleX,
      sh * scaleY,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
  };

  const cropFromCanvas = async (root: HTMLElement, rect: DOMRect) => {
    const canvases = Array.from(root.querySelectorAll("canvas"));
    let best: Element | null = null;
    let bestArea = 0;
    canvases.forEach((c) => {
      const area = intersectArea(rect, c.getBoundingClientRect());
      if (area > bestArea) {
        bestArea = area;
        best = c;
      }
    });
    if (!best || bestArea <= 0) return null;
    const canvasEl = best as HTMLCanvasElement;

    const cRect = canvasEl.getBoundingClientRect();
    const sx = Math.max(0, rect.left - cRect.left);
    const sy = Math.max(0, rect.top - cRect.top);
    const sw = Math.min(rect.width, cRect.width - sx);
    const sh = Math.min(rect.height, cRect.height - sy);
    if (sw <= 1 || sh <= 1) return null;

    const scaleX = canvasEl.width / cRect.width;
    const scaleY = canvasEl.height / cRect.height;

    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.floor(sw * scaleX));
    out.height = Math.max(1, Math.floor(sh * scaleY));
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      canvasEl,
      sx * scaleX,
      sy * scaleY,
      sw * scaleX,
      sh * scaleY,
      0,
      0,
      out.width,
      out.height,
    );
    return new Promise<Blob | null>((resolve) =>
      out.toBlob(resolve, "image/png"),
    );
  };

  const buildSelectionPayload = async (
    left: number,
    top: number,
    width: number,
    height: number,
  ) => {
    const host = previewHostRef.current;
    if (!host) return null;

    const rect = new DOMRect(left, top, width, height);
    const text = collectTextFromRect(host, rect).trim();
    if (text) {
      return {
        sourceType: "text" as const,
        text,
        rect: { left, top, width, height },
      };
    }

    const imageBlob = await cropFromImage(host, rect);
    if (imageBlob) {
      return {
        sourceType: "image" as const,
        blob: imageBlob,
        rect: { left, top, width, height },
      };
    }

    const canvasBlob = await cropFromCanvas(host, rect);
    if (canvasBlob) {
      return {
        sourceType: "image" as const,
        blob: canvasBlob,
        rect: { left, top, width, height },
      };
    }

    return null;
  };

  const getOverlayPoint = (e: React.MouseEvent<HTMLDivElement>) => {
    const host = previewHostRef.current;
    if (!host) return null;
    const r = host.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    };
  };

  const handleSnipStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "img2text") return;
    const p = getOverlayPoint(e);
    if (!p) return;
    if (e.button !== 0) return;

    // Normal click outside current selection clears it.
    if (!e.shiftKey) {
      if (snipRect) {
        const isInside =
          p.x >= snipRect.left &&
          p.x <= snipRect.left + snipRect.width &&
          p.y >= snipRect.top &&
          p.y <= snipRect.top + snipRect.height;
        if (!isInside) {
          setSnipRect(null);
          snipRectRef.current = null;
          setOcrSelection(null);
        }
      }
      return;
    }

    setIsSnipping(true);
    setOcrSelection(null);
    snipStartRef.current = p;
    const startRect = { left: p.x, top: p.y, width: 0, height: 0 };
    snipRectRef.current = startRect;
    setSnipRect(startRect);
    e.preventDefault();
  };

  const handleSnipMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSnipping || !snipStartRef.current) return;
    const p = getOverlayPoint(e);
    if (!p) return;
    const left = Math.min(snipStartRef.current.x, p.x);
    const top = Math.min(snipStartRef.current.y, p.y);
    const width = Math.abs(p.x - snipStartRef.current.x);
    const height = Math.abs(p.y - snipStartRef.current.y);
    const nextRect = { left, top, width, height };
    snipRectRef.current = nextRect;
    setSnipRect(nextRect);
    e.preventDefault();
  };

  const handleSnipEnd = async () => {
    if (!isSnipping) return;
    setIsSnipping(false);
    snipStartRef.current = null;
    const rect = snipRectRef.current;
    if (!rect || rect.width < 8 || rect.height < 8) {
      setSnipRect(null);
      snipRectRef.current = null;
      setOcrSelection(null);
      return;
    }
    const host = previewHostRef.current;
    if (!host) return;
    const hr = host.getBoundingClientRect();
    const payload = await buildSelectionPayload(
      hr.left + rect.left,
      hr.top + rect.top,
      rect.width,
      rect.height,
    );
    setOcrSelection(payload);
  };

  const handleFilesAdded = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    const formatted = newFiles.map((f) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: f.name,
      size: f.size,
      type: f.type,
      blob: f,
    }));
    setFiles((prev) => {
      const updated = [...prev, ...formatted];
      if (updated.length > 1 && compareFileIndex >= updated.length) {
        setCompareFileIndex(updated.length - 1);
      }
      return updated;
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      if (activeFileIndex >= updated.length) {
        setActiveFileIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const getFileStyle = (file: FileData) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return "bg-red-50 text-red-600 border-red-200";
    if (name.endsWith(".docx") || name.endsWith(".doc"))
      return "bg-blue-50 text-blue-600 border-blue-200";
    if (
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".csv")
    )
      return "bg-emerald-50 text-emerald-600 border-emerald-200";
    if (name.endsWith(".pptx") || name.endsWith(".ppt"))
      return "bg-amber-50 text-amber-600 border-amber-200";
    return "bg-slate-50 text-slate-600 border-slate-200";
  };

  const renderToolControls = () => {
    const props = {
      files,
      setFiles,
      activeFileIndex,
      setActiveFileIndex,
      pages: selectedPages,
      setPages: setSelectedPages,
      rotations,
      setRotations,
      isBackendOnline,
      compareFileIndex,
      setCompareFileIndex,
      diffs,
      setDiffs,
      comparisonResult,
      setComparisonResult,
      ocrSelection,
      setOcrSelection,
    };

    if (activeTool === "edit") {
      return (
        <PDFEditorControls
          {...props}
          mode={editorMode}
          setMode={setEditorMode}
          color={editorColor}
          setColor={setEditorColor}
          size={editorSize}
          setSize={setEditorSize}
          zoom={editorZoom}
          setZoom={setEditorZoom}
        />
      );
    }

    if (activeTool === "sign") {
      return (
        <PDFSignerControls
          {...props}
          zoom={signerZoom}
          setZoom={setSignerZoom}
          activeSignature={activeSignature}
          setActiveSignature={setActiveSignature}
        />
      );
    }

    switch (activeTool) {
      case "zip-viewer":
        return (
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3 mb-2">
                <FolderOpen size={18} className="text-amber-600" />
                <span className="text-sm font-black text-slate-800">
                  Zip Explorer
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Folder navigation has moved to the main preview pane for a
                Google Drive-style browsing experience.
              </p>
            </div>
          </div>
        );
      case "word-viewer":
        return <WordViewerTool {...props} />;
      case "word-merge":
        return <WordMerger {...props} />;
      case "ppt-merge":
        return <PPTMerger {...props} />;
      case "merge":
        return <PDFMerger {...props} />;
      case "split":
        return <PDFSplitter {...props} />;
      case "remove-pages":
        return (
          <PDFPageRemover
            {...props}
            action="remove"
            pages={selectedPages}
            setPages={setSelectedPages}
          />
        );
      case "extract-pages":
        return <PDFPageExtractor {...props} />;
      case "convert":
        return <PDFToImage {...props} />;
      case "compare":
        return (
          <PDFComparer {...props} setComparisonResult={setComparisonResult} />
        );
      case "word":
        return <PDFToWord {...props} />;
      case "pptx":
        return <PDFToPPTX {...props} />;
      case "excel":
        return <PDFToExcel {...props} />;
      case "word-to-pdf":
        return <OfficeToPDF {...props} format="word" />;
      case "ppt-to-pdf":
        return <OfficeToPDF {...props} format="ppt" />;
      case "excel-to-pdf":
        return <OfficeToPDF {...props} format="excel" />;
      case "pdfa":
        return <PDFToPDFA {...props} />;
      case "img2pdf":
        return <ImageToPDF {...props} />;
      case "img2text":
        return <ImageToText {...props} />;
      case "rotate":
        return <PDFRotator {...props} />;
      case "zip":
        return <ZipCreator {...props} />;
      default:
        return <WordViewerTool {...props} />;
    }
  };

  const renderMainContent = () => {
    const file = files[activeFileIndex];
    if (!file)
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
          <div className="w-24 h-24 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600 mb-8 animate-bounce">
            <Zap size={48} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
            Professional PDF Studio
          </h1>
          <p className="text-slate-500 max-w-md text-lg font-medium leading-relaxed mb-12">
            High-performance document processing studio. Select a tool to begin.
          </p>
          <div className="w-full max-w-xl">
            <FileUploader onFilesAdded={handleFilesAdded} />
          </div>
        </div>
      );

    if (activeTool === "edit")
      return (
        <PDFEditorCanvas
          file={file}
          mode={editorMode}
          color={editorColor}
          size={editorSize}
          zoom={editorZoom}
        />
      );
    if (activeTool === "sign")
      return (
        <PDFSignerCanvas
          file={file}
          zoom={signerZoom}
          activeSignature={activeSignature}
        />
      );

    // Always render comparison view if it exists, regardless of whether compare is the active tool
    // so long as activeTool is 'compare'. If switching back to compare, previous results are ready.
    if (activeTool === "compare") {
      const fileB = files[compareFileIndex] || files[0];
      return (
        <ComparePreviewer
          fileA={file}
          fileB={fileB}
          comparisonResult={comparisonResult}
        />
      );
    }

    return (
      <FilePreviewer
        file={file}
        activeTool={activeTool}
        showDeleteOnPages={
          activeTool === "remove-pages" ||
          activeTool === "extract-pages" ||
          activeTool === "convert"
        }
        onPageAction={(p) =>
          setSelectedPages((prev) => (prev ? `${prev}, ${p}` : `${p}`))
        }
        rotations={rotations[file.id]}
        isBackendOnline={isBackendOnline}
      />
    );
  };

  const handleTrayWheel = (e: React.WheelEvent) => {
    if (trayScrollRef.current) {
      trayScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <Sidebar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest truncate">
              {activeTool === "word-viewer"
                ? "File Viewer"
                : activeTool.replace("-", " ")}
            </h3>
            <ChevronRight size={14} className="text-slate-300" />
            {files.length > 0 && (
              <div className="flex items-center gap-3">
                {!isTrayVisible && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-200 min-w-0 shadow-sm animate-in fade-in slide-in-from-left-2">
                    <FileIcon size={14} className="text-indigo-400 shrink-0" />
                    <span className="text-[11px] font-black text-indigo-700 truncate max-w-[200px]">
                      {files[activeFileIndex].name}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => setIsTrayVisible(!isTrayVisible)}
                  className={`p-2 rounded-lg transition-all border flex items-center justify-center ${isTrayVisible ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-200"}`}
                  title={isTrayVisible ? "Hide Workspace" : "Show Workspace"}
                >
                  {isTrayVisible ? (
                    <ChevronUp size={16} strokeWidth={3} />
                  ) : (
                    <ChevronDown size={16} strokeWidth={3} />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isBackendOnline !== null && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isBackendOnline ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"}`}
              >
                {isBackendOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isBackendOnline ? "Engine Online" : "Engine Offline"}
                </span>
              </div>
            )}
            <button
              onClick={checkHealth}
              disabled={isCheckingHealth}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <RefreshCw
                size={18}
                className={isCheckingHealth ? "animate-spin" : ""}
              />
            </button>
          </div>
        </header>

        <div
          className={`shrink-0 overflow-hidden tray-transition bg-white border-b border-slate-200 ${isTrayVisible ? "h-24" : "h-0"}`}
        >
          <div className="h-full flex items-center px-6 gap-6">
            <div className="shrink-0 flex flex-col items-center gap-1.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                Workspace
              </span>
              <input
                type="file"
                ref={trayInputRef}
                className="hidden"
                multiple
                onChange={(e) =>
                  e.target.files && handleFilesAdded(Array.from(e.target.files))
                }
              />
              <button
                onClick={() => trayInputRef.current?.click()}
                className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95 group"
              >
                <Plus
                  size={20}
                  className="group-hover:rotate-90 transition-transform"
                />
              </button>
            </div>

            <div className="h-12 w-px bg-slate-100" />

            <div
              ref={trayScrollRef}
              onWheel={handleTrayWheel}
              className="flex-1 flex items-center gap-3 overflow-x-auto custom-scrollbar py-2"
            >
              {files.map((file, idx) => {
                const isActive = idx === activeFileIndex;
                const isCompare =
                  activeTool === "compare" && idx === compareFileIndex;
                return (
                  <div
                    key={file.id}
                    onClick={() =>
                      activeTool === "compare" && activeFileIndex !== idx
                        ? setCompareFileIndex(idx)
                        : setActiveFileIndex(idx)
                    }
                    className={`group relative shrink-0 w-48 h-16 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 px-3 shadow-sm ${isActive || isCompare ? "border-indigo-600 bg-indigo-50/50" : "border-slate-100 bg-white hover:border-slate-300"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border ${getFileStyle(file)}`}
                    >
                      <FileIcon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[10px] font-black truncate mb-0.5 ${isActive || isCompare ? "text-indigo-900" : "text-slate-700"}`}
                      >
                        {file.name}
                      </p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(idx);
                      }}
                      className="absolute -top-1.5 -right-1.5 p-1 bg-white border border-slate-200 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500 shadow-lg hover:scale-110 transition-all z-10"
                    >
                      <X size={10} strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
              {files.length === 0 && (
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">
                    No files in session
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div
            ref={previewHostRef}
            className={`flex-1 flex flex-col min-w-0 relative ${activeTool === "img2text" && isShiftPressed ? "cursor-crosshair" : ""}`}
            onMouseDown={handleSnipStart}
            onMouseMove={handleSnipMove}
            onMouseUp={handleSnipEnd}
            onMouseLeave={handleSnipEnd}
          >
            {renderMainContent()}
            {activeTool === "img2text" && files[activeFileIndex] && (
              <div className="absolute inset-0 z-40 pointer-events-none">
                <div className="absolute bottom-4 left-4 bg-black/70 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg">
                  {isShiftPressed
                    ? "Selection mode: drag to snip"
                    : "Hold Shift + drag to select extraction area"}
                </div>
                {snipRect && (
                  <div
                    className="absolute border-2 border-emerald-500 bg-emerald-500/10"
                    style={{
                      left: `${snipRect.left}px`,
                      top: `${snipRect.top}px`,
                      width: `${snipRect.width}px`,
                      height: `${snipRect.height}px`,
                    }}
                  />
                )}
              </div>
            )}
          </div>
          <div
            onMouseDown={() => setIsResizingInspector(true)}
            className="w-1 cursor-col-resize bg-slate-200 hover:bg-blue-300 active:bg-blue-400 transition-colors"
            title="Resize inspector"
          />
          <div
            style={{ width: `${inspectorWidth}px` }}
            className="bg-white border-l border-slate-200 overflow-y-auto custom-scrollbar flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.02)]"
          >
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Inspector
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                  Config Pane
                </span>
              </div>
            </div>
            <div className="flex-1">{renderToolControls()}</div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
