"use client";

/**
 * Área de Drag & Drop (com fallback para clique) para carregar um CSV.
 * Componente "burro": recebe um callback e delega o parsing ao pai.
 */

import { useCallback, useRef, useState } from "react";

interface FileDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function FileDropzone({
  onFileSelected,
  disabled,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
        alert("Por favor seleciona um ficheiro .csv válido.");
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors",
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
          : "cursor-pointer",
        isDragging
          ? "border-brand bg-blue-50"
          : "border-slate-300 bg-white hover:border-brand hover:bg-blue-50/40",
      ].join(" ")}
    >
      <svg
        className="h-10 w-10 text-brand"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      <div>
        <p className="font-medium text-slate-700">
          Arrasta o teu ficheiro CSV para aqui
        </p>
        <p className="text-sm text-slate-500">
          ou <span className="text-brand underline">clica para escolher</span>
        </p>
      </div>
      <p className="text-xs text-slate-400">
        Colunas suportadas: Title (obrigatório), Description, Priority, Assignee
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
