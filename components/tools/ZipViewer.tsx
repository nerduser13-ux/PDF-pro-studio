import React, { useState, useEffect } from "react";
import { ToolProps } from "../../types";
import {
  Search,
  FolderOpen,
  FileText,
  Loader2,
  AlertCircle,
  ChevronRight,
  Hash,
  ArrowLeft,
  Folder,
  HardDrive,
} from "lucide-react";
import JSZip from "jszip";

export const ZipViewer: React.FC<ToolProps> = ({ files, activeFileIndex }) => {
  const [zip, setZip] = useState<JSZip | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [items, setItems] = useState<
    { name: string; isFolder: boolean; fullPath: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = files[activeFileIndex];
  const isZip = file?.name.toLowerCase().endsWith(".zip");

  useEffect(() => {
    const loadZip = async () => {
      if (!file || !isZip) {
        setZip(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const loadedZip = await JSZip.loadAsync(file.blob);
        setZip(loadedZip);
        setCurrentPath("");
      } catch (err) {
        setError("Could not parse zip file structure.");
        console.error(err);
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
    const fileSet = new Set<{ name: string; fullPath: string }>();

    paths.forEach((path) => {
      // Determine what to show in current directory
      if (currentPath === "") {
        const parts = path.split("/");
        if (parts.length > 1) {
          folderSet.add(parts[0]);
        } else if (path !== "") {
          fileSet.add({ name: path, fullPath: path });
        }
      } else {
        if (path.startsWith(currentPath) && path !== currentPath) {
          const relative = path.substring(currentPath.length);
          const parts = relative.split("/").filter((p) => p !== "");
          if (parts.length > 1) {
            folderSet.add(parts[0]);
          } else if (parts.length === 1) {
            if (path.endsWith("/")) {
              folderSet.add(parts[0]);
            } else {
              fileSet.add({ name: parts[0], fullPath: path });
            }
          }
        }
      }
    });

    const renderedItems = [
      ...Array.from(folderSet).map((f) => ({
        name: f,
        isFolder: true,
        fullPath: currentPath + f + "/",
      })),
      ...Array.from(fileSet).map((f) => ({
        name: f.name,
        isFolder: false,
        fullPath: f.fullPath,
      })),
    ];

    setItems(
      renderedItems.sort((a, b) =>
        a.isFolder === b.isFolder
          ? a.name.localeCompare(b.name)
          : a.isFolder
            ? -1
            : 1,
      ),
    );
  }, [zip, currentPath]);

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

  if (!file) return null;

  const breadcrumbs = currentPath.split("/").filter((p) => p !== "");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Search size={28} />
          </div>
          <div className="overflow-hidden">
            <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">
              Archive Explorer
            </h3>
            <p className="text-slate-500 text-sm font-medium truncate">
              Hierarchical directory navigation.
            </p>
          </div>
        </div>

        {!isZip ? (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 mb-6">
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div className="text-xs text-red-900 leading-tight">
              <p className="font-black uppercase tracking-widest mb-1">
                Incompatible Object
              </p>
              <p className="truncate">Select a ZIP archive to explore.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 overflow-x-auto no-scrollbar">
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
            </div>

            <div className="space-y-2 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
              {isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-amber-500" size={24} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Hydrating Catalog...
                  </span>
                </div>
              ) : items.length > 0 ? (
                items.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() =>
                      item.isFolder && setCurrentPath(item.fullPath)
                    }
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all group cursor-pointer ${item.isFolder ? "bg-amber-50/20 border-amber-100 hover:border-amber-300" : "bg-white border-slate-50 hover:border-slate-300"}`}
                  >
                    <div
                      className={`p-1.5 rounded-lg border shadow-sm transition-colors ${item.isFolder ? "bg-amber-100 border-amber-200 text-amber-600" : "bg-white border-slate-200 text-slate-400 group-hover:text-amber-500"}`}
                    >
                      {item.isFolder ? (
                        <Folder size={12} />
                      ) : (
                        <FileText size={12} />
                      )}
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
                ))
              ) : (
                <div className="py-12 text-center">
                  <Hash size={32} className="mx-auto text-slate-100 mb-3" />
                  <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
                    No entries in this scope
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
