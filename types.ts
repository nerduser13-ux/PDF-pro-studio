import React from "react";

export type ToolType =
  | "merge"
  | "split"
  | "remove-pages"
  | "extract-pages"
  | "compare"
  | "convert"
  | "word"
  | "pptx"
  | "excel"
  | "word-to-pdf"
  | "ppt-to-pdf"
  | "excel-to-pdf"
  | "pdfa"
  | "img2pdf"
  | "img2text"
  | "rotate"
  | "extract-img"
  | "zip"
  | "edit"
  | "sign"
  | "word-viewer"
  | "word-merge"
  | "ppt-merge"
  | "zip-viewer";

export interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  blob: Blob;
  previewUrl?: string;
}

export enum DiffType {
  ADDED = "added",
  REMOVED = "removed",
  EQUAL = "equal",
}

export interface DiffPart {
  type: DiffType;
  value: string;
}

export interface ComparisonResult {
  leftParts: DiffPart[];
  rightParts: DiffPart[];
  additionCount: number;
  deletionCount: number;
}

export interface DiffBox {
  page: number;
  type: "addition" | "deletion" | "modification";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ToolProps {
  files: FileData[];
  setFiles: React.Dispatch<React.SetStateAction<FileData[]>>;
  activeFileIndex: number;
  setActiveFileIndex: React.Dispatch<React.SetStateAction<number>>;
  pages?: string;
  setPages?: React.Dispatch<React.SetStateAction<string>>;
  isBackendOnline?: boolean | null;
  rotations?: Record<string, Record<number, number>>;
  setRotations?: React.Dispatch<
    React.SetStateAction<Record<string, Record<number, number>>>
  >;
  compareFileIndex?: number;
  setCompareFileIndex?: React.Dispatch<React.SetStateAction<number>>;
  diffs?: DiffBox[];
  setDiffs?: React.Dispatch<React.SetStateAction<DiffBox[]>>;
  comparisonResult?: ComparisonResult | null;
  setComparisonResult?: (res: ComparisonResult | null) => void;
  ocrSelection?: OcrSelectionPayload | null;
  setOcrSelection?: React.Dispatch<
    React.SetStateAction<OcrSelectionPayload | null>
  >;
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  message: string;
}

export interface OcrSelectionPayload {
  text?: string;
  blob?: Blob;
  sourceType: "text" | "image";
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}
