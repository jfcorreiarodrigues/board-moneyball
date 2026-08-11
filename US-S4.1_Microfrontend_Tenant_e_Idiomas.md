# S4.1 — Microfrontend de Consentimentos · novas US

Duas capacidades levantadas em refinamento, para o **microfrontend de recolha/gestão de
consentimentos** (peça S4.1):

1. **US-S4.1-14** — o mesmo componente serve empresas diferentes, com catálogo e textos próprios por tenant.
2. **US-S4.1-15** — o componente está disponível em **PT, ES e EN** para todos os tenants (estende a US-T4-01, que cobria só PT/ES).

Ambas assentam no princípio já existente do S4.1: **um único componente distribuível, configurado — nunca duplicado (fork) — por canal, tenant ou idioma.**

---

## US-S4.1-14 — Versão do microfrontend por empresa (tenant)

> **Como** Responsável de canal digital / Gestor de tenant
> **Quero** que o microfrontend apresente o catálogo, os textos e a configuração da empresa (tenant) em que está embutido
> **Para** que CTT e CTT Express tenham finalidades e textos próprios, sem manter versões de código separadas

**Requisitos:** RF-MS (multi-tenant) · **Prioridade:** Must
**Depende de:** US-T3-01 / US-T3-03 (segregação e configuração por tenant), US-S6.1-03 (conteúdos por tenant)

### Critérios de aceitação (BDD)

**Cenário: Happy path — carregar no tenant CTT**
- **Dado** que o componente é inicializado com `tenant = "CTT"`
- **Quando** o microfrontend carrega
- **Então** apresenta as finalidades, sub-opções e parceiros ativos do CTT
- **E** apresenta o texto legal em vigor de cada finalidade nesse tenant

**Cenário: Happy path — mesmo componente no tenant CTT Express**
- **Dado** que a mesma distribuição do componente é inicializada com `tenant = "CTT Express"`
- **Quando** o microfrontend carrega
- **Então** apresenta o catálogo e os textos do CTT Express, que podem diferir dos do CTT
- **E** nenhuma finalidade ou texto de outro tenant é apresentado

**Cenário: Edge case — finalidade ativa só num tenant**
- **Dado** que uma finalidade está ativa no CTT mas inativa no CTT Express
- **Quando** o componente carrega no CTT Express
- **Então** essa finalidade não é apresentada

**Cenário: Edge case — tenant em falta ou inválido**
- **Dado** que o componente é inicializado sem `tenant` ou com um valor inválido
- **Quando** tenta carregar
- **Então** não apresenta finalidades e devolve um erro de configuração
- **E** não assume nenhum tenant por defeito

### Regras de negócio a respeitar
- O `tenant` é um **parâmetro de inicialização** do componente — não é deduzido do utilizador.
- O catálogo (finalidades, sub-opções, parceiros) e os textos legais são resolvidos **por tenant**, via API de conteúdos (S6.1), sem duplicar lógica.
- A **mesma distribuição** do componente serve todos os tenants: multi-tenant por configuração, não por fork.
- Segregação estrita: um tenant nunca vê dados nem configuração de outro (alinha com US-T3-01/03).

---

## US-S4.1-15 — Microfrontend disponível em PT, ES e EN (todos os tenants)

> **Como** Cliente / Utilizador que dá ou gere consentimento
> **Quero** usar o microfrontend em português, espanhol ou inglês
> **Para** decidir sobre os meus consentimentos na minha língua, em qualquer empresa do grupo

**Requisitos:** RNF (i18n) · **Prioridade:** Must
**Estende:** US-T4-01 (interface PT/ES) — acrescenta **EN** e fixa a regra para o microfrontend
**Depende de:** US-S6.1 (textos legais por idioma)

### Critérios de aceitação (BDD)

**Cenário: Happy path — seleção de idioma**
- **Dado** que o microfrontend está disponível em `PT`, `ES` e `EN`
- **Quando** o utilizador seleciona `EN`
- **Então** todos os elementos de interface (rótulos, ações, mensagens) são apresentados em inglês
- **E** o texto legal aplicável é apresentado em inglês

**Cenário: Happy path — idioma por defeito**
- **Dado** que um utilizador acede pela primeira vez
- **Quando** o componente carrega
- **Então** o idioma inicial segue a preferência do utilizador/browser
- **E** o recurso por defeito é o idioma configurado para o tenant (ex.: PT)

**Cenário: Happy path — disponível para todos os tenants**
- **Dado** os tenants CTT e CTT Express
- **Quando** o componente carrega em qualquer um deles
- **Então** os três idiomas (PT, ES, EN) estão disponíveis em ambos

**Cenário: Edge case — texto legal sem tradução no idioma pedido**
- **Dado** que o texto legal de uma finalidade não existe no idioma selecionado
- **Quando** o componente tenta apresentá-lo
- **Então** aplica o idioma de fallback do tenant e assinala essa condição
- **E** nunca apresenta uma sub-opção de consentimento sem o texto legal correspondente

**Cenário: Edge case — troca de idioma a meio da jornada**
- **Dado** que o utilizador já tomou decisões numa língua
- **Quando** muda de idioma
- **Então** as decisões já tomadas mantêm-se inalteradas
- **E** o significado das operações não muda

### Regras de negócio a respeitar
- Os **três idiomas (PT, ES, EN)** estão disponíveis para **todos os tenants**.
- Todas as cadeias de interface têm tradução nos três idiomas; **nenhuma cadeia fica só numa língua**.
- O texto legal em vigor é obtido no idioma pedido via S6.1; havendo lacuna, aplica-se o **fallback do tenant** e regista-se a ocorrência.
- O idioma é uma **preferência do utilizador** e não altera o significado nem o registo do consentimento — o identificador continua a ser o e-mail e a decisão é a mesma, independentemente da língua.

---

## Notas para o backlog

- As duas US pertencem à peça **S4.1 — Microfrontend de Consentimentos (React)** e podem entrar como *Deliverables* na mesma equipa das restantes US-S4.1.
- **US-S4.1-15 substitui, no âmbito do microfrontend, o alcance da US-T4-01** (que assumia apenas PT/ES). Convém anotar essa relação para evitar requisitos contraditórios sobre idiomas suportados.
- Confirmar com o dotCMS (S6.1) que os textos legais passam a ter as três variantes de idioma por finalidade e por tenant.
