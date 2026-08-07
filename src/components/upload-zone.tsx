"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  onFile: (file: File) => void;
}

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

export function UploadZone({ onFile }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      alert("Please provide a .zip file");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      alert("File is too large. Maximum supported size is 100 MB.");
      return;
    }
    onFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0] || null;
    handleFileSelected(file);
  }, [onFile]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelected(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
        dragging ? "border-wc-purple bg-wc-purple/10 scale-[1.01]" : "border-white/10 hover:border-wc-purple/40 hover:bg-white/[0.02]"
      }`}
    >
      <input ref={inputRef} type="file" accept=".zip" onChange={handleSelect} className="hidden" />
      <div className="flex flex-col items-center gap-3">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${dragging ? "bg-wc-purple/20 scale-110" : "bg-wc-purple/10"}`}>
          <svg className={`w-7 h-7 ${dragging ? "text-wc-purpleLight" : "text-wc-purple"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-100">{dragging ? "Drop it here" : "Drop your plugin zip"}</p>
          <p className="text-xs text-gray-500 mt-1">or <span className="text-wc-purpleLight underline underline-offset-2">browse files</span> — .zip only</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 text-[10px] text-gray-500">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0" /></svg>
          Processed locally
        </div>
      </div>
    </div>
  );
}
