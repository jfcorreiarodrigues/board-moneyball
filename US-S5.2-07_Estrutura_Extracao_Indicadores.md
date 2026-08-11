# US-S5.2-07 — Estrutura de dados da Extração de Indicadores

**Contrato de dados** para a funcionalidade *Extrações & indicadores* (ecrã de Analytics do CMP).
Define o envelope, as dimensões, as métricas e o formato de saída, para implementação sem ambiguidade.

- **Âmbito:** agregados apenas — **nunca** dados ao nível do titular
- **Perfis com acesso:** `DPO_Admin`, `Marketing_Analitico`
- **Canal de acesso:** API ou extração de ficheiro (JSON / CSV) — não é apresentado no Frontend
- **Versão do schema:** `1.0`

---

## Regras de negócio (embutidas no schema)

| # | Regra | Como a estrutura garante |
|---|-------|--------------------------|
| 1 | A extração nunca contém dados ao nível do titular | Sem arrays de titulares e sem campos de e-mail/ID. Só existem contagens (inteiros) e rácios. |
| 2 | Os indicadores não são apresentados no Frontend | O payload é entregue por API ou ficheiro. O ecrã apenas solicita e lista extrações. |
| 3 | Cada extração fica registada em auditoria | Cada pedido escreve um registo com `actor`, `filters` e `generatedAt`, ligado pelo `extractionId`. |
| 4 | A extração respeita o tenant | O campo `tenant` é obrigatório e todas as contagens são calculadas nesse âmbito. |

---

## 1. Envelope (metadados)

| Campo | Tipo | Obrig. | Descrição |
|-------|------|:------:|-----------|
| `extractionId` | string | ✔ | Identificador único e estável (ex.: `EXT-2026-0847`). Chave de ligação ao registo de auditoria. |
| `schemaVersion` | string (SemVer) | ✔ | Versão do contrato de dados. Permite evoluir sem quebrar consumidores. |
| `tenant` | string | ✔ | Empresa a que respeita: `CTT` ou `CTT Express`. Delimita todas as contagens. |
| `generatedAt` | string (ISO-8601, UTC) | ✔ | Instante em que os valores foram calculados. É o «momento a que os valores respeitam». |
| `requestedBy` | object | ✔ | Origem do pedido: `type` (`user`\|`system`), `id`, `role`. |
| `request.period` | object | ✔ | Janela de análise: `from` / `to` (datas, inclusivas). |
| `request.categories` | string[] | — | Filtro de finalidades (`UC-01`…). Vazio/ausente = todas. |
| `request.channels` | string[] | — | Filtro de canais (`email`, `sms`, `push`, `letter`). Vazio = todos. |
| `suppression` | object | ✔ | Parâmetros de anonimização: `minThreshold`, `suppressedCount` (ver secção 4). |
| `data` | object | ✔ | Os agregados (secção 3). `null` enquanto `status = processing`. |

---

## 2. Bloco de métricas (`metrics`)

Todos os nós agregados (tenant, categoria, sub-opção, canal) partilham o **mesmo** bloco `metrics`.
Distingue-se sempre o **estado no fim do período** (snapshot) do **movimento dentro do período** (delta).

| Métrica | Tipo | Natureza | Definição |
|---------|------|----------|-----------|
| `activeAtEnd` | integer | snapshot | Titulares com consentimento **ativo** no instante `period.to`. |
| `revokedAtEnd` | integer | snapshot | Titulares cujo estado no fim do período é **revogado / retirado**. |
| `grantedInPeriod` | integer | delta | Concessões **novas** ocorridas dentro da janela. |
| `revokedInPeriod` | integer | delta | Retiradas / revogações ocorridas dentro da janela. |
| `netChange` | integer | delta | Variação líquida: `grantedInPeriod − revokedInPeriod`. |
| `base` | integer | contexto | Universo de titulares considerado (denominador dos rácios). |
| `coverageRate` | number (0–1) | derivada | Penetração: `activeAtEnd / base`. Arredondar a 4 casas. |

> **Porquê separar snapshot de delta:** «quantos posso contactar hoje» (snapshot) é uma pergunta
> diferente de «quantos me saíram este mês» (delta). Um só número não serve as duas.

---

## 3. Corpo (`data`) — hierarquia de agregação

```
data
├─ summary            { metrics }            // tenant inteiro, dentro do filtro
├─ byCategory[]
│   ├─ code, name, metrics
│   ├─ bySubOption[]  { id, name, metrics }
│   └─ byChannel[]    { channel, metrics }   // só finalidades com canal
└─ suppressedNodes[]  { level, key, reason }
```

`bySubOption` e `byChannel` são **irmãs, não aninhadas** — de propósito, para não permitir
reconstruir o titular cruzando sub-opção × canal.

### Exemplo completo (`EXT-2026-0847.json`)

```json
{
  "extractionId": "EXT-2026-0847",
  "schemaVersion": "1.0",
  "tenant": "CTT",
  "generatedAt": "2026-08-11T14:30:12Z",
  "requestedBy": {
    "type": "user",
    "id": "carlos.santos@ctt.pt",
    "role": "Marketing_Analitico"
  },
  "request": {
    "period": { "from": "2026-08-01", "to": "2026-08-31" },
    "categories": ["UC-01", "UC-02"],
    "channels": ["email", "sms", "push"]
  },
  "suppression": { "minThreshold": 100, "suppressedCount": 1 },

  "data": {
    "summary": {
      "activeAtEnd": 45230, "revokedAtEnd": 6770,
      "grantedInPeriod": 4200, "revokedInPeriod": 1850,
      "netChange": 2350, "base": 52000, "coverageRate": 0.8698
    },
    "byCategory": [
      {
        "code": "UC-01",
        "name": { "pt": "Comunicações comerciais", "es": "Comunicaciones comerciales" },
        "metrics": {
          "activeAtEnd": 38920, "revokedAtEnd": 6310,
          "grantedInPeriod": 2600, "revokedInPeriod": 1010,
          "netChange": 1590, "base": 52000, "coverageRate": 0.7485
        },
        "bySubOption": [
          { "id": "prod",  "name": { "pt": "Produtos e serviços" },
            "metrics": { "activeAtEnd": 36000, "revokedAtEnd": 2100, "grantedInPeriod": 1400, "revokedInPeriod": 420, "netChange": 980, "base": 52000, "coverageRate": 0.6923 } },
          { "id": "promo", "name": { "pt": "Promoções" },
            "metrics": { "activeAtEnd": 25000, "revokedAtEnd": 3210, "grantedInPeriod": 900, "revokedInPeriod": 510, "netChange": 390, "base": 52000, "coverageRate": 0.4808 } }
        ],
        "byChannel": [
          { "channel": "email", "metrics": { "activeAtEnd": 22000, "revokedAtEnd": 1500 } },
          { "channel": "sms",   "metrics": { "activeAtEnd": 8920,  "revokedAtEnd": 800 } },
          { "channel": "push",  "metrics": { "activeAtEnd": 7000,  "revokedAtEnd": 1010 } }
        ]
      }
      // … UC-02 análogo
    ],
    "suppressedNodes": [
      { "level": "subOption", "key": "UC-05/vantagens", "reason": "below_min_threshold", "threshold": 100 }
    ]
  }
}
```

---

## 4. Supressão por limiar mínimo (k-anonimato)

Um agregado que abranja poucos titulares pode reidentificar pessoas. Qualquer nó abaixo de
`suppression.minThreshold` não sai com números.

| Situação | Comportamento |
|----------|---------------|
| Nó com `base < minThreshold` | Não é emitido nas listas. Passa para `suppressedNodes[]` com `reason: "below_min_threshold"`. |
| Contagem do `summary` | Nunca suprimida, mas não deve permitir deduzir um nó suprimido por subtração. |
| Pedido de detalhe individual | **Recusado.** Devolve erro e escreve registo de auditoria (US-S5.1-03). |

> **Supressão complementar:** se só um nó de um grupo for suprimido, o seu valor deduz-se
> subtraindo os restantes do total. Nesse caso, suprimir também o segundo menor nó do grupo.
> Confirmar o `minThreshold` efetivo por tenant com o DPO.

---

## 5. Registo de auditoria (efeito lateral obrigatório)

Toda a extração — aceite **ou recusada** — escreve uma linha imutável no diário.

```json
{
  "auditId": "AUD-2026-0A5F31",
  "ts": "2026-08-11T14:30:12Z",
  "action": "extraction.request",
  "extractionId": "EXT-2026-0847",
  "tenant": "CTT",
  "actor": { "id": "carlos.santos@ctt.pt", "role": "Marketing_Analitico" },
  "filters": {
    "period": { "from": "2026-08-01", "to": "2026-08-31" },
    "categories": ["UC-01", "UC-02"], "channels": ["email", "sms", "push"]
  },
  "outcome": "completed",
  "rejectionReason": null
}
```

`outcome`: `"completed"` \| `"rejected"` · `rejectionReason` ex.: `"subject_level_requested"`.

---

## 6. Equivalente em CSV (formato longo)

O mesmo conteúdo achatado para BI/Excel. Uma linha por nó; `level` indica a dimensão.
Metadados do envelope num ficheiro-irmão `*.meta.json` ou em linhas de comentário `#` no topo.
Nós suprimidos aparecem com `SUPPRESSED` nas colunas de métrica.

```csv
# extractionId=EXT-2026-0847 tenant=CTT generatedAt=2026-08-11T14:30:12Z
# period=2026-08-01..2026-08-31 minThreshold=100
level,category,sub_option,channel,active_at_end,revoked_at_end,granted_in_period,revoked_in_period,net_change,base,coverage_rate
summary,,,,45230,6770,4200,1850,2350,52000,0.8698
category,UC-01,,,38920,6310,2600,1010,1590,52000,0.7485
subOption,UC-01,prod,,36000,2100,1400,420,980,52000,0.6923
subOption,UC-01,promo,,25000,3210,900,510,390,52000,0.4808
channel,UC-01,,email,22000,1500,1200,300,900,52000,0.4231
channel,UC-01,,sms,8920,800,600,210,390,52000,0.1715
subOption,UC-05,vantagens,,SUPPRESSED,SUPPRESSED,SUPPRESSED,SUPPRESSED,SUPPRESSED,SUPPRESSED,SUPPRESSED
```

> **Regra de ouro do CSV:** nunca uma coluna `email`, `subject_id` ou equivalente.
> Se aparecer, o ficheiro violou a regra 1 e não deve ser gerado.

---

## Notas de implementação

1. `schemaVersion` segue SemVer — acrescentar campos é *minor*; remover/renomear é *major*.
2. Datas de `period` são inclusivas em ambos os extremos; `generatedAt` é o timestamp real de cálculo.
3. A extração pode ser **a pedido** (ecrã/API) ou **periódica** (agendada por tenant) — estrutura idêntica; muda só `requestedBy.type`.
4. Confirmar com o DPO o `minThreshold` por tenant antes de produção.

### A validar antes de fechar
- [ ] `minThreshold` por tenant (exemplo usado: 100)
- [ ] Se as métricas de **delta** entram na v1 ou só o snapshot (faseamento possível)
