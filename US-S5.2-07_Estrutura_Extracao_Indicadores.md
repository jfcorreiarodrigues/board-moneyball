# US-S5.2-07 — Extração de Indicadores de Consentimento

## O que é, numa frase

O Marketing (ou um sistema autorizado) pede ao CMP um **resumo em números** dos consentimentos
de uma empresa, num período. O CMP devolve **um ficheiro** (JSON ou CSV) com contagens agregadas
— **nunca** listas de pessoas.

- **Quem pede:** perfis `DPO_Admin` e `Marketing_Analitico`
- **Como chega:** por API ou como ficheiro para download (não é mostrado no ecrã do CMP)
- **O que contém:** para cada finalidade e sub-opção, **quantos titulares têm o consentimento
  ativo** e **quantos o revogaram**. Mais nada.

---

## O output, num relance

Para o pedido *"CTT, agosto de 2026, finalidades UC-01 e UC-02"*, o ficheiro é assim:

```json
{
  "extractionId": "EXT-2026-0847",
  "tenant": "CTT",
  "generatedAt": "2026-08-11T14:30:12Z",
  "requestedBy": { "id": "carlos.santos@ctt.pt", "role": "Marketing_Analitico" },
  "period": { "from": "2026-08-01", "to": "2026-08-31" },
  "categories": ["UC-01", "UC-02"],
  "base": 52000,

  "results": [
    {
      "category": "UC-01",
      "name": "Comunicações comerciais",
      "active": 38920,
      "revoked": 6310,
      "subOptions": [
        { "id": "prod",  "name": "Produtos e serviços", "active": 36000, "revoked": 2100 },
        { "id": "promo", "name": "Promoções",           "active": 25000, "revoked": 3210 }
      ]
    },
    {
      "category": "UC-02",
      "name": "Partilha com parceiros",
      "active": 28900,
      "revoked": 3200,
      "subOptions": [
        { "id": "telecom", "name": "Telecomunicações", "active": 28900, "revoked": 2100 },
        { "id": "seguros", "name": "Seguros",          "active": 12000, "revoked": 1100 }
      ]
    }
  ],

  "suppressed": [
    { "category": "UC-05", "subOption": "vantagens", "reason": "abaixo do limiar mínimo" }
  ]
}
```

**É isto.** Cada linha de `results` (e cada sub-opção) diz duas coisas: `active` e `revoked`.
Nada de canais, nada de deltas, nada de pessoas.

---

## O que cada campo significa

**Cabeçalho** — identifica o pedido:

| Campo | Significado |
|-------|-------------|
| `extractionId` | Identificador único da extração. Liga ao registo de auditoria. |
| `tenant` | Empresa: `CTT` ou `CTT Express`. Todas as contagens são deste âmbito. |
| `generatedAt` | Momento em que os números foram calculados (UTC). |
| `requestedBy` | Quem pediu: `id` (utilizador/sistema) e `role`. |
| `period` | Janela de análise: `from` / `to`. O estado contado é o do fim do período. |
| `categories` | Finalidades pedidas. Vazio ou ausente = todas as da empresa. |

**Os números** — repetem-se em cada finalidade e sub-opção:

| Campo | Significado |
|-------|-------------|
| `base` | Total de titulares da empresa. Serve de denominador para percentagens. |
| `active` | Nº de titulares com o consentimento **ativo** no fim do período. |
| `revoked` | Nº de titulares que **revogaram** (estado no fim do período). |

Uma percentagem calcula-se a partir destes: penetração de UC-01 = `active / base` = 38920 / 52000 = **74,8 %**.

---

## O pedido (filtros de entrada)

O sistema/utilizador escolhe apenas:

- **Empresa** (`tenant`) — obrigatório
- **Período** (`from` / `to`) — obrigatório
- **Finalidades** (`categories`) — opcional; vazio = todas

Não há filtro por canal — a extração devolve sempre por finalidade e sub-opção.

---

## As 4 regras de negócio

| # | Regra | Como o ficheiro garante |
|---|-------|--------------------------|
| 1 | Nunca dados ao nível do titular | Só há contagens. Não existe campo de e-mail nem lista de pessoas. |
| 2 | Não é apresentado no Frontend | Entregue por API ou ficheiro. O ecrã só solicita e lista extrações. |
| 3 | Registada em auditoria | Cada pedido escreve um registo (ver abaixo), aceite ou recusado. |
| 4 | Respeita o tenant | O campo `tenant` delimita todas as contagens. Sem mistura entre empresas. |

### Supressão (proteção de anonimato)

Se uma finalidade ou sub-opção abranger **menos titulares do que o limiar mínimo**
(`minThreshold`, ex.: 100), os seus números **não saem**: aparece em `suppressed[]` com o
motivo, em vez de contagens. Um pedido de detalhe individual é **recusado** e registado em
auditoria (US-S5.1-03).

---

## Registo de auditoria (escrito em cada extração)

```json
{
  "auditId": "AUD-2026-0A5F31",
  "ts": "2026-08-11T14:30:12Z",
  "action": "extraction.request",
  "extractionId": "EXT-2026-0847",
  "tenant": "CTT",
  "actor": { "id": "carlos.santos@ctt.pt", "role": "Marketing_Analitico" },
  "filters": { "period": { "from": "2026-08-01", "to": "2026-08-31" }, "categories": ["UC-01", "UC-02"] },
  "outcome": "completed"
}
```

`outcome`: `"completed"` ou `"rejected"` (neste caso com o motivo da recusa).

---

## Formato CSV (alternativa ao JSON)

O mesmo conteúdo, para abrir em Excel/BI. Uma linha por finalidade e por sub-opção.
O cabeçalho da extração vai em linhas de comentário `#`. Nós suprimidos aparecem com `SUPPRESSED`.

```csv
# EXT-2026-0847 · CTT · 2026-08-01..2026-08-31 · base=52000
category,sub_option,active,revoked
UC-01,,38920,6310
UC-01,prod,36000,2100
UC-01,promo,25000,3210
UC-02,,28900,3200
UC-02,telecom,28900,2100
UC-02,seguros,12000,1100
UC-05,vantagens,SUPPRESSED,SUPPRESSED
```

> **Regra de ouro:** nunca uma coluna `email` ou `subject_id`. Se aparecer, o ficheiro violou a
> regra 1 e não deve ser gerado.

---

## Notas

1. A extração pode ser **a pedido** (ecrã/API) ou **periódica** (agendada por empresa) — o
   ficheiro é igual nos dois casos.
2. Confirmar com o DPO o `minThreshold` por empresa antes de produção (exemplo usado: 100).
3. **Deixado de fora de propósito, para manter simples** (pode acrescentar-se no futuro se houver
   necessidade real): quebra por canal (email/SMS/…) e métricas de *movimento* no período
   (quantos concederam / revogaram dentro da janela). A v1 dá apenas a **fotografia**: quantos
   ativos e quantos revogados no fim do período.
