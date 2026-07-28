/**
 * Cliente de integração com a API RESTful v2 do Businessmap (Kanbanize).
 *
 * Docs de referência:
 *  - Overview: https://knowledgebase.businessmap.io/hc/en-us/articles/360012393692-Businessmap-REST-API
 *  - OpenAPI interativa: https://{dominio}.kanbanize.com/openapi
 *
 * Toda a comunicação (e a API Key) vive apenas no servidor — nunca no browser.
 */

import type { CsvRow, ImportTarget } from "./types";

/** Configuração derivada das variáveis de ambiente. */
export interface BusinessmapConfig {
  apiKey: string;
  domain: string;
  rateLimitMs: number;
  maxRetries: number;
}

/**
 * Lê e valida a configuração a partir das variáveis de ambiente.
 * Lança um erro descritivo se algo essencial estiver em falta.
 */
export function loadConfig(): BusinessmapConfig {
  const apiKey = process.env.BUSINESSMAP_API_KEY?.trim();
  const domain = process.env.BUSINESSMAP_DOMAIN?.trim();

  if (!apiKey) {
    throw new Error(
      "BUSINESSMAP_API_KEY não está definida. Configura o ficheiro .env.local."
    );
  }
  if (!domain) {
    throw new Error(
      "BUSINESSMAP_DOMAIN não está definido. Configura o ficheiro .env.local."
    );
  }

  return {
    apiKey,
    domain,
    rateLimitMs: toInt(process.env.BUSINESSMAP_RATE_LIMIT_MS, 350),
    maxRetries: toInt(process.env.BUSINESSMAP_MAX_RETRIES, 3),
  };
}

/** URL base da API v2 para o domínio configurado. */
export function apiBaseUrl(domain: string): string {
  return `https://${domain}.kanbanize.com/api/v2`;
}

/**
 * Mapeia a prioridade textual do CSV para o valor esperado pela API v2.
 * A API aceita: "low" | "average" | "high" | "critical".
 * Aceitamos variações comuns (PT/EN) para reduzir a fricção do utilizador.
 */
export function normalizePriority(raw?: string): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (!v) return undefined;

  const map: Record<string, string> = {
    // baixo
    low: "low",
    baixa: "low",
    baixo: "low",
    "1": "low",
    // médio / average
    average: "average",
    medium: "average",
    med: "average",
    normal: "average",
    media: "average",
    "média": "average",
    "medio": "average",
    "médio": "average",
    "2": "average",
    // alto
    high: "high",
    alta: "high",
    alto: "high",
    "3": "high",
    // crítico
    critical: "critical",
    critica: "critical",
    "crítica": "critical",
    critico: "critical",
    "crítico": "critical",
    urgent: "critical",
    urgente: "critical",
    "4": "critical",
  };

  return map[v]; // undefined => a API usa o valor por defeito do board
}

/**
 * Constrói o payload JSON para POST /cards a partir de uma linha do CSV.
 * Só inclui campos preenchidos, evitando enviar `null`/`undefined`.
 */
export function buildCardPayload(
  row: CsvRow,
  target: ImportTarget,
  ownerUserId?: number
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    board_id: target.boardId,
    column_id: target.columnId,
    title: row.title.trim(),
  };

  if (target.laneId) payload.lane_id = target.laneId;

  const description = row.description?.trim();
  if (description) payload.description = description;

  const priority = normalizePriority(row.priority);
  if (priority) payload.priority = priority;

  if (typeof ownerUserId === "number") payload.owner_user_id = ownerUserId;

  return payload;
}

/** Pausa a execução durante `ms` milissegundos (rate limiting). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Erro tipado com o status HTTP devolvido pela API. */
export class BusinessmapApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "BusinessmapApiError";
  }
}

/**
 * Cria um único cartão via POST /cards, com retry/backoff para 429 e 5xx.
 * Devolve o `card_id` criado.
 */
export async function createCard(
  config: BusinessmapConfig,
  payload: Record<string, unknown>
): Promise<number> {
  const url = `${apiBaseUrl(config.domain)}/cards`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: config.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      // 429 (rate limit) ou 5xx (erro transitório) => backoff e retry.
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = parseRetryAfter(res.headers.get("Retry-After"));
        const backoff = retryAfter ?? config.rateLimitMs * Math.pow(2, attempt);
        lastError = new BusinessmapApiError(
          `Resposta ${res.status} (tentativa ${attempt + 1}/${config.maxRetries + 1})`,
          res.status
        );
        if (attempt < config.maxRetries) {
          await sleep(backoff);
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        // 4xx não recuperável (ex.: 401 credenciais, 400 payload inválido).
        const detail = await safeErrorDetail(res);
        throw new BusinessmapApiError(
          `Falha ao criar cartão (HTTP ${res.status}): ${detail}`,
          res.status
        );
      }

      const json = (await res.json()) as {
        data?: { card_id?: number };
        card_id?: number;
      };
      const cardId = json.data?.card_id ?? json.card_id;
      if (typeof cardId !== "number") {
        throw new BusinessmapApiError(
          "Cartão criado mas a resposta não continha card_id.",
          res.status
        );
      }
      return cardId;
    } catch (err) {
      // Erros de rede: também vale a pena tentar novamente.
      if (err instanceof BusinessmapApiError && err.status < 500 && err.status !== 429) {
        throw err; // erro definitivo do cliente
      }
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < config.maxRetries) {
        await sleep(config.rateLimitMs * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Falha desconhecida ao criar cartão.");
}

/**
 * Resolve usernames/emails para user_id numérico através de GET /users.
 * O resultado é devolvido como um Map em minúsculas para lookups rápidos.
 * Se a chamada falhar, devolve um Map vazio (assignee fica por resolver).
 */
export async function fetchUserLookup(
  config: BusinessmapConfig
): Promise<Map<string, number>> {
  const lookup = new Map<string, number>();
  try {
    const res = await fetch(`${apiBaseUrl(config.domain)}/users`, {
      headers: {
        apikey: config.apiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) return lookup;

    const json = (await res.json()) as {
      data?: Array<{
        user_id?: number;
        username?: string;
        email?: string;
        realname?: string;
      }>;
    };

    for (const u of json.data ?? []) {
      if (typeof u.user_id !== "number") continue;
      if (u.username) lookup.set(u.username.toLowerCase(), u.user_id);
      if (u.email) lookup.set(u.email.toLowerCase(), u.user_id);
      if (u.realname) lookup.set(u.realname.toLowerCase(), u.user_id);
    }
  } catch {
    // Silencioso: a resolução de assignee é best-effort.
  }
  return lookup;
}

/**
 * Determina o owner_user_id a partir do campo `assignee` do CSV.
 * Aceita diretamente um id numérico, ou resolve via o Map de utilizadores.
 */
export function resolveOwnerUserId(
  assignee: string | undefined,
  lookup: Map<string, number>
): number | undefined {
  if (!assignee) return undefined;
  const raw = assignee.trim();
  if (!raw) return undefined;

  // Já é um id numérico?
  if (/^\d+$/.test(raw)) return Number(raw);

  return lookup.get(raw.toLowerCase());
}

// --------------------------------------------------------------------------
// Helpers internos
// --------------------------------------------------------------------------

function toInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  return null;
}

async function safeErrorDetail(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    return json.error?.message ?? res.statusText;
  } catch {
    return res.statusText || "erro desconhecido";
  }
}
