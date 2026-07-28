/**
 * Utilitários de parsing de CSV no browser (via papaparse).
 * Responsável por transformar o ficheiro em linhas normalizadas (CsvRow),
 * reconhecendo cabeçalhos em várias grafias (PT/EN, maiúsculas/minúsculas).
 */

import Papa from "papaparse";
import type { CsvRow } from "./types";

/** Resultado do parsing: linhas válidas + avisos não-fatais. */
export interface ParseResult {
  rows: CsvRow[];
  headers: string[];
  warnings: string[];
}

/**
 * Mapa de aliases de cabeçalho -> chave canónica.
 * Permite que o utilizador use "Título"/"Titulo"/"title" indiferentemente.
 */
const HEADER_ALIASES: Record<string, string> = {
  title: "title",
  titulo: "title",
  "título": "title",
  nome: "title",
  name: "title",

  description: "description",
  descricao: "description",
  "descrição": "description",
  desc: "description",

  priority: "priority",
  prioridade: "priority",

  assignee: "assignee",
  responsavel: "assignee",
  "responsável": "assignee",
  owner: "assignee",
  atribuido: "assignee",
  "atribuído": "assignee",
};

/** Normaliza um cabeçalho para a sua chave canónica (ou mantém o original). */
function normalizeHeader(header: string): string {
  const key = header.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? header.trim();
}

/**
 * Faz o parsing de um ficheiro CSV e devolve linhas normalizadas.
 * Rejeita a promessa apenas em erros fatais (ficheiro ilegível).
 */
export function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      complete: (results) => {
        const warnings: string[] = [];

        if (results.errors.length > 0) {
          for (const e of results.errors.slice(0, 5)) {
            warnings.push(`Linha ${(e.row ?? 0) + 1}: ${e.message}`);
          }
        }

        const headers = results.meta.fields ?? [];
        if (!headers.map((h) => h.toLowerCase()).includes("title")) {
          reject(
            new Error(
              "O CSV não tem uma coluna 'Title' (obrigatória). Cabeçalhos aceites: Title, Título, Nome…"
            )
          );
          return;
        }

        const rows: CsvRow[] = [];
        results.data.forEach((raw, i) => {
          const title = (raw.title ?? "").trim();
          if (!title) {
            warnings.push(`Linha ${i + 2} ignorada: sem 'Title'.`);
            return;
          }
          rows.push({
            title,
            description: raw.description?.trim() || undefined,
            priority: raw.priority?.trim() || undefined,
            assignee: raw.assignee?.trim() || undefined,
          });
        });

        if (rows.length === 0) {
          reject(new Error("Nenhuma linha válida encontrada no CSV."));
          return;
        }

        resolve({ rows, headers, warnings });
      },
      error: (err) => reject(err),
    });
  });
}
