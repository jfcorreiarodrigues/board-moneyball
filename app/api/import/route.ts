/**
 * Route Handler: POST /api/import
 *
 * Recebe os dados já processados pelo frontend (linhas do CSV + destino),
 * itera sobre cada linha e cria um cartão no Businessmap via POST /cards.
 *
 * Estratégia:
 *  - A API Key vive só no servidor (lida das env vars) — nunca chega ao browser.
 *  - Entre cada chamada aplica-se um atraso (rate limiting) para evitar HTTP 429.
 *  - A resposta é um stream NDJSON: cada cartão emite um evento de progresso,
 *    permitindo à UI mostrar "Criados X de Y" em tempo real, e no fim um resumo.
 */

import { NextRequest } from "next/server";
import {
  buildCardPayload,
  createCard,
  fetchUserLookup,
  loadConfig,
  resolveOwnerUserId,
  sleep,
} from "@/lib/businessmap";
import type {
  DoneEvent,
  ImportRequestBody,
  ProgressEvent,
  StreamEvent,
} from "@/lib/types";

// Cria cartões um a um com delay => precisa do runtime Node.js (não Edge).
export const runtime = "nodejs";
// Evita qualquer cache; cada importação é única.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 1) Validar a configuração do servidor cedo (falha rápida e clara).
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    return jsonError((err as Error).message, 500);
  }

  // 2) Validar o corpo do pedido.
  let body: ImportRequestBody;
  try {
    body = (await req.json()) as ImportRequestBody;
  } catch {
    return jsonError("Corpo do pedido inválido (JSON malformado).", 400);
  }

  const validationError = validateBody(body);
  if (validationError) return jsonError(validationError, 400);

  const { rows, target } = body;
  const encoder = new TextEncoder();

  // 3) Construir o stream NDJSON de progresso.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      // Resolver usernames -> user_id uma única vez (best-effort).
      const needsLookup = rows.some(
        (r) => r.assignee && !/^\d+$/.test(r.assignee.trim())
      );
      const userLookup = needsLookup
        ? await fetchUserLookup(config)
        : new Map<string, number>();

      const failures: DoneEvent["failures"] = [];
      let succeeded = 0;

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const title = (row.title ?? "").trim();

        try {
          const ownerUserId = resolveOwnerUserId(row.assignee, userLookup);
          const payload = buildCardPayload(row, target, ownerUserId);
          const cardId = await createCard(config, payload);

          succeeded++;
          emit(<ProgressEvent>{
            type: "progress",
            index,
            total: rows.length,
            status: "success",
            title,
            cardId,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failures.push({ index, title, error: message });
          emit(<ProgressEvent>{
            type: "progress",
            index,
            total: rows.length,
            status: "error",
            title,
            error: message,
          });
        }

        // Rate limiting: pausa entre chamadas (exceto após a última).
        if (index < rows.length - 1 && config.rateLimitMs > 0) {
          await sleep(config.rateLimitMs);
        }
      }

      emit(<DoneEvent>{
        type: "done",
        total: rows.length,
        succeeded,
        failed: failures.length,
        failures,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      // NDJSON: um objeto JSON por linha.
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // desativa buffering em proxies (ex.: nginx)
    },
  });
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function validateBody(body: ImportRequestBody): string | null {
  if (!body || typeof body !== "object") return "Corpo do pedido em falta.";
  if (!body.target) return "Destino (board/column) em falta.";

  const { boardId, columnId } = body.target;
  if (!Number.isInteger(boardId) || boardId <= 0)
    return "board_id inválido: indica um Board ID numérico válido.";
  if (!Number.isInteger(columnId) || columnId <= 0)
    return "column_id inválido: indica um Column ID numérico válido.";

  if (!Array.isArray(body.rows) || body.rows.length === 0)
    return "Não há linhas para importar.";

  const missingTitle = body.rows.findIndex((r) => !r?.title?.trim());
  if (missingTitle !== -1)
    return `A linha ${missingTitle + 1} não tem 'Title' (campo obrigatório).`;

  return null;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
