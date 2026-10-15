// import React, { useState } from "react";
// import {
//   Diff,
//   AlertCircle,
//   Loader2,
//   ArrowRight,
//   Zap,
//   FileText,
// } from "lucide-react";
// import { ToolProps, DiffType, DiffPart } from "../../types";
// import * as pdfjsLib from "pdfjs-dist";
// import mammoth from "mammoth";
// import { API_BASE } from "../../App";

// export const PDFComparer: React.FC<ToolProps> = ({
//   files,
//   activeFileIndex,
//   setActiveFileIndex,
//   compareFileIndex,
//   setCompareFileIndex,
//   setComparisonResult,
//   isBackendOnline,
// }) => {
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [status, setStatus] = useState<string | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   const fileA = files[activeFileIndex];
//   const targetCompareIndex =
//     compareFileIndex ?? (activeFileIndex === 0 ? 1 : 0);
//   const fileB = files[targetCompareIndex] || files[0];

//   /**
//    * Cleans Mammoth's HTML to remove volatile attributes
//    * that cause false diffs (like unique IDs or styles).
//    */
//   const sanitizeHtmlForDiff = (html: string): string => {
//     const doc = new DOMParser().parseFromString(html, "text/html");
//     const allElements = doc.querySelectorAll("*");
//     allElements.forEach((el) => {
//       // Remove all attributes except src for images
//       const attributes = Array.from(el.attributes);
//       attributes.forEach((attr) => {
//         if (attr.name !== "src") el.removeAttribute(attr.name);
//       });
//     });
//     return doc.body.innerHTML;
//   };

//   const extractRichText = async (
//     file: Blob,
//     fileName: string,
//   ): Promise<string> => {
//     if (!file || !fileName) return "";
//     const ext = fileName.split(".").pop()?.toLowerCase();

//     // --- PDF EXTRACTION ---
//     if (ext === "pdf") {
//       if (isBackendOnline) {
//         setStatus(`Indexing ${fileName} via Engine...`);
//         try {
//           const formData = new FormData();
//           formData.append("file", file);
//           const response = await fetch(`${API_BASE}/pdf-to-word`, {
//             method: "POST",
//             body: formData,
//           });

//           if (response.ok) {
//             const docxBlob = await response.blob();
//             const docxBuffer = await docxBlob.arrayBuffer();
//             const res = await mammoth.convertToHtml({
//               arrayBuffer: docxBuffer,
//             });
//             return sanitizeHtmlForDiff(res.value);
//           }
//         } catch (e) {
//           console.warn("Backend extraction failed, falling back to local.");
//         }
//       }

//       setStatus(`Parsing ${fileName} (Local PDF)...`);
//       const buffer = await file.arrayBuffer();
//       const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
//       let html = "";

//       for (let i = 1; i <= pdf.numPages; i++) {
//         setStatus(`Indexing ${fileName}: Page ${i}/${pdf.numPages}`);
//         const page = await pdf.getPage(i);
//         const textContent = await page.getTextContent();
//         const lines: Record<number, any[]> = {};

//         textContent.items.forEach((item: any) => {
//           const y = Math.round(item.transform[5]);
//           if (!lines[y]) lines[y] = [];
//           lines[y].push(item);
//         });

//         const sortedY = Object.keys(lines)
//           .map(Number)
//           .sort((a, b) => b - a);
//         html += `<div class="pdf-page-marker">Page ${i}</div>`;

//         sortedY.forEach((y) => {
//           const lineItems = lines[y].sort(
//             (a, b) => a.transform[4] - b.transform[4],
//           );
//           const lineText = lineItems.map((it) => it.str).join(" ");
//           const avgHeight = lineItems[0]?.height || 10;
//           if (lineText.trim()) {
//             if (avgHeight > 16) html += `<h3>${lineText}</h3>`;
//             else html += `<p>${lineText}</p>`;
//           }
//         });
//       }
//       return html;
//     }

//     // --- WORD EXTRACTION (.docx, .doc) ---
//     else if (ext === "docx" || ext === "doc") {
//       if (ext === "doc") {
//         if (!isBackendOnline) {
//           throw new Error(
//             "Legacy .doc files require the Python Engine to be online for auditing.",
//           );
//         }
//         setStatus(`Converting legacy .doc: ${fileName}...`);
//         // We reuse office-to-pdf then parse the PDF as a workaround for legacy binary .doc
//         const formData = new FormData();
//         formData.append("file", file);
//         const response = await fetch(`${API_BASE}/office-to-pdf`, {
//           method: "POST",
//           body: formData,
//         });
//         if (!response.ok)
//           throw new Error("Backend could not process legacy Word file.");
//         const pdfBlob = await response.blob();
//         return extractRichText(pdfBlob, fileName.replace(".doc", ".pdf"));
//       }

//       setStatus(`Reconstructing ${fileName}...`);
//       try {
//         const buffer = await file.arrayBuffer();
//         const res = await mammoth.convertToHtml({ arrayBuffer: buffer });
//         return sanitizeHtmlForDiff(res.value);
//       } catch (err) {
//         console.error("Mammoth failed", err);
//         throw new Error(
//           `Local Word reconstruction failed for ${fileName}. Ensure it is a valid .docx file.`,
//         );
//       }
//     }

//     throw new Error(`Format .${ext} not supported for logical audit.`);
//   };

//   const computeRichDiff = (oldHtml: string, newHtml: string) => {
//     // Improved tokenization: Keep tags separate from text tokens to preserve structure
//     const tokenRegex = /(<[^>]+>|[^\s<>]+|\s+)/g;
//     const oldTokens = oldHtml.match(tokenRegex) || [];
//     const newTokens = newHtml.match(tokenRegex) || [];

//     const n = oldTokens.length,
//       m = newTokens.length;

//     // Check complexity limit
//     if (n * m > 50000000) {
//       throw new Error(
//         "Documents are too large for structural audit. Please use smaller files.",
//       );
//     }

//     const dp: number[][] = Array.from({ length: n + 1 }, () =>
//       Array(m + 1).fill(0),
//     );

//     for (let i = 1; i <= n; i++) {
//       for (let j = 1; j <= m; j++) {
//         if (oldTokens[i - 1] === newTokens[j - 1])
//           dp[i][j] = dp[i - 1][j - 1] + 1;
//         else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
//       }
//     }

//     const left: DiffPart[] = [],
//       right: DiffPart[] = [];
//     let i = n,
//       j = m,
//       additions = 0,
//       deletions = 0;

//     while (i > 0 || j > 0) {
//       if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
//         const val = oldTokens[i - 1];
//         left.unshift({ type: DiffType.EQUAL, value: val });
//         right.unshift({ type: DiffType.EQUAL, value: val });
//         i--;
//         j--;
//       } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
//         const val = newTokens[j - 1];
//         right.unshift({ type: DiffType.ADDED, value: val });
//         if (!val.startsWith("<") && val.trim()) additions++;
//         j--;
//       } else {
//         const val = oldTokens[i - 1];
//         left.unshift({ type: DiffType.REMOVED, value: val });
//         if (!val.startsWith("<") && val.trim()) deletions++;
//         i--;
//       }
//     }
//     return { left, right, additions, deletions };
//   };

//   const handleRunAudit = async () => {
//     if (!fileA || !fileB) {
//       setError(
//         "Two documents are required in the workspace to perform an audit.",
//       );
//       return;
//     }
//     if (fileA.id === fileB.id) {
//       setError("Select two different documents to compare.");
//       return;
//     }

//     setIsProcessing(true);
//     setError(null);
//     setStatus("Initiating Logical Audit...");
//     try {
//       const [richA, richB] = await Promise.all([
//         extractRichText(fileA.blob, fileA.name),
//         extractRichText(fileB.blob, fileB.name),
//       ]);

//       setStatus("Analyzing Structural Variances...");
//       const { left, right, additions, deletions } = computeRichDiff(
//         richA,
//         richB,
//       );

//       setComparisonResult?.({
//         leftParts: left,
//         rightParts: right,
//         additionCount: additions,
//         deletionCount: deletions,
//       });
//       setStatus(null);
//     } catch (err: any) {
//       setError(err.message || "Audit failed during reconstruction.");
//       setStatus(null);
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   return (
//     <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
//       <div className="flex items-center gap-4 mb-8">
//         <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
//           <Diff size={24} />
//         </div>
//         <div className="min-w-0 flex-1">
//           <h3 className="text-lg font-black text-slate-900 tracking-tight">
//             Logical Auditor
//           </h3>
//           <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
//             Redline Verification
//           </p>
//         </div>
//       </div>

//       <div className="space-y-4 mb-8">
//         <div className="space-y-1.5">
//           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
//             Base (Version A)
//           </label>
//           <div className="relative">
//             <select
//               value={activeFileIndex}
//               disabled={isProcessing}
//               onChange={(e) => setActiveFileIndex(parseInt(e.target.value))}
//               className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-purple-500/5 transition-all cursor-pointer shadow-sm"
//             >
//               {files.map((f, i) => (
//                 <option key={f.id} value={i}>
//                   {f.name}
//                 </option>
//               ))}
//             </select>
//             <FileText
//               className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400"
//               size={14}
//             />
//           </div>
//         </div>

//         <div className="flex justify-center">
//           <div className="h-8 w-px bg-slate-100 relative">
//             <ArrowRight
//               size={12}
//               className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-200 rotate-90"
//             />
//           </div>
//         </div>

//         <div className="space-y-1.5">
//           <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
//             Modified (Version B)
//           </label>
//           <div className="relative">
//             <select
//               value={targetCompareIndex}
//               disabled={isProcessing}
//               onChange={(e) => setCompareFileIndex?.(parseInt(e.target.value))}
//               className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-purple-500/5 transition-all cursor-pointer shadow-sm"
//             >
//               {files.map((f, i) => (
//                 <option key={f.id} value={i}>
//                   {f.name}
//                 </option>
//               ))}
//             </select>
//             <FileText
//               className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400"
//               size={14}
//             />
//           </div>
//         </div>
//       </div>

//       {error && (
//         <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold flex items-start gap-2 border border-red-100 shadow-sm animate-in shake-in">
//           <AlertCircle size={14} className="shrink-0 mt-0.5" />{" "}
//           <span>{error}</span>
//         </div>
//       )}

//       <div className="space-y-4">
//         {status && (
//           <div className="p-3 rounded-lg text-[10px] font-black text-center bg-indigo-50 text-indigo-700 animate-pulse border border-indigo-100 uppercase tracking-widest">
//             {status}
//           </div>
//         )}

//         <button
//           onClick={handleRunAudit}
//           disabled={isProcessing || files.length < 2}
//           className="w-full flex items-center justify-center gap-3 py-5 bg-[#7c3aed] text-white rounded-2xl font-black shadow-xl shadow-purple-600/20 hover:bg-[#6d28d9] active:scale-[0.98] transition-all text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           {isProcessing ? (
//             <Loader2 className="animate-spin" size={18} />
//           ) : (
//             <Zap size={18} />
//           )}
//           <span>{isProcessing ? "Auditing..." : "Run Audit"}</span>
//         </button>
//       </div>
//     </div>
//   );
// };

import React, { useState } from "react";
import {
  Diff,
  AlertCircle,
  Loader2,
  ArrowRight,
  Activity,
  Zap,
  FileText,
} from "lucide-react";
import { ToolProps, DiffType, DiffPart } from "../../types";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

export const PDFComparer: React.FC<ToolProps> = ({
  files,
  activeFileIndex,
  setActiveFileIndex,
  compareFileIndex,
  setCompareFileIndex,
  setComparisonResult,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileA = files[activeFileIndex];
  const fileB = files[compareFileIndex ?? 1];

  // Extracts content while attempting to preserve basic structure
  const extractRichText = async (
    file: Blob,
    fileName: string,
  ): Promise<string> => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") {
      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Simple heuristic for headers based on item properties if needed,
        // but for now, we'll join text items.
        text += content.items.map((it: any) => it.str).join(" ") + "\n\n";
      }
      return text;
    } else if (ext === "docx" || ext === "doc") {
      const buffer = await file.arrayBuffer();
      // mammoth preserves tables, lists, and headers in HTML
      const res = await mammoth.convertToHtml({ arrayBuffer: buffer });
      return res.value;
    }
    throw new Error("Unsupported format.");
  };

  const computeRichDiff = (oldHtml: string, newHtml: string) => {
    // Tokenize by tags and words. Tags are treated as atomic tokens.
    // This regex splits by HTML tags OR word-boundaries (including whitespace)
    const tokenRegex = /(<[^>]+>|[\w']+|\s+|[^\w\s<>]+)/g;
    const oldTokens = oldHtml.match(tokenRegex) || [];
    const newTokens = newHtml.match(tokenRegex) || [];

    const n = oldTokens.length,
      m = newTokens.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () =>
      Array(m + 1).fill(0),
    );

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (oldTokens[i - 1] === newTokens[j - 1])
          dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const left: DiffPart[] = [],
      right: DiffPart[] = [];
    let i = n,
      j = m,
      additions = 0,
      deletions = 0;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
        const val = oldTokens[i - 1];
        left.unshift({ type: DiffType.EQUAL, value: val });
        right.unshift({ type: DiffType.EQUAL, value: val });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        const val = newTokens[j - 1];
        right.unshift({ type: DiffType.ADDED, value: val });
        if (!val.startsWith("<")) additions++;
        j--;
      } else {
        const val = oldTokens[i - 1];
        left.unshift({ type: DiffType.REMOVED, value: val });
        if (!val.startsWith("<")) deletions++;
        i--;
      }
    }
    return { left, right, additions, deletions };
  };

  const handleRunAudit = async () => {
    if (!fileA || !fileB) return;
    setIsProcessing(true);
    setError(null);
    try {
      const [richA, richB] = await Promise.all([
        extractRichText(fileA.blob, fileA.name),
        extractRichText(fileB.blob, fileB.name),
      ]);
      const { left, right, additions, deletions } = computeRichDiff(
        richA,
        richB,
      );

      setComparisonResult?.({
        leftParts: left,
        rightParts: right,
        additionCount: additions,
        deletionCount: deletions,
      });
    } catch (err: any) {
      setError(err.message || "Audit failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl shadow-inner">
            <Diff size={32} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              Logical Auditor
            </h3>
            <p className="text-slate-500 text-sm font-medium">
              LCS-based structural comparison.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-5 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-4 text-rose-700 text-xs font-bold leading-relaxed shadow-sm">
            <AlertCircle size={18} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-6 mb-10">
          <div className="space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Reference Document
            </span>
            <div className="relative">
              <select
                value={activeFileIndex}
                disabled={isProcessing}
                onChange={(e) => setActiveFileIndex(parseInt(e.target.value))}
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-purple-500/10 transition-all cursor-pointer shadow-sm"
              >
                {files.map((f, i) => (
                  <option key={f.id} value={i}>
                    {f.name}
                  </option>
                ))}
              </select>
              <FileText
                className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400"
                size={20}
              />
            </div>
          </div>

          <div className="flex justify-center relative py-2">
            <div className="w-px h-8 bg-slate-100" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-white rounded-full border border-slate-200 shadow-sm z-10">
              <ArrowRight className="text-slate-400" size={14} />
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Modified Version
            </span>
            <div className="relative">
              <select
                value={compareFileIndex}
                disabled={isProcessing}
                onChange={(e) =>
                  setCompareFileIndex?.(parseInt(e.target.value))
                }
                className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 appearance-none focus:outline-none focus:ring-4 focus:ring-purple-500/10 transition-all cursor-pointer shadow-sm"
              >
                {files.map((f, i) => (
                  <option key={f.id} value={i}>
                    {f.name}
                  </option>
                ))}
              </select>
              <FileText
                className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400"
                size={20}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-slate-50">
          <button
            onClick={handleRunAudit}
            disabled={
              isProcessing ||
              activeFileIndex === (compareFileIndex ?? 1) ||
              files.length < 2
            }
            className="group w-full flex items-center justify-center gap-5 py-6 bg-[#7c3aed] text-white rounded-[2rem] font-black shadow-[0_20px_40px_rgba(124,58,237,0.3)] hover:bg-[#6d28d9] active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none transition-all text-lg uppercase tracking-widest relative overflow-hidden"
          >
            <div
              className={`absolute left-8 transition-all duration-500 ${isProcessing ? "opacity-0" : "opacity-100"}`}
            >
              <Activity size={24} className="animate-pulse" />
            </div>

            <div className="flex items-center gap-3">
              {isProcessing ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                <Zap
                  size={24}
                  className="group-hover:scale-110 transition-transform"
                />
              )}
              <span>{isProcessing ? "Analyzing..." : "Audit Document"}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
