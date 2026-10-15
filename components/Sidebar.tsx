import React from "react";
import { ToolType } from "../types";
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
  Eye,
  Combine,
  FileUp,
  Search,
  FileType,
  ScanText,
  PanelLeftClose,
  PanelLeftOpen,
  Network,
} from "lucide-react";

interface SidebarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTool,
  onToolChange,
  collapsed,
  onToggleCollapse,
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
        {
          id: "diagram",
          label: "Diagram Studio",
          icon: Network,
          color: "text-cyan-500",
        },
      ],
    },
    {
      title: "Office Suite tools",
      items: [
        {
          id: "word-viewer",
          label: "File Viewer",
          icon: Eye,
          color: "text-blue-600",
        },
        {
          id: "word-merge",
          label: "Merge Word",
          icon: Combine,
          color: "text-blue-700",
        },
        {
          id: "ppt-merge",
          label: "Merge PPT",
          icon: FileUp,
          color: "text-amber-600",
        },
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
          id: "word-to-pdf",
          label: "Word to PDF",
          icon: FileType,
          color: "text-blue-600",
        },
        {
          id: "ppt-to-pdf",
          label: "PPT to PDF",
          icon: FileType,
          color: "text-orange-600",
        },
        {
          id: "excel-to-pdf",
          label: "Excel to PDF",
          icon: FileType,
          color: "text-emerald-600",
        },
      ],
    },
    {
      title: "Utilities",
      items: [
        {
          id: "zip-viewer",
          label: "Zip Explorer",
          icon: Search,
          color: "text-amber-600",
        },
        {
          id: "zip",
          label: "Zip Creator",
          icon: Archive,
          color: "text-amber-600",
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
        {
          id: "img2text",
          label: "Image to Text",
          icon: ScanText,
          color: "text-emerald-500",
        },
      ],
    },
  ];

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-64"} bg-slate-900 h-full flex flex-col shrink-0 transition-all duration-200`}
    >
      <div
        className={`${collapsed ? "p-3" : "p-6"} flex items-center ${collapsed ? "justify-center" : "gap-3"} relative`}
      >
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <FileCode size={24} strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div>
            <h2 className="text-white font-bold text-lg leading-tight">
              PDF Pro
            </h2>
            <p className="text-slate-400 text-xs font-medium">Python Engine</p>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`absolute ${collapsed ? "-right-3 top-4 bg-slate-800 border border-slate-700" : "right-3 top-6"} p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-all`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <nav
        className={`flex-1 ${collapsed ? "px-2 mt-2" : "px-4 mt-4"} space-y-6 overflow-y-auto custom-scrollbar`}
      >
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
            {!collapsed && (
              <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTool === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onToolChange(item.id as ToolType)}
                    className={`w-full flex items-center ${collapsed ? "justify-center" : "gap-3"} ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                    title={item.label}
                  >
                    <Icon
                      size={18}
                      className={isActive ? "text-white" : item.color}
                    />
                    {!collapsed && (
                      <span className="font-medium text-sm">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={`${collapsed ? "p-2" : "p-4"} border-t border-slate-800`}>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
          <Settings size={20} />
          {!collapsed && <span className="font-medium text-sm">Engine Settings</span>}
        </button>
      </div>
    </aside>
  );
};
