// generate-weekly-summary v6 — semana dom-sab (era seg-dom)
// v6 (17/05/2026): mudanca de produto. Agora a "semana" comeca no domingo
// e termina no sabado, em vez de segunda-domingo. Motivo: domingo de manha
// e' o momento ideal pra revisitar a semana (pausa, contemplacao) em vez
// da segunda agitada. Resumos antigos em cache com week_start segunda
// ficam orfaos no banco (preservados, nao apagados — decisao 17/05).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODELS_TO_TRY = [
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-5",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// === PERSONA OFICIAL DA LIS (07/05/2026) ===
const LIS_PERSONA = `Você é a Lis, a IA do Mapa — um diario emocional para mulheres jovens brasileiras.

QUEM VOCÊ É:
- Mulher, em torno de 30 anos, em português brasileiro coloquial mas cuidadoso
- Pensa antes de falar; não fala muito
- Você não é terapeuta nem coach — é mais como uma amiga atenta que ouviu muito
- Você gosta de coisas pequenas e concretas: chá, plantas, banho quente, livros
- Você NÃO usa: 'tudo vai dar certo', 'você consegue', 'pensamento positivo', 'positividade', 'foco no que importa', 'energia boa', 'vibrações', 'querida', 'linda', exclamações excessivas, máximas motivacionais
- Você NÃO minimiza com: 'vai passar', 'poderia ser pior', 'é só isso', 'todo mundo se sente assim'
- Você USA: validações curtas ('faz sentido', 'entendo', 'isso pesa mesmo'), observações específicas (cita o que ela registrou com número), micro-sugestões físicas e pequenas
- Você NUNCA diagnostica, nunca prescreve, nunca substitui terapia
- Você reconhece que a culpa por 'não dar conta' é a dor central da maioria das pessoas que falam com você — nunca reforça essa culpa, sempre tira o peso

COMO VOCÊ FALA:
- Frases curtas
- Raramente exclamação
- Não usa emoji em conteúdo estruturado (JSON)
- Nunca começa com 'Oi' ou 'Olá'
`;

function maskSensitiveData(text: string | null | undefined): string {
  if (!text) return "";
  let masked = text;
  masked = masked.replace(/(?:\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})|(?:\d{11})/g, "[CPF PROTEGIDO]");
  masked = masked.replace(/(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})-?(\d{4}))/g, (m) => {
    const numbersOnly = m.replace(/\D/g, "");
    if (numbersOnly.length >= 8 && numbersOnly.length <= 13) return "[TELEFONE PROTEGIDO]";
    return m;
  });
  return masked;
}

interface MoodEntry {
  mood_emoji: string;
  mood_scale: number;
  energy_level: number | null;
  tags: string[] | null;
  activities: string[] | null;
  note: string | null;
  created_at: string;
  sleep_quality: "good" | "ok" | "bad" | null;
  sleep_hours: number | null;
  screen_time_hours: number | null;
}

// === MEMÓRIA SEMÂNTICA ===
// deno-lint-ignore no-explicit-any
const aiSession = new (Supabase as any).ai.Session("gte-small");

async function generateEmbedding(text: string): Promise<number[]> {
  const embedding = await aiSession.run(text, { mean_pool: true, normalize: true });
  return embedding as number[];
}

const MOOD_LABELS: Record<string, string> = { pessima: "péssima", mal: "mal", neutra: "neutra", bem: "bem", otima: "ótima" };
const SLEEP_QUALITY_LABELS: Record<string, string> = { good: "acordou bem", ok: "acordou mais ou menos", bad: "acordou mal" };
const GOAL_LABELS: Record<string, string> = {
  culpa: "lidar com a culpa de não dar conta", ansiedade: "diminuir a ansiedade",
  autocuidado: "criar hábito de autocuidado", energia: "ter mais energia no dia a dia",
  solidao: "se sentir menos sozinha",
};
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// Retorna a ultima semana FECHADA (domingo a sabado, UTC).
// Se hoje for domingo, retorna a semana que terminou ontem (sabado).
function computeLastWeek(now: Date): { weekStart: Date; weekEnd: Date } {
  const today = new Date(now);
  const day = today.getUTCDay(); // 0=dom, 1=seg, ..., 6=sab
  // Quantos dias atras esta o domingo desta semana
  const daysToCurrentSunday = day;
  const currentSunday = new Date(today);
  currentSunday.setUTCDate(today.getUTCDate() - daysToCurrentSunday);
  currentSunday.setUTCHours(0, 0, 0, 0);
  // Semana anterior comeca 7 dias antes do domingo atual
  const weekStart = new Date(currentSunday);
  weekStart.setUTCDate(currentSunday.getUTCDate() - 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function formatDateBR(d: Date): string { return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }

function buildPrompts(entries: MoodEntry[], userName: string, goal: string | null, weekStart: Date, weekEnd: Date, relevantMemories: string[]): { systemPrompt: string; userPrompt: string } {
  const entriesWithSleep = entries.filter((e) => e.sleep_quality !== null || e.sleep_hours !== null);
  const hasSleepData = entriesWithSleep.length >= 2;
  const entriesWithScreen = entries.filter((e) => e.screen_time_hours !== null);
  const hasScreenData = entriesWithScreen.length >= 2;

  const sleepInstruction = hasSleepData
    ? `- Você tem dados de sono em alguns registros. Se houver correlação sono-humor, mencione no campo 'pattern' citando números. Se não, ignore.`
    : `- Não há dados de sono suficientes; não mencione sono.`;
  const screenInstruction = hasScreenData
    ? `- Você tem dados de tempo de tela. Anti-culpa absoluto: NUNCA julgue ('você passou demais'). Se houver correlação factual, mencione no 'pattern' citando números. Se não, ignore.`
    : `- Não há dados de tempo de tela suficientes; não mencione celular.`;

  let systemPrompt = `${LIS_PERSONA}

TAREFA AGORA: gerar resumo da semana de ${userName} em formato JSON estruturado.

REGRAS:
- Cite SEMPRE números e termos exatos dos dados
- O objetivo dela: ${goal && GOAL_LABELS[goal] ? GOAL_LABELS[goal] : "se conhecer melhor"}
${sleepInstruction}
${screenInstruction}`;

  if (relevantMemories.length > 0) {
    systemPrompt += `\n
VOCÊ TEM MEMÓRIA. Abaixo há 'MEMÓRIAS RELEVANTES' do passado de ${userName}.
- Use esse histórico para enriquecer o campo 'summary' ou 'pattern'.
- Observe se os padrões desta semana são uma melhora, uma repetição ou uma mudança em relação ao que ela já viveu antes.`;
  }

  systemPrompt += `\n\nFORMATO OBRIGATÓRIO: responda APENAS com JSON válido (sem texto antes ou depois, sem markdown, sem cercas de código). Estrutura:
{
  "title": "título curto e poético da semana, máximo 6 palavras",
  "summary": "3 a 4 frases que conectam a semana inteira, com tom afetuoso. Cite números e compare com o passado se houver memória relevante.",
  "lightest_day": "frase curta sobre o dia mais leve",
  "heaviest_day": "frase curta sobre o dia mais pesado",
  "top_feelings": ["sentimento1", "sentimento2", "sentimento3"],
  "pattern": "1 padrão concreto observado, citando dados. Conecte com histórico se relevante.",
  "closing": "1 frase curta de fechamento acolhedor, máximo 15 palavras"
}`;

  let userPrompt = `Resumo da semana de ${userName}, de domingo ${formatDateBR(weekStart)} a sábado ${formatDateBR(weekEnd)}.\n\n${entries.length} registros nessa semana:\n\n`;
  entries.forEach((e, i) => {
    const date = new Date(e.created_at);
    const weekday = WEEKDAY_NAMES[date.getUTCDay()];
    const dateStr = formatDateBR(date);
    userPrompt += `${i + 1}. ${weekday} ${dateStr}: humor ${MOOD_LABELS[e.mood_emoji] || e.mood_emoji} (${e.mood_scale}/10)`;
    if (e.energy_level) userPrompt += `, energia ${e.energy_level}/6`;
    if (e.tags && e.tags.length > 0) userPrompt += `, sentimentos: ${e.tags.join(", ")}`;
    if (e.activities && e.activities.length > 0) userPrompt += `, atividades: ${e.activities.join(", ")}`;
    if (e.sleep_quality || e.sleep_hours !== null) {
      const sleepParts: string[] = [];
      if (e.sleep_quality && SLEEP_QUALITY_LABELS[e.sleep_quality]) sleepParts.push(SLEEP_QUALITY_LABELS[e.sleep_quality]);
      if (e.sleep_hours !== null) sleepParts.push(`${e.sleep_hours}h dormidas`);
      userPrompt += `, sono: ${sleepParts.join(", ")}`;
    }
    if (e.screen_time_hours !== null) userPrompt += `, celular: ${e.screen_time_hours}h`;
    if (e.note) userPrompt += `, nota: "${maskSensitiveData(e.note).slice(0, 200)}"`;
    userPrompt += `\n`;
  });

  if (relevantMemories.length > 0) {
    userPrompt += `\nMEMÓRIAS RELEVANTES do passado de ${userName}:\n`;
    relevantMemories.forEach((m, i) => {
      userPrompt += `  ${i + 1}. ${m}\n`;
    });
  }

  userPrompt += `\nGere o resumo no formato JSON especificado.`;
  return { systemPrompt, userPrompt };
}

async function callClaude(model: string, systemPrompt: string, userPrompt: string, apiKey: string): Promise<{ ok: boolean; status: number; body: string; data?: unknown }> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 700, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body: text };
  try { return { ok: true, status: 200, body: text, data: JSON.parse(text) }; } catch { return { ok: false, status: r.status, body: text }; }
}

function extractJson(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch {
    const first = text.indexOf("{"); const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      try { return JSON.parse(text.slice(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Token ausente" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY ausente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Usuária não autenticada" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { weekStart, weekEnd } = computeLastWeek(new Date());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const { data: existing } = await supabase.from("weekly_summaries").select("id, week_start, summary_text, patterns, created_at").eq("user_id", user.id).eq("week_start", weekStartStr).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ summary: existing, source: "cache", week_start: weekStartStr, week_end: weekEnd.toISOString().slice(0, 10) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: entries } = await supabase.from("mood_entries").select("mood_emoji, mood_scale, energy_level, tags, activities, note, created_at, sleep_quality, sleep_hours, screen_time_hours").eq("user_id", user.id).gte("created_at", weekStart.toISOString()).lte("created_at", weekEnd.toISOString()).order("created_at", { ascending: true });
    if (!entries || entries.length < 3) {
      return new Response(JSON.stringify({ summary: null, source: "too_few_entries", count: entries?.length || 0, week_start: weekStartStr, week_end: weekEnd.toISOString().slice(0, 10) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: profile } = await supabase.from("profiles").select("name, goal").eq("id", user.id).single();
    const userName = profile?.name || "você";
    const goal = profile?.goal || null;

    // === BUSCAR MEMÓRIAS RELEVANTES ===
    let relevantMemories: string[] = [];
    try {
      const allTags = entries.flatMap((e) => e.tags || []);
      const tagCounts = allTags.reduce((acc, tag) => { acc[tag] = (acc[tag] || 0) + 1; return acc; }, {} as Record<string, number>);
      const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map((t) => t[0]);
      
      const queryText = topTags.length > 0 
        ? `humor com sentimentos: ${topTags.join(", ")}` 
        : `humor geral e atividades de ${userName}`;
        
      const queryEmbedding = await generateEmbedding(queryText);
      const { data: memories, error: memErr } = await supabase.rpc("match_memories", {
        query_embedding: queryEmbedding,
        match_threshold: 0.65,
        match_count: 5,
        p_user_id: user.id,
      });
      if (memErr) {
        console.error("Erro match_memories:", memErr.message);
      } else if (memories && memories.length > 0) {
        relevantMemories = (memories as Array<{ content: string }>).map((m) => m.content);
      }
    } catch (e) {
      console.error("Falha ao buscar memórias:", e instanceof Error ? e.message : e);
    }

    const { systemPrompt, userPrompt } = buildPrompts(entries as MoodEntry[], userName, goal, weekStart, weekEnd, relevantMemories);
    const attempts: Array<{ model: string; status: number; body: string }> = [];
    for (const model of MODELS_TO_TRY) {
      const result = await callClaude(model, systemPrompt, userPrompt, ANTHROPIC_API_KEY);
      if (result.ok && result.data) {
        const claudeData = result.data as { content: Array<{ type: string; text: string }> };
        const rawText = claudeData.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
        const parsed = extractJson(rawText);
        if (!parsed || !parsed.summary || !parsed.title) {
          attempts.push({ model, status: 200, body: "JSON inválido: " + rawText.slice(0, 200) });
          continue;
        }
        const { data: saved, error: insertError } = await supabase.from("weekly_summaries").insert({
          user_id: user.id, week_start: weekStartStr, summary_text: parsed.summary,
          patterns: { title: parsed.title, lightest_day: parsed.lightest_day, heaviest_day: parsed.heaviest_day, top_feelings: parsed.top_feelings, pattern: parsed.pattern, closing: parsed.closing, entries_count: entries.length, model_used: model },
        }).select().single();
        if (insertError) {
          console.error("Erro ao salvar weekly_summary:", insertError);
          return new Response(JSON.stringify({ summary: { week_start: weekStartStr, summary_text: parsed.summary, patterns: parsed, created_at: new Date().toISOString() }, source: "ai_unsaved", save_error: insertError.message, week_end: weekEnd.toISOString().slice(0, 10) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ summary: saved, source: "ai", week_end: weekEnd.toISOString().slice(0, 10) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      attempts.push({ model, status: result.status, body: result.body });
      console.error(`Modelo ${model} falhou ${result.status}: ${result.body}`);
    }
    return new Response(JSON.stringify({ error: "Nenhum modelo aceitou", attempts }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: "Erro interno", details: error instanceof Error ? error.message : "desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
