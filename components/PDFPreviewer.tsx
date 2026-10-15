import React, { useEffect, useRef, useState } from "react";
import { FileData } from "../types";
import {
  ZoomIn,
  ZoomOut,
  Loader2,
  Trash2,
  File as FileIcon,
  FileText,
  Presentation,
  Terminal,
  Cpu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import * as XLSX from "xlsx";

interface FilePreviewerProps {
  file: FileData;
  showDeleteOnPages?: boolean;
  onPageAction?: (pageNumber: number) => void;
  rotations?: Record<number, number>;
}

export const FilePreviewer: React.FC<FilePreviewerProps> = ({
  file,
  showDeleteOnPages = false,
  onPageAction,
  rotations = {},
}) => {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  const isWord = name.endsWith(".docx") || name.endsWith(".doc");
  const isExcel =
    name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
  const isPPT = name.endsWith(".pptx") || name.endsWith(".ppt");
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
  if (isWord) return <WordPreviewer file={file} />;
  if (isExcel) return <ExcelPreviewer file={file} />;
  if (isPPT) return <PPTPreviewer file={file} />;
  if (isCode) return <CodePreviewer file={file} />;

  return <GenericPreviewer file={file} />;
};

const PDFPage: React.FC<{
  pdf: any;
  pageNum: number;
  zoom: number;
  rotation: number;
  showDelete?: boolean;
  onAction?: (n: number) => void;
  isCurrent?: boolean;
  onVisible?: (n: number) => void;
}> = ({
  pdf,
  pageNum,
  zoom,
  rotation,
  showDelete,
  onAction,
  isCurrent,
  onVisible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onVisible?.(pageNum);
      },
      { threshold: 0.1 },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [pageNum, onVisible]);

  useEffect(() => {
    const render = async () => {
      if (!canvasRef.current || !textLayerRef.current) return;
      if (renderTaskRef.current) renderTaskRef.current.cancel();

      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: zoom * 1.5, rotation });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        textLayerRef.current.innerHTML = "";
        textLayerRef.current.style.width = `${viewport.width}px`;
        textLayerRef.current.style.height = `${viewport.height}px`;
        const textContent = await page.getTextContent();
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerRef.current,
          viewport,
        });
        await textLayer.render();
      } catch (err: any) {
        if (err.name !== "RenderingCancelledException") console.error(err);
      }
    };
    render();
  }, [pdf, pageNum, zoom, rotation]);

  return (
    <div
      ref={containerRef}
      className={`relative group transition-all duration-300 ${isCurrent ? "ring-4 ring-indigo-500 ring-offset-4" : "ring-1 ring-slate-300"}`}
    >
      <div className="relative bg-white shadow-2xl overflow-hidden">
        <canvas ref={canvasRef} className="block w-full h-auto" />
        <div ref={textLayerRef} className="textLayer" />
      </div>
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex gap-3 z-30">
        {showDelete && (
          <button
            onClick={() => onAction?.(pageNum)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 active:scale-95"
          >
            <Trash2 size={16} />
            <span className="text-[10px] font-black uppercase tracking-wider">
              Target Page
            </span>
          </button>
        )}
      </div>
      <div className="absolute top-0 -left-12 w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm font-black text-xs text-slate-500">
        {pageNum}
      </div>
    </div>
  );
};

const PDFPreviewer: React.FC<{
  file: FileData;
  showDeleteOnPages: boolean;
  onPageAction?: (n: number) => void;
  rotations: Record<number, number>;
}> = ({ file, showDeleteOnPages, onPageAction, rotations }) => {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(0.8);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPdf = async () => {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer })
          .promise;
        setPdf(loadedPdf);
        setNumPages(loadedPdf.numPages);
      } catch (err) {
        console.error("PDF load failure:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadPdf();
  }, [file]);

  const globalRot = rotations[-1] || 0;

  return (
    <div className="flex flex-col h-full bg-slate-200 overflow-hidden relative">
      <div className="h-14 bg-white border-b border-slate-300 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 shadow-inner">
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600"
            >
              <ZoomOut size={16} />
            </button>
            <span className="px-3 text-[11px] font-black text-slate-400 w-14 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center min-w-[36px] h-8 bg-white border-2 border-indigo-600 rounded-lg text-indigo-700 font-black text-sm shadow-sm">
            {currentPage}
          </div>
          <span className="text-slate-400 font-bold text-xs">/ {numPages}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100">
            <FileText size={16} />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest truncate max-w-[150px]">
            {file.name}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-12 flex flex-col items-center gap-12 bg-slate-200/50"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Warming Engine...
            </span>
          </div>
        ) : (
          pdf &&
          Array.from({ length: numPages }).map((_, i) => (
            <PDFPage
              key={`${file.id}-page-${i + 1}`}
              pdf={pdf}
              pageNum={i + 1}
              zoom={zoom}
              rotation={
                rotations[i + 1] !== undefined ? rotations[i + 1] : globalRot
              }
              showDelete={showDeleteOnPages}
              onAction={onPageAction}
              isCurrent={currentPage === i + 1}
              onVisible={(n) => setCurrentPage(n)}
            />
          ))
        )}
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
    <div className="h-full bg-slate-200 flex items-center justify-center p-12 overflow-y-auto">
      <div className="bg-white p-5 shadow-2xl rounded-[2rem] border border-slate-100">
        <img
          src={url}
          alt={file.name}
          className="max-w-full max-h-[75vh] rounded-2xl"
        />
      </div>
    </div>
  );
};

const WordPreviewer: React.FC<{ file: FileData }> = ({ file }) => {
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const convert = async () => {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtmlContent(result.value);
      } catch (err) {
        setHtmlContent(
          "<div class='p-12 text-center text-red-500 font-bold'>Conversion error.</div>",
        );
      } finally {
        setIsLoading(false);
      }
    };
    convert();
  }, [file]);

  return (
    <div className="flex flex-col h-full bg-slate-200 overflow-hidden">
      <div className="h-14 bg-white border-b border-slate-300 flex items-center justify-center px-6 shrink-0 z-30 shadow-sm font-black text-xs uppercase tracking-widest text-slate-400">
        Word Document Viewer
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-16 flex justify-center bg-slate-200/50">
        {isLoading ? (
          <Loader2 className="animate-spin text-blue-600 mt-20" size={48} />
        ) : (
          <div className="max-w-[8.5in] w-full flex flex-col items-center">
            {/* Paper effect applied directly to the container holding all content */}
            <div className="paper-effect word-content-container p-[1in] border border-slate-300 w-full mb-20">
              <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ExcelPreviewer: React.FC<{ file: FileData }> = ({ file }) => {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const read = async () => {
      try {
        const arrayBuffer = await file.blob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const firstSheet = workbook.SheetNames[0];
        setHtml(XLSX.utils.sheet_to_html(workbook.Sheets[firstSheet]));
      } catch (err) {
      } finally {
        setIsLoading(false);
      }
    };
    read();
  }, [file]);
  return (
    <div className="flex flex-col h-full bg-slate-200 overflow-hidden">
      <div className="h-14 bg-white border-b border-slate-300 flex items-center justify-center px-6 shrink-0 z-30 shadow-sm font-black text-xs uppercase tracking-widest text-slate-400">
        Spreadsheet Viewer
      </div>
      <div className="flex-1 overflow-auto p-12 bg-slate-200/50 flex justify-center">
        {isLoading ? (
          <Loader2 className="animate-spin mx-auto mt-20" />
        ) : (
          <div
            className="bg-white shadow-2xl rounded-sm p-12 min-w-max border border-slate-300 excel-content-container"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
};

const PPTPreviewer: React.FC<{ file: FileData }> = ({ file }) => (
  <div className="h-full flex flex-col items-center justify-center p-12 bg-slate-50">
    <Presentation size={64} className="text-amber-500 mb-4" />
    <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">
      {file.name}
    </h3>
    <p className="text-slate-400 text-sm font-medium">
      PowerPoint structure analysis is active.
    </p>
  </div>
);

const CodePreviewer: React.FC<{ file: FileData }> = ({ file }) => {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const ext = file.name.split(".").pop()?.toUpperCase();

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
        <div className="px-3 py-1 bg-[#21262d] rounded-md border border-[#30363d]">
          <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest">
            {ext || "SOURCE"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-[#0d1117]">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (
          <div className="flex min-h-full animate-in fade-in duration-500">
            <div className="code-preview-container w-full">
              <div className="code-line-numbers">
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <pre className="code-content whitespace-pre">
                <code>{code}</code>
              </pre>
            </div>
          </div>
        )}
      </div>

      <footer className="h-10 bg-[#161b22] border-t border-[#30363d] flex items-center px-8 justify-between">
        <div className="flex items-center gap-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <Cpu size={12} /> UTF-8 Engine
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Read
            Only
          </div>
          <div className="flex items-center gap-1.5">
            <FileIcon size={12} /> {lines.length} Lines
          </div>
        </div>
        <span className="text-[9px] font-bold text-slate-600 uppercase italic">
          Syntax reconstruction active
        </span>
      </footer>
    </div>
  );
};

const GenericPreviewer: React.FC<{ file: FileData }> = ({ file }) => (
  <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-slate-100">
    <div className="w-24 h-24 bg-white rounded-3xl shadow-sm flex items-center justify-center text-slate-200 mb-6 border border-slate-200">
      <FileIcon size={48} />
    </div>
    <h3 className="text-xl font-black text-slate-900 mb-2 truncate max-w-full px-4">
      {file.name}
    </h3>
    <p className="text-slate-500 text-sm">
      Visual preview unavailable for this format.
    </p>
  </div>
);
