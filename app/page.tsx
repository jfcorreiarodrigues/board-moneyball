"use client";

/**
 * Página principal — Businessmap CSV Importer.
 *
 * Fluxo:
 *  1) Upload/Drag & Drop do CSV  -> parsing local com papaparse.
 *  2) Pré-visualização dos primeiros 5 registos + escolha do destino.
 *  3) "Iniciar Importação Massiva" -> POST /api/import (stream NDJSON).
 *  4) Barra de progresso em tempo real + relatório de sucessos/falhas.
 */

import { useCallback, useMemo, useState } from "react";
import FileDropzone from "@/components/FileDropzone";
import PreviewTable from "@/components/PreviewTable";
import ProgressPanel, { ImportProgress } from "@/components/ProgressPanel";
import { parseCsvFile } from "@/lib/csvClient";
import type { CsvRow, ImportTarget, StreamEvent } from "@/lib/types";

export default function HomePage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Destino no Businessmap (IDs numéricos).
  const [boardId, setBoardId] = useState("");
  const [columnId, setColumnId] = useState("");
  const [laneId, setLaneId] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  const canImport = useMemo(() => {
    return (
      rows.length > 0 &&
      /^\d+$/.test(boardId) &&
      /^\d+$/.test(columnId) &&
      !running
    );
  }, [rows.length, boardId, columnId, running]);

  // --- 1) Parsing do ficheiro -------------------------------------------
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setWarnings([]);
    setProgress(null);
    try {
      const result = await parseCsvFile(file);
      setRows(result.rows);
      setWarnings(result.warnings);
      setFileName(file.name);
    } catch (err) {
      setRows([]);
      setFileName(null);
      setError(err instanceof Error ? err.message : "Erro ao ler o CSV.");
    }
  }, []);

  const reset = useCallback(() => {
    setFileName(null);
    setRows([]);
    setWarnings([]);
    setError(null);
    setProgress(null);
  }, []);

  // --- 3) Importação massiva (consumo do stream NDJSON) ------------------
  const startImport = useCallback(async () => {
    setError(null);
    setRunning(true);
    setProgress({
      total: rows.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
    });

    const target: ImportTarget = {
      boardId: Number(boardId),
      columnId: Number(columnId),
      ...(laneId ? { laneId: Number(laneId) } : {}),
    };

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, rows }),
      });

      // Erros antes do stream (validação/config) chegam como JSON simples.
      if (!res.ok || !res.body) {
        const detail = await res
          .json()
          .then((j) => j.error as string)
          .catch(() => `Erro HTTP ${res.status}`);
        throw new Error(detail);
      }

      await consumeNdjson(res.body, (event) => {
        setProgress((prev) => reduceEvent(prev, event, rows.length));
        if (event.type === "fatal") setError(event.error);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na importação.");
    } finally {
      setRunning(false);
    }
  }, [rows, boardId, columnId, laneId]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Businessmap CSV Importer
        </h1>
        <p className="mt-1 text-slate-600">
          Importação massiva de cartões para o Businessmap (Kanbanize) a partir
          de um ficheiro CSV.
        </p>
      </header>

      <div className="space-y-6">
        {/* Passo 1 — Upload */}
        {rows.length === 0 && (
          <FileDropzone onFileSelected={handleFile} disabled={running} />
        )}

        {/* Erros de parsing/import */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Erro:</strong> {error}
          </div>
        )}

        {/* Avisos não-fatais */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p className="mb-1 font-semibold">Avisos:</p>
            <ul className="list-inside list-disc space-y-0.5">
              {warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Passo 2 — Preview + destino */}
        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Ficheiro: <span className="font-medium">{fileName}</span> ·{" "}
                {rows.length} registos
              </p>
              <button
                onClick={reset}
                disabled={running}
                className="text-sm text-slate-500 underline hover:text-slate-700 disabled:opacity-50"
              >
                Escolher outro ficheiro
              </button>
            </div>

            <PreviewTable rows={rows} totalCount={rows.length} />

            {/* Destino no Businessmap */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">
                Destino no Businessmap
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <NumberField
                  label="Board ID *"
                  value={boardId}
                  onChange={setBoardId}
                  placeholder="ex: 12"
                  disabled={running}
                />
                <NumberField
                  label="Column ID *"
                  value={columnId}
                  onChange={setColumnId}
                  placeholder="ex: 345"
                  disabled={running}
                />
                <NumberField
                  label="Lane ID (opcional)"
                  value={laneId}
                  onChange={setLaneId}
                  placeholder="ex: 67"
                  disabled={running}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Encontra estes IDs no URL do board ou via a API/OpenAPI da tua
                conta ({`https://{dominio}.kanbanize.com/openapi`}).
              </p>
            </div>

            {/* Passo 3 — Ação */}
            <button
              onClick={startImport}
              disabled={!canImport}
              className="w-full rounded-xl bg-brand px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {running
                ? "A importar…"
                : `Iniciar Importação Massiva (${rows.length})`}
            </button>
          </>
        )}

        {/* Passo 4 — Progresso */}
        {progress && <ProgressPanel progress={progress} running={running} />}
      </div>

      <footer className="mt-12 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        Os pedidos são feitos no servidor (Next.js API Route). A API Key nunca é
        exposta no browser.
      </footer>
    </main>
  );
}

// --------------------------------------------------------------------------
// Helpers de UI e de stream
// --------------------------------------------------------------------------

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100"
      />
    </label>
  );
}

/** Aplica um evento do stream ao estado de progresso. */
function reduceEvent(
  prev: ImportProgress | null,
  event: StreamEvent,
  total: number
): ImportProgress {
  const base: ImportProgress = prev ?? {
    total,
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  if (event.type === "progress") {
    return {
      ...base,
      processed: base.processed + 1,
      succeeded: base.succeeded + (event.status === "success" ? 1 : 0),
      failed: base.failed + (event.status === "error" ? 1 : 0),
    };
  }
  if (event.type === "done") {
    return {
      ...base,
      total: event.total,
      processed: event.total,
      succeeded: event.succeeded,
      failed: event.failed,
      done: event,
    };
  }
  return base;
}

/**
 * Lê um ReadableStream de NDJSON e invoca `onEvent` por cada objeto JSON.
 * Faz buffering para lidar com chunks que partem uma linha ao meio.
 */
async function consumeNdjson(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
  }

  // Última linha sem "\n" final, se existir.
  const tail = buffer.trim();
  if (tail) onEvent(JSON.parse(tail) as StreamEvent);
}
