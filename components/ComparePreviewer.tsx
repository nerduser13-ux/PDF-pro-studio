import React, { useMemo } from "react";
import { ComparisonResult, DiffType, FileData, DiffPart } from "../types";
import { Layout, Activity, BarChart2, FileText, Lock } from "lucide-react";
import { SyncScrollContainer } from "./SyncScrollContainer";

interface ComparePreviewerProps {
  fileA: FileData;
  fileB: FileData;
  comparisonResult: ComparisonResult | null;
}

export const ComparePreviewer: React.FC<ComparePreviewerProps> = ({
  fileA,
  fileB,
  comparisonResult,
}) => {
  // Helper to convert tokens into a single HTML string with diff highlights
  const renderDiffToHtml = (parts: DiffPart[]) => {
    let html = "";
    parts.forEach((part) => {
      const val = part.value;
      const isTag = val.startsWith("<") && val.endsWith(">");

      if (isTag) {
        // Render document structural tags as-is
        html += val;
      } else {
        // Wrap text tokens in diff spans
        if (part.type === DiffType.REMOVED) {
          html += `<span class="diff-removed">${val}</span>`;
        } else if (part.type === DiffType.ADDED) {
          html += `<span class="diff-added">${val}</span>`;
        } else {
          // Highlight similar content (Equal parts in LCS)
          html += `<span class="diff-similar">${val}</span>`;
        }
      }
    });
    return html;
  };

  const leftHtml = useMemo(
    () =>
      comparisonResult ? renderDiffToHtml(comparisonResult.leftParts) : "",
    [comparisonResult],
  );
  const rightHtml = useMemo(
    () =>
      comparisonResult ? renderDiffToHtml(comparisonResult.rightParts) : "",
    [comparisonResult],
  );

  if (!comparisonResult) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-6">
          <Layout className="w-10 h-10 text-slate-200" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2 tracking-tight">
          Audit Workbench
        </h3>
        <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
          Select two documents in the inspector to run a structural redline
          analysis with frame-locked X/Y synchronization.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden relative">
      {/* Header Info Bar */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100">
              <Layout size={18} />
            </div>
            <div>
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                IntelliDiff Audit
              </h2>
              <div className="flex items-center gap-2">
                <Lock size={10} className="text-emerald-500" />
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                  Locked Bi-Directional Sync
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg shadow-sm">
            <BarChart2 size={12} className="text-rose-400" />
            <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">
              {comparisonResult.deletionCount} Removals
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg shadow-sm">
            <BarChart2 size={12} className="text-emerald-400" />
            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">
              {comparisonResult.additionCount} Additions
            </span>
          </div>
        </div>
      </div>

      {/* Sync Scroll Container */}
      <SyncScrollContainer>
        {(leftRef, rightRef) => (
          <div className="flex-1 flex overflow-hidden divide-x divide-slate-200">
            {/* Left Column: Version A */}
            <div
              ref={leftRef}
              className="flex-1 overflow-auto bg-slate-50/40 p-12 custom-scrollbar"
            >
              <div className="max-w-[8.5in] mx-auto bg-white p-[0.75in] shadow-2xl border border-slate-200 min-h-[11in] rounded-sm paper-effect font-serif text-[15px] leading-[1.6] relative word-content-container">
                <div className="sticky top-[-0.75in] left-[-0.75in] right-[-0.75in] bg-white/95 backdrop-blur-sm flex justify-between items-center mb-10 pb-4 border-b border-slate-100 z-10 p-4">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400" />
                    <span className="text-slate-400 font-bold truncate text-[10px] uppercase tracking-wide max-w-[200px]">
                      {fileA.name}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-black rounded uppercase tracking-widest border border-slate-200">
                    Version A (Redline)
                  </span>
                </div>
                <div
                  className="text-slate-800"
                  dangerouslySetInnerHTML={{ __html: leftHtml }}
                />
              </div>
            </div>

            {/* Right Column: Version B */}
            <div
              ref={rightRef}
              className="flex-1 overflow-auto bg-slate-50/40 p-12 custom-scrollbar"
            >
              <div className="max-w-[8.5in] mx-auto bg-white p-[0.75in] shadow-2xl border border-slate-200 min-h-[11in] rounded-sm paper-effect font-serif text-[15px] leading-[1.6] relative word-content-container">
                <div className="sticky top-[-0.75in] left-[-0.75in] right-[-0.75in] bg-white/95 backdrop-blur-sm flex justify-between items-center mb-10 pb-4 border-b border-slate-100 z-10 p-4">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400" />
                    <span className="text-slate-400 font-bold truncate text-[10px] uppercase tracking-wide max-w-[200px]">
                      {fileB.name}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-black rounded uppercase tracking-widest border border-slate-200">
                    Version B (Revised)
                  </span>
                </div>
                <div
                  className="text-slate-800"
                  dangerouslySetInnerHTML={{ __html: rightHtml }}
                />
              </div>
            </div>
          </div>
        )}
      </SyncScrollContainer>

      {/* Footer Legend */}
      <footer className="bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-emerald-100 border border-emerald-300 rounded shadow-sm"></span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Additions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-rose-100 border border-rose-300 rounded shadow-sm"></span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Removals
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-slate-50 border border-slate-200 rounded shadow-sm"></span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Similar (Verified)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Activity size={14} className="text-indigo-400" />
        </div>
      </footer>
    </div>
  );
};
