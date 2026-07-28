"use client";

/**
 * Painel de feedback da importação: barra de progresso "Criados X de Y",
 * contadores de sucesso/erro e a lista detalhada de falhas no final.
 */

import type { DoneEvent } from "@/lib/types";

export interface ImportProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  done?: DoneEvent;
}

interface ProgressPanelProps {
  progress: ImportProgress;
  running: boolean;
}

export default function ProgressPanel({
  progress,
  running,
}: ProgressPanelProps) {
  const { total, processed, succeeded, failed, done } = progress;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          {running
            ? "Importação em curso…"
            : done
              ? "Importação concluída"
              : "Progresso"}
        </h3>
        <span className="text-sm font-medium text-slate-600">
          Criados {succeeded} de {total}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={[
            "h-full rounded-full transition-all duration-300",
            failed > 0 && !running ? "bg-amber-500" : "bg-brand",
          ].join(" ")}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Contadores */}
      <div className="flex flex-wrap gap-3 text-sm">
        <Badge tone="neutral" label="Processados" value={processed} />
        <Badge tone="success" label="Sucesso" value={succeeded} />
        <Badge tone="error" label="Falhas" value={failed} />
      </div>

      {/* Lista de falhas */}
      {done && done.failures.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="mb-2 text-sm font-semibold text-red-700">
            {done.failures.length} cartão(ões) falharam:
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-red-700">
            {done.failures.map((f) => (
              <li key={f.index} className="flex gap-2">
                <span className="font-mono text-red-400">
                  #{f.index + 1}
                </span>
                <span className="font-medium">
                  {f.title || "(sem título)"}
                </span>
                <span className="text-red-500">— {f.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && done.failures.length === 0 && (
        <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Todos os {done.succeeded} cartões foram criados com sucesso. 🎉
        </p>
      )}
    </div>
  );
}

function Badge({
  tone,
  label,
  value,
}: {
  tone: "neutral" | "success" | "error";
  label: string;
  value: number;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${tones[tone]}`}
    >
      {label}: <strong>{value}</strong>
    </span>
  );
}
