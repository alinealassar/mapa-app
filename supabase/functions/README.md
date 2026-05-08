# Edge Functions do Mapa

Este diretório contém o **código-fonte versionado** das 3 Edge Functions deployadas no Supabase do projeto `hsgotkeydyvrollnzbbf`.

## Functions

| Função | Versão | Descrição |
|---|---|---|
| `generate-mood-feedback` | v12 | Feedback da Lis após cada registro. Inclui memória semântica (gte-small + pgvector) — gera embedding ao salvar e busca top-3 memórias relevantes antes de chamar Claude. |
| `generate-mapa-insights` | v5 | Análise de padrões "O que percebi" no /mapa. Persona Lis + masking + correlação tripla (sono × tela × humor). |
| `generate-weekly-summary` | v5 | Resumo semanal do /mapa em JSON estruturado. Persona Lis + masking + correlação tripla. Cache por week_start na tabela `weekly_summaries`. |

## Protocolo de deploy (IMPORTANTE)

Esta pasta é **fonte da verdade**. Toda mudança em Edge Function segue o protocolo:

1. **Edita o arquivo local** `supabase/functions/<nome>/index.ts`
2. **Faz `git add` + `git commit`** com mensagem descritiva
3. **Faz `deploy_edge_function`** via MCP do Supabase passando o conteúdo do arquivo local
4. **`git push origin main`** (versionamento garantido)

O fluxo NÃO é: edita direto no Supabase Dashboard nem deploya sem antes salvar local. Senão volta ao problema antigo de drift entre o que está deployado e o que está versionado.

## Secrets necessários no Supabase

As 3 functions usam estes secrets (já configurados em `Project Settings → Edge Functions → Secrets`):

- `ANTHROPIC_API_KEY` — chave da Anthropic (Claude). Necessita saldo na conta `console.anthropic.com`.
- `SUPABASE_URL` — auto-injetado pelo Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injetado pelo Supabase

## Persona da Lis

A constante `LIS_PERSONA` aparece copiada nas 3 funções. **Quando atualizar, atualizar nas 3** (mantém a voz consistente da IA em qualquer fluxo). Detalhe da persona em `CONTEXTO.md.txt` (seção "Persona da Lis").

## Memória semântica

A `generate-mood-feedback` v12 usa `Supabase.ai.Session("gte-small")` (384 dims, gratuito, embutido no Edge Runtime) pra gerar embeddings. Tabela `user_memories` + RPC `match_memories(query_embedding, threshold, count, user_id)`. Threshold padrão: 0.65, top 3 memórias.
