"use client";

/**
 * Tabela de pré-visualização dos primeiros N registos do CSV,
 * para validação visual antes de arrancar a importação.
 */

import type { CsvRow } from "@/lib/types";

interface PreviewTableProps {
  rows: CsvRow[];
  totalCount: number;
  maxRows?: number;
}

const COLUMNS: { key: keyof CsvRow; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "description", label: "Description" },
  { key: "priority", label: "Priority" },
  { key: "assignee", label: "Assignee" },
];

export default function PreviewTable({
  rows,
  totalCount,
  maxRows = 5,
}: PreviewTableProps) {
  const preview = rows.slice(0, maxRows);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">
          Pré-visualização
        </h3>
        <span className="text-xs text-slate-500">
          A mostrar {preview.length} de {totalCount} registos
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2 font-medium">#</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-4 py-2 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className="max-w-xs truncate px-4 py-2 text-slate-700"
                    title={row[c.key] ?? ""}
                  >
                    {row[c.key] || <span className="text-slate-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
