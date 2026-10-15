import React from "react";
import { ToolType } from "./types";
import {
  FileStack,
  Scissors,
  Image as ImageIcon,
  Diff,
  FileText,
  Settings,
  FileCode,
  RotateCw,
  Archive,
  Layers,
  Eraser,
  FileSpreadsheet,
  Presentation,
  ShieldCheck,
  FileSearch,
  PenTool,
  Signature,
} from "lucide-react";

interface SidebarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTool,
  onToolChange,
}) => {
  const sections = [
    {
      title: "PDF Manipulation",
      items: [
        {
          id: "edit",
          label: "Edit PDF",
          icon: PenTool,
          color: "text-indigo-500",
        },
        {
          id: "sign",
          label: "Sign PDF",
          icon: Signature,
          color: "text-rose-500",
        },
        {
          id: "merge",
          label: "Merge PDF",
          icon: FileStack,
          color: "text-blue-600",
        },
        {
          id: "split",
          label: "Split PDF",
          icon: Scissors,
          color: "text-orange-600",
        },
        {
          id: "remove-pages",
          label: "Remove Pages",
          icon: Eraser,
          color: "text-red-500",
        },
        {
          id: "extract-pages",
          label: "Extract Pages",
          icon: FileSearch,
          color: "text-emerald-500",
        },
        {
          id: "rotate",
          label: "Rotate PDF",
          icon: RotateCw,
          color: "text-indigo-600",
        },
        {
          id: "compare",
          label: "Compare PDF",
          icon: Diff,
          color: "text-purple-600",
        },
      ],
    },
    {
      title: "Conversions",
      items: [
        {
          id: "word",
          label: "PDF to Word",
          icon: FileText,
          color: "text-blue-500",
        },
        {
          id: "pptx",
          label: "PDF to PowerPoint",
          icon: Presentation,
          color: "text-amber-600",
        },
        {
          id: "excel",
          label: "PDF to Excel",
          icon: FileSpreadsheet,
          color: "text-emerald-600",
        },
        {
          id: "pdfa",
          label: "PDF to PDF/A",
          icon: ShieldCheck,
          color: "text-slate-600",
        },
        {
          id: "convert",
          label: "PDF to Image",
          icon: ImageIcon,
          color: "text-emerald-600",
        },
        {
          id: "img2pdf",
          label: "Image to PDF",
          icon: Layers,
          color: "text-pink-600",
        },
      ],
    },
    {
      title: "Utilities",
      items: [
        {
          id: "zip",
          label: "Zip Creator",
          icon: Archive,
          color: "text-amber-600",
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 h-full flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <FileCode size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">
            PDF Pro
          </h2>
          <p className="text-slate-400 text-xs font-medium">Python Engine</p>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-4 space-y-6 overflow-y-auto custom-scrollbar">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTool === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onToolChange(item.id as ToolType)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon
                      size={18}
                      className={isActive ? "text-white" : item.color}
                    />
                    <span className="font-medium text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
          <Settings size={20} />
          <span className="font-medium text-sm">Engine Settings</span>
        </button>
      </div>
    </aside>
  );
};
