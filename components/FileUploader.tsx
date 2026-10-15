import React, { useRef, useState } from "react";
import { Upload, File, AlertCircle } from "lucide-react";

interface FileUploaderProps {
  onFilesAdded: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesAdded,
  accept = ".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.zip,.csv",
  multiple = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesAdded(files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesAdded(Array.from(e.target.files));
      // Reset input value to allow re-uploading the same file
      e.target.value = "";
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group ${
        isDragging
          ? "border-blue-500 bg-blue-50"
          : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept={accept}
        multiple={multiple}
        className="hidden"
      />

      <div
        className={`p-4 rounded-full mb-4 transition-transform duration-300 ${
          isDragging
            ? "bg-blue-100 text-blue-600 scale-110"
            : "bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500"
        }`}
      >
        <Upload size={32} />
      </div>

      <div className="text-center">
        <p className="text-slate-700 font-semibold text-lg mb-1">
          {multiple
            ? "Add multiple files to workspace"
            : "Select a document file"}
        </p>
        <p className="text-slate-400 text-sm">or drag and drop them here</p>
      </div>

      <div className="mt-8 flex items-center gap-2 text-slate-400 text-xs bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
        <AlertCircle size={14} />
        Supports PDF, Office, Images and ZIP archives
      </div>
    </div>
  );
};
