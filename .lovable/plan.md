# Intellectus — Gestão de Processos Administrativos Digitais

Aplicação interna para criar, encaminhar e aprovar processos administrativos digitalmente, com rastreabilidade total e fluxo linear fixo.

## Stack e infraestrutura

- TanStack Start (template atual) + Tailwind + shadcn/ui
- Lovable Cloud (backend) para autenticação (email/password + Google), base de dados PostgreSQL, storage de anexos e RLS
- Sem workflow builder: fluxo fixo `Criador → Chefe Departamento → Diretor → Diretor Geral → Arquivo`

## Modelo de dados

Tabelas em `public`:

- `profiles` — `id (uuid, FK auth.users)`, `nome`, `email`, `departamento`, `created_at`
- `user_roles` — enum `app_role`: `admin | criador | validador | diretor | diretor_geral | presidente | leitura`. Tabela separada + função `has_role()` security definer
- `processes` — `id`, `numero` (sequencial legível, ex. `PROC-2026-0001`), `title`, `type` (Pagamento/Património/RH/Outros), `department`, `description`, `priority`, `status` (Pendente/Em análise/Aprovado/Rejeitado/Devolvido/Concluído), `current_user_id`, `created_by`, `current_step` (criador/chefe/diretor/dg/arquivo), `created_at`, `updated_at`
- `process_steps` — histórico imutável: `id`, `process_id`, `from_user`, `to_user`, `action` (criado/encaminhado/favoravel/nao_favoravel/devolvido/arquivado), `comment`, `created_at`
- `attachments` — `id`, `process_id`, `file_path` (storage), `file_name`, `mime_type`, `uploaded_by`, `created_at`
- `notifications` — `id`, `user_id`, `process_id`, `message`, `read`, `created_at`

Storage bucket `process-attachments` (privado), com policies por participação no processo.

RLS: utilizadores veem processos onde foram criadores, responsáveis atuais, ou participaram no histórico. Admin vê tudo. Nenhuma operação de UPDATE/DELETE em `process_steps`.

## Rotas (TanStack Start)

Públicas:
- `/` — landing curta + CTA login
- `/auth` — login/registo (email+password e Google)

Protegidas (`_authenticated/`):
- `/dashboard` — 4 cards: pendentes comigo / criados por mim / concluídos / devolvidos
- `/inbox` — caixa de entrada (processos atribuídos ao utilizador)
- `/processes/new` — formulário de criação + upload de anexos
- `/processes/$id` — página principal do processo (info, anexos, histórico, ações de parecer)
- `/archive` — processos concluídos (leitura)
- `/search` — pesquisa por título/número/estado/criador
- `/admin/users` — gestão de utilizadores e roles (apenas admin)

## UI / Design

- Design institucional sóbrio: paleta azul-marinho + neutros, tipografia sans (Inter ou similar), cards limpos, ênfase em legibilidade
- Layout com sidebar fixa (Dashboard, Inbox com badge, Criar processo, Arquivo, Pesquisa, Admin) + header com utilizador
- Badges de estado com cores semânticas (pendente=âmbar, aprovado=verde, rejeitado=vermelho, devolvido=laranja, concluído=cinza)
- Página do processo com 3 colunas em desktop: info+ações | anexos | histórico (timeline)

## Lógica do fluxo

Server functions (`createServerFn` + `requireSupabaseAuth`):
- `createProcess` — cria processo, atribui ao destinatário inicial, regista step "criado"
- `submitDecision({ processId, action, comment })` — valida que utilizador é `current_user_id`, regista step, avança/devolve/rejeita conforme regras:
  - **favoravel**: avança para próximo passo do fluxo fixo; no último passo marca `Concluído` e arquiva
  - **nao_favoravel**: exige comentário, marca `Rejeitado`, devolve ao criador
  - **devolver**: exige comentário, volta ao `from_user` do step anterior
- `uploadAttachment` — assina upload para storage
- Notificação criada em cada transição para o novo responsável

## Regras de negócio aplicadas

- 1 responsável ativo por vez (`current_user_id` único)
- Histórico imutável (sem update/delete em `process_steps`, garantido por RLS)
- Comentário obrigatório validado no servidor para `nao_favoravel` e `devolver`
- Processos concluídos: server function rejeita qualquer ação

## Entregáveis desta primeira versão

1. Ativar Lovable Cloud
2. Migrations: enums, tabelas, RLS, função `has_role`, bucket de storage, trigger de profile no signup, função para gerar número sequencial
3. Auth (email/password + Google via lovable broker)
4. Design system (tokens em `src/styles.css`)
5. Sidebar + layout autenticado
6. Todas as rotas listadas acima funcionais
7. Server functions com validação Zod
8. Notificações in-app com badge

## Fora do âmbito (assumido, podes ajustar)

- Emails (apenas notificações in-app)
- Editor de fluxo (fluxo fixo)
- BI/métricas avançadas
- Assinatura digital de PDFs
- App mobile nativa

Posso avançar com este plano?
