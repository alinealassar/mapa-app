# Contexto do Projeto — Amiga de Bolso

> Última atualização: 16/06/2026 (sessão 3)

## Visão geral

**Produto:** Amiga de Bolso  
**IA (personagem):** Lis  
**Stack:** Next.js 16 App Router + TypeScript + Tailwind + Supabase + Anthropic Claude  
**Deploy:** Netlify (static export — `output: "export"` em `next.config.ts`)  
**Banco:** Supabase (projeto `hsgotkeydyvrollnzbbf`, região `sa-east-1`)  

---

## Arquitetura

```
Browser (Next.js static)
  │
  ├── Supabase Auth (login / sessão)
  ├── Supabase DB (mood_entries, profiles, user_memories, ai_analyses, weekly_summaries)
  ├── Supabase Storage (mood-audios — áudios gravados)
  └── Supabase Edge Functions
        ├── transcribe-audio      → Groq Whisper (transcrição de voz)
        ├── generate-mood-feedback → Anthropic Claude (resposta da Lis após registro)
        ├── generate-mapa-insights → Claude (padrões do Mapa emocional)
        ├── generate-weekly-summary → Claude (resumo semanal)
        ├── daily-reminder        → Firebase Cloud Messaging (push notification 20h)
        ├── weekly-summary-reminder → push de lembrete de resumo semanal
        ├── onboarding-emails     → Resend (e-mails de boas-vindas)
        └── backfill-memories     → retroalimenta user_memories com registros antigos
```

---

## Edge Functions — estado atual

### `transcribe-audio` (v8)
- Recebe `FormData` com campo `audio` (webm)
- Chama Groq Whisper (`whisper-large-v3-turbo`, idioma `pt`, formato `verbose_json`)
- Retorna `{ transcription: string, duration_seconds: number }`
- **Não usa** Claude — apenas transcrição

### `generate-mood-feedback` (v39) ← principal
- Chamada após cada registro de humor
- Recebe: `entry` (mood, scale, energy, tags, activities, note, note_source, audio_duration_seconds)
- Busca: perfil da usuária (name, goal), 5 registros recentes **com ai_feedback**, memórias semânticas (pgvector)
- Gera resposta personalizada com Claude
- Salva feedback em `mood_entries.ai_feedback` e em `ai_analyses`
- Salva memória da interação em `user_memories` (embedding gte-small)

**Modelos tentados em ordem (fallback automático):**
```
claude-opus-4-5-20250929
claude-sonnet-4-5-20250929
claude-opus-4-20250514
claude-sonnet-4-20250514
claude-3-7-sonnet-20250219
claude-3-5-sonnet-20241022
```
Abort imediato se API retornar 401 (chave inválida/expirada).

**Prompt — o que a Lis recebe:**
- Persona completa com regras de voz, lista de validações variadas (15 frases), categorias de sugestão com exemplos específicos
- 4 exemplos few-shot (bom vs. ruim) para calibrar estilo
- Contexto do registro atual
- Últimas 3 respostas da Lis (para evitar repetição de categoria de sugestão)
- Memórias semânticas relevantes (RAG)

### `generate-mapa-insights` (v30)
- Gera os "padrões que percebi" exibidos no Mapa
- Analisa todos os registros do período selecionado

### `generate-weekly-summary` (v31)
- Resumo semanal com título, padrões, dia mais leve/pesado
- Disparado pelo GitHub Actions (cron semanal)

### `daily-reminder` (v21)
- Push notification via Firebase Cloud Messaging às 20h
- Disparado pelo GitHub Actions

---

## Fluxo de áudio (nota pessoal gravada)

```
Usuária grava → MediaRecorder (webm) → blob
  → transcribe-audio (Groq Whisper) → transcribedText + duration_seconds
  → usuária vê transcrição editável
  → salva → handleSave:
      rawNote = transcribedText.trim() || note.trim()
      noteSource = "audio" | "text"
      maskedNote = maskSensitiveData(rawNote)
  → mood_entries insert (note = maskedNote, audio_url = Storage URL)
  → generate-mood-feedback (note + note_source + audio_duration_seconds)
  → Lis responde reconhecendo que foi áudio
```

---

## Variáveis de ambiente necessárias

### Supabase Secrets (Edge Functions)
| Variável | Valor esperado | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | chave da conta Anthropic | Claude — generate-mood-feedback, mapa-insights, weekly-summary |
| `GROQ_API_KEY` | chave da conta Groq | Whisper — transcribe-audio |
| `EMAIL_FROM` | `Lis <oi@amigadebolso.com.br>` | Remetente de todos os e-mails (daily-reminder + onboarding-emails) |
| `APP_URL` | `https://amigadebolso.com.br` | Links dentro dos e-mails |
| `SUPABASE_URL` | Auto-injetado pelo Supabase | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injetado pelo Supabase | — |

> ⚠️ `EMAIL_FROM` e `APP_URL` configurados em 05/06/2026. Domínio `amigadebolso.com.br` verificado no Resend na mesma data.

### Next.js (.env.local)
| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente Supabase |

---

## Problemas conhecidos e soluções

### ❌ Lis responde com mensagem genérica após registro de áudio
**Causa:** `generate-mood-feedback` retornava 500 — todos os modelos rejeitados pela Anthropic.  
**Diagnóstico:** Logs mostravam `status=400` com `"Your credit balance is too low"`.  
**Solução:** Recarregar crédito em [console.anthropic.com](https://console.anthropic.com) → Billing.  
**Prevenção:** A v37+ faz abort imediato em 401, logando `"API key inválida ou expirada"`.

### ❌ Lis sempre sugeria "tomar um chá" / mesmas sugestões
**Causa:** Persona tinha linha fixa `"Você gosta de coisas pequenas e concretas: chá, plantas, banho quente, livros"` — Claude usava exatamente esses exemplos.  
**Solução (v38/v39):**
- Removida a lista fixa da persona
- Adicionadas 6 categorias de sugestão com exemplos concretos e variados
- Adicionada instrução de rotacionar categorias
- Últimas 3 respostas da Lis passadas no prompt para evitar repetição explícita

### ❌ Respostas de validação repetitivas ("faz sentido", "entendo")
**Causa:** Persona não especificava variedade nas frases de abertura.  
**Solução (v39):** 15 frases de validação listadas na persona com instrução de nunca repetir a mesma duas vezes seguidas.

### ❌ URLs hardcoded apontavam para Render/Netlify em vez de amigadebolso.com.br
**Arquivos afetados:**
- `daily-reminder/index.ts` — fallback `https://meuapp1-app.netlify.app`
- `weekly-summary-reminder/index.ts` — fallback `https://meuapp1-app.netlify.app`
- `onboarding-emails/index.ts` — fallback `https://mapa-app-q3rh.onrender.com`
- `daily-reminder/reminder-template.html` — URL hardcoded `https://mapa-app-q3rh.onrender.com/registrar`

**Solução (16/06/2026):** fallbacks corrigidos para `https://amigadebolso.com.br` nos 3 `.ts`. O `reminder-template.html` foi marcado como **LEGADO** — não é usado (daily-reminder usa `EMAIL_TEMPLATE` inline). URL corrigida no arquivo mesmo assim.

---

### ❌ "Novo registro" não voltava ao topo da tela
**Causa:** `handleNewEntry` chamava `window.scrollTo({ top: 0 })`, mas o scroll container real é o `<div className="flex-1 overflow-y-auto">` interno — o `window` nunca tinha scroll.  
**Solução:** Adicionado `scrollContainerRef = useRef<HTMLDivElement>()` apontando para esse div; `handleNewEntry` agora chama `scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })`.

---

## Decisões de produto

- **Nome do produto:** Amiga de Bolso (renomeado em 27/05/2026; IA continua sendo "a Lis")
- **Deploy estático:** `output: "export"` — todas as páginas são `"use client"` + useEffect, sem server-side rendering
- **Cache:** `no-cache, must-revalidate` nos headers (netlify.toml) para que deploys apareçam sem limpar cache
- **Sem `pg_cron`:** Tarefas agendadas usam GitHub Actions (timeout do pg_cron é de 5s — insuficiente)
- **Notificações:** Firebase Cloud Messaging para push; Resend para e-mails

---

## Estrutura de arquivos relevantes

```
app/
  layout.tsx              — metadata "Amiga de Bolso", min-h-[100dvh]
  registrar/page.tsx      — página principal (MoodRegister + BottomNav)
  mapa/page.tsx           — aba Mapa (gráficos, resumo semanal, insights)
  historico/page.tsx      — aba Momentos (histórico de registros)
  eu/page.tsx             — aba Perfil (configurações, lembretes, senha)
  sobre/page.tsx          — página "Sobre a Lis"
  login/page.tsx          — login / cadastro
  onboarding/page.tsx     — onboarding (WelcomeStep, GoalStep, NameStep)
  components/
    MoodRegister.tsx      — tela de registro (humor, nota, áudio, tags, atividades)
    MoodHistory.tsx       — lista de registros históricos
    BottomNav.tsx         — navegação inferior (Diário, Mapa, Momentos, Perfil)
    ChangePasswordModal.tsx — modal troca de senha (sem campo "senha atual")
    RemindersPrompt.tsx   — prompt de ativação de notificações
lib/
  safety.ts               — maskSensitiveData, containsCrisisKeywords
  supabaseClient.ts       — cliente Supabase singleton
  hooks/useNotifications.ts — hook para push notifications
supabase/
  functions/
    generate-mood-feedback/index.ts  — v39 (sincronizar sempre que deployar)
    transcribe-audio/index.ts        — v8
    ...
```

---

### Sessão 19/06/2026 — Varredura de bugs + correção das Edge Functions + prompts para braços

**Fluxo:** cérebro lendo CONTEXTO.md + PLANEJAMENTO.md, fazendo varredura via MCP e Grep no repositório, corrigindo Edge Functions diretamente via Supabase MCP, gerando prompts self-contained para os braços executarem as correções de frontend.

**O que aconteceu:**

1. **PLANO.md atualizado** — documento estava desatualizado desde 08/05/2026 (5+ semanas). Reescrito por completo para refletir o estado atual em 15/06/2026: 10 sprints completos, histórico de renomeações (Mapa → Lis → Amiga de Bolso), infraestrutura de domínio (amigadebolso.com.br), landing, Instagram (@colodalis), modelo de preço (R$24,90/mês ou R$249/ano). Arquivo em `D:\ALINE\Projetos\Diario com IA\mapa-app\PLANO.md`.

2. **Varredura geral do codebase** — revisão de todos os arquivos conhecidos (Edge Functions via Supabase MCP, código frontend via histórico + CONTEXTO.md). Resultado:

   **Bugs críticos novos encontrados:**
   - `daily-reminder/index.ts`: `webpush.fcm_options.link` usava string literal `"${APP_URL}/registrar"` em vez de template literal — `${APP_URL}` não era interpolado, push levava usuária à string literal, não ao site real.
   - `weekly-summary-reminder/index.ts`: mesmo bug, `"${APP_URL}/mapa"`.

   **Bugs conhecidos confirmados (ainda abertos):**
   - `/recuperar-senha` não mostra estado de sucesso "Quase lá! 💌" após submit (documentado em 02/06)
   - Casulo Sonoro: "Ruído marrom" toca arquivo errado (documentado em 19/05)
   - Casulo Sonoro: sons carregados de URLs externas frágeis (Google/googleapis)
   - `/eu`: email da usuária não exibido (braço removeu acidentalmente em 22/05)
   - Reset Password email template nunca aplicado no Supabase Dashboard (item manual)

3. **Bug de push corrigido diretamente via MCP** (sem braço):
   - `daily-reminder` → v27: `"${APP_URL}/registrar"` → `` `${APP_URL}/registrar` ``
   - `weekly-summary-reminder` → v18: `"${APP_URL}/mapa"` → `` `${APP_URL}/mapa` ``
   - Ambas deployadas em 19/06/2026 e ATIVAS.

4. **PROMPTS_BRACOS.md criado** em `D:\ALINE\Projetos\Diario com IA\mapa-app\PROMPTS_BRACOS.md` — 3 prompts self-contained para os braços, cada um com contexto do projeto, arquivo exato, o que mudar, o que NÃO mudar, e como verificar:
   - **Prompt A:** `/recuperar-senha` sem estado de sucesso
   - **Prompt B:** `/eu` sem email da usuária
   - **Prompt C:** Casulo Sonoro (arquivo errado + URLs externas frágeis)
   - Plus: lembrete de ação manual da Aline (Reset Password template no Supabase Dashboard)

**🐛 Status dos bugs após esta sessão:**

| Bug | Status |
|-----|--------|
| Push link diário quebrado (`daily-reminder`) | ✅ Corrigido (v27, 19/06) |
| Push link semanal quebrado (`weekly-summary-reminder`) | ✅ Corrigido (v18, 19/06) |
| `/recuperar-senha` sem estado de sucesso | ⏳ Pendente — Prompt A em PROMPTS_BRACOS.md |
| `/eu` sem email da usuária | ⏳ Pendente — Prompt B em PROMPTS_BRACOS.md |
| Casulo Sonoro: arquivo errado + URLs frágeis | ⏳ Pendente — Prompt C em PROMPTS_BRACOS.md |
| Reset Password template no Supabase Dashboard | ⏳ Pendente — ação manual da Aline |

**📋 Arquivos criados/atualizados nesta sessão:**
- `PLANO.md` — reescrito (15/06/2026)
- `PROMPTS_BRACOS.md` — novo, prompts self-contained para braços
- `daily-reminder` v27 — deployado (fix push link)
- `weekly-summary-reminder` v18 — deployado (fix push link)

**Próximos passos:**
1. Braços executam Prompts A, B, C
2. Aline aplica Reset Password template no Supabase Dashboard manualmente
3. Continuar Sprint 4 (Paywall + Mercado Pago)

2. **Varredura geral do codebase** — revisão de todos os arquivos conhecidos (Edge Functions via Supabase MCP, código frontend via histórico + CONTEXTO.md). Resultado:

   **Bugs críticos novos encontrados:**
   - `daily-reminder/index.ts`: `webpush.fcm_options.link` usava string literal `"${APP_URL}/registrar"` em vez de template literal — `${APP_URL}` não era interpolado, push levava usuária à string literal, não ao site real.
   - `weekly-summary-reminder/index.ts`: mesmo bug, `"${APP_URL}/mapa"`.

   **Bugs conhecidos confirmados (ainda abertos):**
   - `/recuperar-senha` não mostra estado de sucesso "Quase lá! 💌" após submit (documentado em 02/06)
   - Casulo Sonoro: "Ruído marrom" toca arquivo errado (documentado em 19/05)
   - Casulo Sonoro: sons carregados de URLs externas frágeis (Google/googleapis)
   - `/eu`: email da usuária não exibido (braço removeu acidentalmente em 22/05)
   - Reset Password email template nunca aplicado no Supabase Dashboard (item manual)

3. **Bug de push corrigido diretamente via MCP** (sem braço):
   - `daily-reminder` → v27: `"${APP_URL}/registrar"` → `` `${APP_URL}/registrar` ``
   - `weekly-summary-reminder` → v18: `"${APP_URL}/mapa"` → `` `${APP_URL}/mapa` ``
   - Ambas deployadas em 19/06/2026 e ATIVAS.

4. **PROMPTS_BRACOS.md criado** em `D:\ALINE\Projetos\Diario com IA\mapa-app\PROMPTS_BRACOS.md` — 3 prompts self-contained para os braços, cada um com contexto do projeto, arquivo exato, o que mudar, o que NÃO mudar, e como verificar:
   - **Prompt A:** `/recuperar-senha` sem estado de sucesso
   - **Prompt B:** `/eu` sem email da usuária
   - **Prompt C:** Casulo Sonoro (arquivo errado + URLs externas frágeis)
   - Plus: lembrete de ação manual da Aline (Reset Password template no Supabase Dashboard)

**🐛 Status dos bugs após esta sessão:**

| Bug | Status |
|-----|--------|
| Push link diário quebrado (`daily-reminder`) | ✅ Corrigido (v27, 19/06) |
| Push link semanal quebrado (`weekly-summary-reminder`) | ✅ Corrigido (v18, 19/06) |
| `/recuperar-senha` sem estado de sucesso | ⏳ Pendente — Prompt A em PROMPTS_BRACOS.md |
| `/eu` sem email da usuária | ⏳ Pendente — Prompt B em PROMPTS_BRACOS.md |
| Casulo Sonoro: arquivo errado + URLs frágeis | ⏳ Pendente — Prompt C em PROMPTS_BRACOS.md |
| Reset Password template no Supabase Dashboard | ⏳ Pendente — ação manual da Aline |

**📋 Arquivos criados/atualizados nesta sessão:**
- `PLANO.md` — reescrito (15/06/2026)
- `PROMPTS_BRACOS.md` — novo, prompts self-contained para braços
- `daily-reminder` v27 — deployado (fix push link)
- `weekly-summary-reminder` v18 — deployado (fix push link)

**Próximos passos:**
1. Braços executam Prompts A, B, C
2. Aline aplica Reset Password template no Supabase Dashboard manualmente
3. Continuar Sprint 4 (Paywall + Mercado Pago)
