import React, { useEffect, useRef, useState, useCallback } from "react";
import { FileData, ToolType } from "../types";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Trash2,
  File as FileIcon,
  FileText,
  FileSpreadsheet,
  Presentation,
  Layout,
  Hash,
  Terminal,
  Cpu,
  FileCheck,
  Search,
  Folder,
  HardDrive,
} from "lucide-react";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";
import JSZip from "jszip";

const EMPTY_ROTATIONS: Readonly<Record<number, number>> = Object.freeze({});
const API_BASE = (typeof window !== "undefined" && (window as any).__PDF_STUDIO_API_URL__)
  ? (window as any).__PDF_STUDIO_API_URL__
  : "http://127.0.0.1:8000";

interface PageOutlineItem {
  id: string;
  text: string;
  level: number;
  page: number;
  yRatio?: number;
}

interface FilePreviewerProps {
  file: FileData;
  activeTool?: ToolType;
  showDeleteOnPages?: boolean;
  onPageAction?: (pageNumber: number) => void;
  rotations?: Record<number, number>;
  isBackendOnline?: boolean | null;
}

export const FilePreviewer: React.FC<FilePreviewerProps> = ({
  file,
  activeTool,
  showDeleteOnPages = false,
  onPageAction,
  rotations = EMPTY_ROTATIONS,
  isBackendOnline,
}) => {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  const isWord = name.endsWith(".docx") || name.endsWith(".doc");
  const isExcel =
    name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
  const isPPT = name.endsWith(".pptx") || name.endsWith(".ppt");
  const isZip = name.endsWith(".zip");
  const codeExts = [
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".html",
    ".css",
    ".json",
    ".xml",
    ".md",
    ".txt",
    ".java",
    ".cpp",
    ".c",
    ".go",
    ".rs",
    ".php",
    ".sh",
    ".yaml",
    ".yml",
  ];
  const isCode =
    codeExts.some((ext) => name.endsWith(ext)) ||
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.type === "application/javascript";

  if (isPdf)
    return (
      <PDFPreviewer
        file={file}
        showDeleteOnPages={showDeleteOnPages}
        onPageAction={onPageAction}
        rotations={rotations}
      />
    );
  if (isImage) return <ImagePreviewer file={file} />;
  if (isWord) return <WordPreviewer file={file} isBackendOnline={isBackendOnline} />;
  if (isExcel) return <ExcelPreviewer file={file} />;
  if (isZip && activeTool === "zip-viewer") return <ZipPreviewer file={file} />;
  if (isPPT) return <PPTPreviewer file={file} isBackendOnline={isBackendOnline} />;
  if (isCode) return <CodePreviewer file={file} />;

  return <GenericPreviewer file={file} />;
};

const WordPreviewer: React.FC<{
  file: FileData;
  isBackendOnline?: boolean | null;
}> = ({ file, isBackendOnline }) => {
  const [pdfFile, setPdfFile] = useState<FileData | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fallbackToHtml = async (reason?: string) => {
      if (reason && !cancelled) setNote(reason);
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) setHtmlContent(result.value);
      } catch {
        if (!cancelled) {
          setHtmlContent(
            "<div class='p-12 text-center text-red-500 font-bold'>Word preview unavailable for this file.</div>",
          );
        }
      }
    };

    const load = async () => {
      setIsLoading(true);
      setPdfFile(null);
      setHtmlContent("");
      setNote(null);

      if (isBackendOnline !== false) {
        try {
          const formData = new FormData();
          formData.append("file", file.blob, file.name);
          const response = await fetch(`${API_BASE}/office-to-pdf`, {
            method: "POST",
            body: formData,
          });
          if (!response.ok) throw new Error("conversion failed");
          const converted = await response.blob();
          if (cancelled) return;

          setPdfFile({
            id: `${file.id}-word-pdf`,
            name: `${file.name.replace(/\.[^.]+$/, "")}.pdf`,
            size: converted.size,
            type: "application/pdf",
            blob: converted,
          });
          setIsLoading(false);
          return;
        } catch {
          await fallbackToHtml("Paged preview unavailable. Showing text fallback.");
          if (!cancelled) setIsLoading(false);
          return;
        }
      }

      await fallbackToHtml("Engine is offline. Showing text fallback.");
      if (!cancelled) setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [file, isBackendOnline]);

  if (pdfFile) {
    return (
      <PDFPreviewer
        file={pdfFile}
        showDeleteOnPages={false}
        rotations={EMPTY_ROTATIONS}
        showPageNavigator
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-200 overflow-hidden relative">
      <div className="h-14 bg-white border-b border-slate-300 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
            <FileText size={16} />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest truncate max-w-[220px]">
            {file.name}
          </span>
        </div>
        {note && (
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">
            {note}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-200/50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-blue-600" size={34} />
          </div>
        ) : (
          <div className="max-w-[8.5in] mx-auto bg-white shadow-2xl p-[1in] border border-slate-300 word-content-container paper-effect">
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        )}
      </div>
    </div>
  );
};

const ExcelPreviewer: React.FC<{ file: FileData }> = ({ file }) => {
  const [sheets, setSheets] = useState<Record<string, string>>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = async () => {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const results: Record<string, string> = {};
        workbook.SheetNames.forEach((name) => {
          results[name] = XLSX.utils.sheet_to_html(workbook.Sheets[name]);
        });
        setSheets(results);
        setSheetNames(workbook.SheetNames);
        setActiveSheet(workbook.SheetNames[0]);
      } catch (err) {
      } finally {
        setIsLoading(false);
      }
    };
    read();
  }, [file]);

  const handleTabsWheel = (e: React.WheelEvent) => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-200 overflow-hidden relative">
      <div className="h-14 bg-white border-b border-slate-300 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div
          ref={tabsScrollRef}
          onWheel={handleTabsWheel}
          className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth pr-8"
        >
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => setActiveSheet(name)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap border transition-all ${
                activeSheet === name
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:text-emerald-600 hover:border-emerald-200"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4 border-l border-slate-100 pl-4">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 shadow-sm">
            <FileSpreadsheet size={16} />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest max-w-[150px] truncate">
            {file.name}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-12 bg-slate-200/50 flex justify-center custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center mt-20 gap-4">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
              Parsing Workbook...
            </span>
          </div>
        ) : (
          <div
            className="bg-white shadow-2xl rounded-sm p-8 min-w-max border border-slate-300 excel-content-container h-fit"
            dangerouslySetInnerHTML={{ __html: sheets[activeSheet] || "" }}
          />
        )}
      </div>
    </div>
  );
};

const PDFPreviewer: React.FC<{
  file: FileData;
  showDeleteOnPages: boolean;
  onPageAction?: (n: number) => void;
  rotations: Record<number, number>;
  showPageNavigator?: boolean;
  outlineItems?: PageOutlineItem[];
}> = ({
  file,
  showDeleteOnPages,
  onPageAction,
  rotations,
  showPageNavigator = false,
  outlineItems = [],
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const renderCycleRef = useRef(0);
  const renderDelayRef = useRef<number | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [sidebarMode, setSidebarMode] = useState<"pages" | "outline">("pages");
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setSidebarMode(outlineItems.length > 0 ? "outline" : "pages");
  }, [file.id, outlineItems.length]);

  const cleanupTasks = () => {
    if (renderDelayRef.current !== null) {
      window.clearTimeout(renderDelayRef.current);
      renderDelayRef.current = null;
    }
    renderTasksRef.current.forEach((task) => {
      try {
        task.cancel();
      } catch (e) {}
    });
    renderTasksRef.current.clear();
  };

  const renderPages = useCallback(async () => {
    if (!file) return;
    const cycleId = ++renderCycleRef.current;
    cleanupTasks();
    setIsLoading(true);
    try {
      const arrayBuffer = await file.blob.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (cycleId !== renderCycleRef.current) return;
      setNumPages(pdf.numPages);
      const heights: number[] = [];
      const globalRot = rotations[-1] || 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({
          scale: zoom,
          rotation: (rotations?.[i] || 0) + globalRot,
        });
        heights.push(viewport.height);
      }
      if (cycleId !== renderCycleRef.current) return;
      setPageHeights(heights);
      renderDelayRef.current = window.setTimeout(async () => {
        if (cycleId !== renderCycleRef.current) return;
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cycleId !== renderCycleRef.current) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({
            scale: zoom,
            rotation: (rotations?.[i] || 0) + globalRot,
          });
          const canvas = document.getElementById(
            `canvas-${file.id}-${i}`,
          ) as HTMLCanvasElement;
          const textLayerDiv = document.getElementById(`text-${file.id}-${i}`);
          if (canvas) {
            const context = canvas.getContext("2d");
            if (!context) continue;
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            const renderTask = page.render({
              canvasContext: context,
              viewport,
              canvas,
            });
            renderTasksRef.current.set(i, renderTask);
            try {
              await renderTask.promise;
              if (textLayerDiv) {
                textLayerDiv.innerHTML = "";
                textLayerDiv.style.width = `${viewport.width}px`;
                textLayerDiv.style.height = `${viewport.height}px`;
                textLayerDiv.style.setProperty(
                  "--total-scale-factor",
                  zoom.toString(),
                );

                const textContent = await page.getTextContent();
                const textLayer = new pdfjsLib.TextLayer({
                  textContentSource: textContent,
                  container: textLayerDiv,
                  viewport,
                });
                await textLayer.render();
              }
            } catch (err: any) {}
          }
        }
        if (cycleId === renderCycleRef.current) {
          setIsLoading(false);
        }
        renderDelayRef.current = null;
      }, 50);
    } catch (err) {
      if (cycleId === renderCycleRef.current) {
        setIsLoading(false);
      }
    }
  }, [file, zoom, rotations]);

  useEffect(() => {
    renderPages();
    return () => {
      renderCycleRef.current += 1;
      cleanupTasks();
    };
  }, [renderPages]);

  useEffect(() => {
    if (!showPageNavigator) {
      setThumbnails([]);
      return;
    }
    let cancelled = false;
    const loadThumbnails = async () => {
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        const globalRot = rotations[-1] || 0;
        const nextThumbs: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({
            scale: 0.2,
            rotation: (rotations?.[i] || 0) + globalRot,
          });
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(viewport.width, 200);
          canvas.height = Math.min(viewport.height, 280);
          const ctx = canvas.getContext("2d", { willReadFrequently: false });
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          nextThumbs.push(canvas.toDataURL("image/jpeg", 0.7));
          // Free canvas memory explicitly
          canvas.width = 0;
          canvas.height = 0;
        }
        if (!cancelled) setThumbnails(nextThumbs);
      } catch {
        if (!cancelled) setThumbnails([]);
      }
    };
    loadThumbnails();
    return () => {
      cancelled = true;
    };
  }, [file, rotations, showPageNavigator]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop + 150;
    let accumulated = 0;
    for (let i = 0; i < pageHeights.length; i++) {
      accumulated += pageHeights[i] + 40;
      if (scrollTop < accumulated) {
        setCurrentPage(i + 1);
        break;
      }
    }
  };

  const jumpToPage = (p: number, yRatio?: number) => {
    const target = pageRefs.current[p - 1];
    if (target && scrollRef.current)
      scrollRef.current.scrollTo({
        top:
          target.offsetTop -
          40 +
          (typeof yRatio === "number"
            ? Math.max(0, Math.floor((pageHeights[p - 1] || 0) * yRatio) - 20)
            : 0),
        behavior: "smooth",
      });
  };

  return (
    <div className="flex flex-col h-full bg-slate-200 overflow-hidden relative">
      <div className="h-14 bg-white border-b border-slate-300 flex items-center justify-between px-6 shrink-0 z-40 shadow-sm">
        <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-inner">
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
            className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
          >
            <ZoomOut size={16} />
          </button>
          <span className="px-3 text-[11px] font-black text-slate-400 w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
            className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            disabled={currentPage <= 1}
            onClick={() => jumpToPage(currentPage - 1)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-20 transition-all shadow-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center justify-center min-w-[36px] h-8 bg-white border-2 border-indigo-600 rounded-lg text-indigo-700 font-black text-sm shadow-sm">
            {currentPage}
          </div>
          <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            of {numPages}
          </span>
          <button
            disabled={currentPage >= numPages}
            onClick={() => jumpToPage(currentPage + 1)}
            className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-white disabled:opacity-20 transition-all shadow-sm"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600 shadow-sm">
            <FileIcon size={16} />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest truncate max-w-[120px]">
            {file.name}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex">
        {showPageNavigator && (
          <aside className="w-44 shrink-0 bg-white border-r border-slate-200 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {outlineItems.length > 0 && (
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-100 border border-slate-200">
                <button
                  onClick={() => setSidebarMode("outline")}
                  className={`text-[10px] font-black uppercase tracking-wider rounded-md px-2 py-1.5 transition-all ${sidebarMode === "outline" ? "bg-white text-indigo-700 border border-indigo-100" : "text-slate-500"}`}
                >
                  Outline
                </button>
                <button
                  onClick={() => setSidebarMode("pages")}
                  className={`text-[10px] font-black uppercase tracking-wider rounded-md px-2 py-1.5 transition-all ${sidebarMode === "pages" ? "bg-white text-indigo-700 border border-indigo-100" : "text-slate-500"}`}
                >
                  Pages
                </button>
              </div>
            )}

            {sidebarMode === "outline" && outlineItems.length > 0 ? (
              <div className="space-y-1">
                {outlineItems.map((item) => {
                  const active = currentPage === item.page;
                  return (
                    <button
                      key={item.id}
                      onClick={() => jumpToPage(item.page, item.yRatio)}
                      className={`w-full text-left px-2 py-1.5 rounded-md border transition-all ${active ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                      style={{ paddingLeft: `${Math.min(20, 6 + (item.level - 1) * 8)}px` }}
                      title={`Go to page ${item.page}`}
                    >
                      <div className="text-[10px] font-semibold truncate">{item.text}</div>
                      <div className="text-[9px] font-black uppercase tracking-wide opacity-60">
                        Page {item.page}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              thumbnails.map((src, idx) => {
                const pageNum = idx + 1;
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={`${file.id}-thumb-${pageNum}`}
                    onClick={() => jumpToPage(pageNum)}
                    className={`w-full text-left rounded-lg overflow-hidden border transition-all ${isActive ? "border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.18)]" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <img src={src} alt={`Page ${pageNum}`} className="w-full block bg-white" />
                    <div className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-50">
                      Page {pageNum}
                    </div>
                  </button>
                );
              })
            )}
          </aside>
        )}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto custom-scrollbar p-12 flex flex-col items-center gap-10 scroll-smooth relative bg-slate-200/50"
        >
          {isLoading && (
            <div className="sticky top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
              <div className="bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-2xl border border-indigo-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <Loader2 className="animate-spin text-indigo-600" size={20} />
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  Rebuilding Workspace...
                </span>
              </div>
            </div>
          )}
          {Array.from({ length: numPages }).map((_, i) => (
            <div
              key={`${file.id}-pg-${i}`}
              ref={(el) => {
                pageRefs.current[i] = el;
              }}
              className="relative group"
            >
              <div
                className="bg-white shadow-2xl transition-all duration-500 paper-effect overflow-hidden"
                style={{ width: "fit-content" }}
              >
                <div className="relative">
                  <canvas
                    id={`canvas-${file.id}-${i + 1}`}
                    className="block relative z-10"
                  />
                  <div
                    id={`text-${file.id}-${i + 1}`}
                    className="textLayer"
                    style={{ pointerEvents: "auto", zIndex: 20 }}
                  />
                </div>
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all flex gap-3 z-30">
                  {showDeleteOnPages && (
                    <button
                      onClick={() => onPageAction?.(i + 1)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl shadow-xl hover:bg-red-700 transition-all active:scale-95"
                    >
                      <Trash2 size={16} />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        Mark Page
                      </span>
                    </button>
                  )}
                </div>
              </div>
              <div className="absolute top-0 -left-16 w-10 h-10 flex items-center justify-center bg-white border-2 border-slate-100 rounded-xl shadow-md font-black text-xs text-slate-500">
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ImagePreviewer: React.FC<{ file: FileData }> = ({ file }) => {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div className="h-full bg-slate-200 flex items-center justify-center p-12 overflow-y-auto relative bg-slate-200/50">
      <div className="bg-white p-5 shadow-2xl rounded-[2rem] border border-slate-100 transition-all">
        <img
          src={url}
          alt={file.name}
          className="max-w-full rounded-2xl max-h-[75vh]"
        />
      </div>
    </div>
  );
};

const CodePreviewer: React.FC<{ file: FileData }> = ({ file }) => {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    file.blob.text().then((t) => {
      setCode(t);
      setIsLoading(false);
    });
  }, [file]);

  const lines = code.split("\n");

  return (
    <div className="h-full flex flex-col bg-[#0d1117] overflow-hidden">
      <div className="h-14 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-8 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#21262d] rounded-lg flex items-center justify-center text-blue-400 shadow-inner">
            <Terminal size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
              Code Inspector
            </span>
            <span className="text-xs font-bold text-slate-100">
              {file.name}
            </span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar bg-[#0d1117]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="animate-spin text-blue-500" size={32} />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Compiling View...
            </span>
          </div>
        ) : (
          <div className="code-preview-container">
            <div className="code-line-numbers">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <pre className="code-content">
              <code>{code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

const GenericPreviewer: React.FC<{ file: FileData }> = ({ file }) => (
  <div className="h-full bg-slate-100 flex flex-col items-center justify-center p-12 text-center bg-slate-200/50">
    <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-300 mb-6 border border-slate-200">
      <FileIcon size={48} />
    </div>
    <h3 className="text-xl font-black text-slate-900 mb-2 truncate max-w-full px-4">
      {file.name}
    </h3>
    <p className="text-slate-500 text-sm max-w-xs">No preview available.</p>
  </div>
);

const ZipPreviewer: React.FC<{ file: FileData }> = ({ file }) => {
  const [zip, setZip] = useState<JSZip | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [items, setItems] = useState<
    { name: string; isFolder: boolean; fullPath: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadZip = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const loadedZip = await JSZip.loadAsync(file.blob);
        setZip(loadedZip);
        setCurrentPath("");
      } catch (err) {
        setError("Could not parse zip file structure.");
      } finally {
        setIsLoading(false);
      }
    };
    loadZip();
  }, [file]);

  useEffect(() => {
    if (!zip) {
      setItems([]);
      return;
    }

    const paths = Object.keys(zip.files);
    const folderSet = new Set<string>();
    const fileList: { name: string; fullPath: string }[] = [];

    paths.forEach((path) => {
      if (currentPath === "") {
        const parts = path.split("/").filter((p) => p !== "");
        if (parts.length > 1) folderSet.add(parts[0]);
        else if (parts.length === 1) fileList.push({ name: parts[0], fullPath: path });
      } else if (path.startsWith(currentPath) && path !== currentPath) {
        const relative = path.substring(currentPath.length);
        const parts = relative.split("/").filter((p) => p !== "");
        if (parts.length > 1) folderSet.add(parts[0]);
        else if (parts.length === 1) {
          if (path.endsWith("/")) folderSet.add(parts[0]);
          else fileList.push({ name: parts[0], fullPath: path });
        }
      }
    });

    const renderedItems = [
      ...Array.from(folderSet).map((f) => ({
        name: f,
        isFolder: true,
        fullPath: currentPath + f + "/",
      })),
      ...fileList.map((f) => ({
        name: f.name,
        isFolder: false,
        fullPath: f.fullPath,
      })),
    ];

    renderedItems.sort((a, b) =>
      a.isFolder === b.isFolder
        ? a.name.localeCompare(b.name)
        : a.isFolder
          ? -1
          : 1,
    );
    setItems(renderedItems);
  }, [zip, currentPath]);

  const breadcrumbs = currentPath.split("/").filter((p) => p !== "");
  const goBack = () => {
    const parts = currentPath.split("/").filter((p) => p !== "");
    parts.pop();
    setCurrentPath(parts.length > 0 ? parts.join("/") + "/" : "");
  };

  const jumpToBreadcrumb = (index: number) => {
    const parts = currentPath.split("/").filter((p) => p !== "");
    const newParts = parts.slice(0, index + 1);
    setCurrentPath(newParts.join("/") + (newParts.length > 0 ? "/" : ""));
  };

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            <Search size={16} />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest truncate max-w-[340px]">
            {file.name}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-5 gap-4">
        <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setCurrentPath("")}
            className={`p-2 rounded-lg border transition-all ${currentPath === "" ? "bg-amber-600 border-amber-600 text-white" : "bg-white border-slate-200 text-slate-400 hover:text-amber-600"}`}
          >
            <HardDrive size={14} />
          </button>

          {breadcrumbs.map((part, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight size={10} className="text-slate-300 shrink-0" />
              <button
                onClick={() => jumpToBreadcrumb(idx)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-amber-600 whitespace-nowrap px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm"
              >
                {part}
              </button>
            </React.Fragment>
          ))}

          {currentPath !== "" && (
            <button
              onClick={goBack}
              className="ml-auto px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider"
            >
              Back
            </button>
          )}
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-y-auto custom-scrollbar p-3">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="animate-spin text-amber-500" size={24} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Hydrating Catalog...
              </span>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-rose-600 text-sm font-semibold">
              {error}
            </div>
          ) : items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => item.isFolder && setCurrentPath(item.fullPath)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all group cursor-pointer ${item.isFolder ? "bg-amber-50/20 border-amber-100 hover:border-amber-300" : "bg-white border-slate-100 hover:border-slate-300"}`}
                >
                  <div
                    className={`p-1.5 rounded-lg border shadow-sm transition-colors ${item.isFolder ? "bg-amber-100 border-amber-200 text-amber-600" : "bg-white border-slate-200 text-slate-400 group-hover:text-amber-500"}`}
                  >
                    {item.isFolder ? <Folder size={12} /> : <FileText size={12} />}
                  </div>
                  <span
                    className={`text-[11px] font-medium truncate transition-colors ${item.isFolder ? "text-slate-900 font-bold" : "text-slate-600 group-hover:text-slate-900"}`}
                  >
                    {item.name}
                  </span>
                  {item.isFolder && (
                    <ChevronRight
                      size={12}
                      className="ml-auto text-amber-400 opacity-0 group-hover:opacity-100 transition-all"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Hash size={32} className="text-slate-100 mb-3" />
              <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
                No entries in this scope
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PPTPreviewer: React.FC<{
  file: FileData;
  isBackendOnline?: boolean | null;
}> = ({ file, isBackendOnline }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [numSlides, setNumSlides] = useState(0);
  const [activeSlide, setActiveSlide] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [stageSize, setStageSize] = useState({ width: 960, height: 540 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;

    const updateSize = () => {
      const w = Math.max(420, Math.floor(host.clientWidth - 64));
      const h = Math.max(260, Math.floor(host.clientHeight - 64));
      const ratio = 16 / 9;
      let nextW = w;
      let nextH = Math.floor(nextW / ratio);
      if (nextH > h) {
        nextH = h;
        nextW = Math.floor(nextH * ratio);
      }
      setStageSize({ width: nextW, height: nextH });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setThumbnails([]);
      setActiveSlide(1);

      if (isBackendOnline === false) {
        setError("Engine is offline. Start backend to preview PowerPoint accurately.");
        setIsLoading(false);
        return;
      }

      try {
        const formData = new FormData();
        formData.append("file", file.blob, file.name);
        const response = await fetch(`${API_BASE}/office-to-pdf`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error("Could not convert PPT for preview.");
        }

        const pdfBlob = await response.blob();
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        setPdf(loadedPdf);
        setNumSlides(loadedPdf.numPages);

        const thumbs: string[] = [];
        for (let i = 1; i <= loadedPdf.numPages; i++) {
          const page = await loadedPdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.2 });
          const thumbCanvas = document.createElement("canvas");
          thumbCanvas.width = viewport.width;
          thumbCanvas.height = viewport.height;
          const ctx = thumbCanvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport, canvas: thumbCanvas }).promise;
          thumbs.push(thumbCanvas.toDataURL("image/jpeg", 0.82));
        }
        if (!cancelled) setThumbnails(thumbs);
      } catch (e) {
        if (!cancelled) {
          setError("PowerPoint preview unavailable. Ensure backend conversion is ready.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [file, isBackendOnline]);

  useEffect(() => {
    let cancelled = false;
    const renderActive = async () => {
      if (isLoading || !pdf || !canvasRef.current) return;
      const page = await pdf.getPage(activeSlide);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = Math.min(
        stageSize.width / baseViewport.width,
        stageSize.height / baseViewport.height,
      );
      const renderScale = Math.max(0.05, fitScale * zoom);
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      if (cancelled) return;
    };
    renderActive();
    return () => {
      cancelled = true;
    };
  }, [isLoading, pdf, activeSlide, zoom, stageSize]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      setActiveSlide((prev) =>
        e.key === "ArrowUp"
          ? Math.max(1, prev - 1)
          : Math.min(Math.max(1, numSlides), prev + 1),
      );
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [numSlides]);

  return (
    <div className="h-full flex flex-col bg-slate-100 overflow-hidden">
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
            <Presentation size={16} />
          </div>
          <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest truncate max-w-[380px]">
            {file.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-[10px] font-bold text-slate-500 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="w-44 bg-white border-r border-slate-200 overflow-y-auto custom-scrollbar p-3 space-y-3">
          {thumbnails.map((src, idx) => {
            const slideNum = idx + 1;
            const active = slideNum === activeSlide;
            return (
              <button
                key={slideNum}
                onClick={() => setActiveSlide(slideNum)}
                className={`w-full text-left rounded-lg overflow-hidden border transition-all ${active ? "border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]" : "border-slate-200 hover:border-slate-300"}`}
              >
                <img src={src} alt={`Slide ${slideNum}`} className="w-full block" />
                <div className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-50">
                  Slide {slideNum}
                </div>
              </button>
            );
          })}
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="h-12 px-4 bg-white border-b border-slate-200 flex items-center justify-center gap-4">
            <button
              onClick={() => setActiveSlide((p) => Math.max(1, p - 1))}
              disabled={activeSlide <= 1}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
              Slide {activeSlide} of {numSlides}
            </span>
            <button
              onClick={() => setActiveSlide((p) => Math.min(numSlides, p + 1))}
              disabled={activeSlide >= numSlides}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div
            ref={stageHostRef}
            className="flex-1 overflow-auto custom-scrollbar p-8 bg-slate-100/70 flex items-start justify-center"
          >
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 mt-16">
                <Loader2 className="animate-spin text-amber-500" size={28} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Rendering slides...
                </span>
              </div>
            ) : error ? (
              <div className="mt-16 px-5 py-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold">
                {error}
              </div>
            ) : (
              <div
                className="relative bg-slate-200/70 border border-slate-300 rounded-md shadow-inner flex items-center justify-center"
                style={{ width: `${stageSize.width}px`, height: `${stageSize.height}px` }}
              >
                <canvas
                  ref={canvasRef}
                  className="block shadow-2xl bg-white rounded-sm"
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
