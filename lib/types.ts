/**
 * Tipos partilhados entre o frontend e as API Routes.
 * Centralizar os contratos evita divergências entre cliente e servidor.
 */

/** Uma linha do CSV já normalizada (chaves conhecidas pela aplicação). */
export interface CsvRow {
  /** Obrigatório — título do cartão. */
  title: string;
  description?: string;
  /** Texto livre: "low" | "average" | "high" | "critical" (ou variações). */
  priority?: string;
  /** Username, email ou user_id numérico do responsável. */
  assignee?: string;
  /** Permite colunas extra sem quebrar o parsing. */
  [key: string]: string | undefined;
}

/** Parâmetros de destino escolhidos na UI (para onde os cartões vão). */
export interface ImportTarget {
  boardId: number;
  columnId: number;
  /** Opcional — carril (swimlane) de destino. */
  laneId?: number;
}

/** Corpo do pedido POST /api/import enviado pelo frontend. */
export interface ImportRequestBody {
  target: ImportTarget;
  rows: CsvRow[];
}

/** Evento de progresso emitido (NDJSON) por cada cartão processado. */
export interface ProgressEvent {
  type: "progress";
  index: number; // 0-based
  total: number;
  status: "success" | "error";
  title: string;
  cardId?: number;
  error?: string;
}

/** Resumo final emitido no fim do stream. */
export interface DoneEvent {
  type: "done";
  total: number;
  succeeded: number;
  failed: number;
  failures: { index: number; title: string; error: string }[];
}

/** Evento de erro fatal (ex.: validação da configuração falhou). */
export interface FatalEvent {
  type: "fatal";
  error: string;
}

export type StreamEvent = ProgressEvent | DoneEvent | FatalEvent;
