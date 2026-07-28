# Businessmap CSV Importer

Aplicação web (Next.js + React + Tailwind) para **importação massiva de cartões**
para o [Businessmap](https://businessmap.io) (antigo Kanbanize) a partir de um
ficheiro **CSV**, usando a **API RESTful v2**.

O parsing do CSV acontece no browser (com `papaparse`) e a criação dos cartões
é feita numa **API Route** do Next.js, mantendo a **API Key sempre no servidor**.

---

## ✨ Funcionalidades

- **Drag & Drop** (ou clique) para carregar o CSV.
- Reconhecimento flexível de cabeçalhos (`Title`/`Título`/`Nome`, etc.).
- **Pré-visualização** dos primeiros 5 registos antes de importar.
- Escolha do **destino** (Board ID, Column ID e Lane ID opcional).
- **Barra de progresso em tempo real** ("Criados X de Y") via stream NDJSON.
- **Rate limiting** configurável + **retry/backoff** automático para o HTTP 429.
- Resolução opcional de `Assignee` (username/email → `owner_user_id`).
- Relatório final com a lista de **sucessos e falhas**.

---

## 🗂️ Estrutura de pastas

```
board-moneyball/
├── app/
│   ├── api/
│   │   └── import/
│   │       └── route.ts        # Route Handler: POST /api/import (stream NDJSON)
│   ├── globals.css             # Tailwind base
│   ├── layout.tsx              # Layout raiz
│   └── page.tsx                # UI principal (upload, preview, progresso)
├── components/
│   ├── FileDropzone.tsx        # Área de Drag & Drop
│   ├── PreviewTable.tsx        # Tabela de pré-visualização
│   └── ProgressPanel.tsx       # Barra de progresso + relatório
├── lib/
│   ├── businessmap.ts          # Cliente da API v2 (payload, retry, rate limit)
│   ├── csvClient.ts            # Parsing do CSV no browser (papaparse)
│   └── types.ts                # Contratos partilhados (frontend/backend)
├── samples/
│   └── example.csv             # CSV de exemplo
├── .env.example                # Variáveis de ambiente necessárias
├── package.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
└── tsconfig.json
```

---

## ⚙️ Variáveis de ambiente

Copia `.env.example` para `.env.local` e preenche:

```bash
cp .env.example .env.local
```

| Variável                    | Obrigatória | Descrição                                                                 |
| --------------------------- | :---------: | ------------------------------------------------------------------------- |
| `BUSINESSMAP_API_KEY`       |     ✅      | Chave de API (Account Settings → API). Enviada no cabeçalho `apikey`.     |
| `BUSINESSMAP_DOMAIN`        |     ✅      | Subdomínio da conta. Ex.: `acme` → `https://acme.kanbanize.com`.          |
| `BUSINESSMAP_RATE_LIMIT_MS` |     ❌      | Atraso (ms) entre chamadas à API. Defeito: `350`.                        |
| `BUSINESSMAP_MAX_RETRIES`   |     ❌      | Nº de tentativas em caso de 429/5xx. Defeito: `3`.                       |

> ⚠️ O `.env.local` está no `.gitignore` — **nunca** faças commit de segredos.

---

## 🚀 Como executar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar as variáveis de ambiente
cp .env.example .env.local   # e editar com os teus valores

# 3. Arrancar em modo desenvolvimento
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## 📄 Formato do CSV

O ficheiro deve ter uma linha de cabeçalho. Apenas **`Title` é obrigatório**.

```csv
Title,Description,Priority,Assignee
Configurar pipeline CI/CD,Criar workflow de build,High,joana.silva
Corrigir bug no login,Falha no SSO,Critical,12
```

- **Priority** aceita `low` / `average` / `high` / `critical` (e variações PT:
  `baixa`, `média`, `alta`, `crítica`, ou `1`–`4`).
- **Assignee** pode ser um `user_id` numérico, um `username` ou um `email`.
  A resolução de username/email é _best-effort_ (via `GET /api/v2/users`).

Há um exemplo pronto em [`samples/example.csv`](samples/example.csv).

---

## 🔌 Mapeamento para a API v2

Cada linha é convertida no payload de `POST /api/v2/cards`:

| CSV           | Campo da API v2  |
| ------------- | ---------------- |
| _(UI)_        | `board_id`       |
| _(UI)_        | `column_id`      |
| _(UI opc.)_   | `lane_id`        |
| `Title`       | `title`          |
| `Description` | `description`    |
| `Priority`    | `priority`       |
| `Assignee`    | `owner_user_id`  |

Referências: [Businessmap REST API Overview](https://knowledgebase.businessmap.io/hc/en-us/articles/360012393692-Businessmap-REST-API)
· OpenAPI interativa: `https://{dominio}.kanbanize.com/openapi`.

---

## 🛡️ Tratamento de erros

- **Configuração em falta** (API Key/domínio) → erro claro antes de arrancar.
- **CSV inválido** (sem `Title`, vazio) → mensagem no frontend.
- **HTTP 429 / 5xx** → retry automático com _exponential backoff_ (respeita o
  cabeçalho `Retry-After` quando presente).
- **Falha por cartão** → registada individualmente; a importação continua e o
  relatório final lista todos os cartões que falharam.
