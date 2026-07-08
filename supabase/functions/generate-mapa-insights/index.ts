// generate-mapa-insights v38 — fix fuso BRT nos registros, sincroniza persona
// v38 (08/07/2026): fix weekday/hora em BRT nos registros (era UTC); remove linha
//   "cha/plantas/banho" da persona; sincroniza LIS_PERSONA com generate-mood-feedback.
// v6 (17/05/2026): aceita week_start/week_end pra analise semanal.
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
const LIS_PERSONA = `Você é a Lis — um diário emocional com IA para mulheres jovens brasileiras. O app inteiro tem o seu nome.

QUEM VOCÊ É:
- Mulher, em torno de 30 anos, em português brasileiro coloquial mas cuidadoso
- Pensa antes de falar; não fala muito
- Você não é terapeuta nem coach — é mais como uma amiga atenta que ouviu muito
- Você NÃO usa: 'tudo vai dar certo', 'você consegue', 'pensamento positivo', 'positividade', 'foco no que importa', 'energia boa', 'vibrações', 'querida', 'linda', exclamações excessivas, máximas motivacionais
- Você NÃO minimiza com: 'vai passar', 'poderia ser pior', 'é só isso', 'todo mundo se sente assim'
- Você USA: validações curtas ('faz sentido', 'entendo', 'isso pesa mesmo'), observações específicas (cita o que ela registrou com número), micro-sugestões físicas e pequenas
- Você NUNCA diagnostica, nunca prescreve, nunca substitui terapia
- Você reconhece que a culpa por 'não dar conta' é a dor central da maioria das pessoas que falam com você — nunca reforça essa culpa, sempre tira o peso

COMO VOCÊ FALA:
- Frases curtas
- Raramente exclamação
- Usa o nome dela com economia
- Máximo 1 emoji por resposta inteira
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
  culpa: "lidar com a culpa de não dar conta",
  ansiedade: "diminuir a ansiedade",
  autocuidado: "criar hábito de autocuidado",
  energia: "ter mais energia no dia a dia",
  solidao: "se sentir menos sozinha",
};
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function buildPrompts(entries: MoodEntry[], userName: string, goal: string | null, periodLabel: string, relevantMemories: string[]): { systemPrompt: string; userPrompt: string } {
  const entriesWithSleep = entries.filter((e) => e.sleep_quality !== null || e.sleep_hours !== null);
  const hasSleepData = entriesWithSleep.length >= 2;
  const entriesWithScreen = entries.filter((e) => e.screen_time_hours !== null);
  const hasScreenData = entriesWithScreen.length >= 2;

  const sleepRule = hasSleepData
    ? `- Alguns registros têm dados de sono. Procure correlações entre qualidade do sono ou horas dormidas e humor/sentimentos/energia. Cite números reais. Se não houver correlação clara, NÃO mencione sono.`
    : `- Os registros não têm dados de sono suficientes; não tente comentar sobre sono.`;
  const screenRule = hasScreenData
    ? `- Alguns registros têm tempo de tela. REGRA CRÍTICA anti-culpa: NUNCA julgue ('você passou demais'). Apenas observe correlações factuais com humor/energia/sentimentos, citando números. Se não houver correlação clara, NÃO mencione celular.`
    : `- Os registros não têm tempo de tela suficiente; não comente sobre celular.`;

  let systemPrompt = `${LIS_PERSONA}

TAREFA AGORA: analisar os registros de ${userName} e identificar padrões REAIS nos dados.

REGRAS DE ANÁLISE:
- Identifique entre 2 e 4 padrões CONCRETOS, citando números e termos exatos dos registros
- NUNCA seja genérica ('você sente várias emoções' ❌); cite SEMPRE algo específico ('você marcou ansiosa em 4 dos 7 registros' ✅)
- NUNCA julgue, diagnostique ou use linguagem clínica
- Cada insight é 1 ou 2 frases curtas
- Comece cada insight com '- ' (hífen + espaço)
- NÃO use emojis na análise
- NÃO numere
- Se houver poucos dados ou nenhum padrão claro, retorne só 1 frase: '- Ainda não consigo ver um padrão claro nesses registros. Continue registrando.'
- Procure padrões temporais (dia da semana, hora), correlações entre tags/atividades, evolução do humor
${sleepRule}
${screenRule}
- O objetivo dela é: ${goal && GOAL_LABELS[goal] ? GOAL_LABELS[goal] : "se conhecer melhor"}. Quando relevante, conecte os padrões a esse objetivo.`;

  if (relevantMemories.length > 0) {
    systemPrompt += `\n
VOCÊ TEM MEMÓRIA. Abaixo, no prompt do usuário, há 'MEMÓRIAS RELEVANTES' do passado de ${userName}.
- Use esse histórico para dar profundidade à análise (ex: "Como você já mencionou antes...", "Diferente do mês passado...").
- Veja se os padrões de agora são uma repetição ou uma mudança em relação ao passado.
- NÃO cite as memórias como se fossem dessa semana; elas são CONTEXTO.`;
  }

  systemPrompt += `\n\nFORMATO DE RESPOSTA: Apenas a lista, cada linha começando com '- '. Nada antes, nada depois. Sem títulos, sem introdução, sem despedida.`;

  let userPrompt = `Aqui estão os ${entries.length} registros de ${userName} dos ${periodLabel}, do mais recente ao mais antigo:\n\n`;
  entries.forEach((e, i) => {
    const date = new Date(e.created_at);
    const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    const weekday = WEEKDAY_NAMES[brt.getUTCDay()];
    const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    const hour = brt.getUTCHours();
    const periodLabel = hour < 5 ? "madrugada" : hour < 12 ? "manhã" : hour < 18 ? "tarde" : "noite";
    userPrompt += `${i + 1}. ${weekday} ${dateStr} (${periodLabel}): humor ${MOOD_LABELS[e.mood_emoji] || e.mood_emoji} (${e.mood_scale}/10)`;
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
    userPrompt += `\nMEMÓRIAS RELEVANTES do passado de ${userName} (use para notar evolução ou repetição):\n`;
    relevantMemories.forEach((m, i) => {
      userPrompt += `  ${i + 1}. ${m}\n`;
    });
  }

  userPrompt += `\nAnalise esses registros e identifique 2 a 4 padrões observáveis. Siga as regras do system prompt rigorosamente.`;
  return { systemPrompt, userPrompt };
}

async function callClaude(model: string, systemPrompt: string, userPrompt: string, apiKey: string): Promise<{ ok: boolean; status: number; body: string; data?: unknown }> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 500, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body: text };
  try { return { ok: true, status: 200, body: text, data: JSON.parse(text) }; } catch { return { ok: false, status: r.status, body: text }; }
}

function parseInsights(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim()).filter((l) => l.length > 0).slice(0, 4);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Token de autenticação ausente" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY ausente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Usuária não autenticada" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json().catch(() => ({}));
    // Compat: aceita week_start (string YYYY-MM-DD) + week_end opcional pra
    // analise semanal. Sem week_start, usa period (7d/30d/all) como antes.
    const weekStartStr: string | undefined = body.week_start;
    const weekEndStr: string | undefined = body.week_end;
    const period: string = body.period || "7d";

    let query = supabase.from("mood_entries").select("mood_emoji, mood_scale, energy_level, tags, activities, note, created_at, sleep_quality, sleep_hours, screen_time_hours").eq("user_id", user.id).order("created_at", { ascending: false });
    let periodLabel: string;
    if (weekStartStr) {
      // domingo 00:00 BRT = domingo 03:00 UTC; sábado 23:59 BRT = domingo_seguinte 02:59 UTC
      const start = new Date(`${weekStartStr}T03:00:00.000Z`);
      let end: Date;
      if (weekEndStr) {
        const [ey, em, ed] = weekEndStr.split("-").map(Number);
        end = new Date(Date.UTC(ey, em - 1, ed + 1, 2, 59, 59, 999));
      } else {
        end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      }
      query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      const startBR = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const endBR = end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      periodLabel = `semana de ${startBR} a ${endBR}`;
    } else {
      if (period === "7d") { const d = new Date(); d.setDate(d.getDate() - 7); query = query.gte("created_at", d.toISOString()); }
      else if (period === "30d") { const d = new Date(); d.setDate(d.getDate() - 30); query = query.gte("created_at", d.toISOString()); }
      periodLabel = period === "7d" ? "últimos 7 dias" : period === "30d" ? "últimos 30 dias" : "todos os registros";
    }
    const { data: entries } = await query;
    if (!entries || entries.length < 3) {
      return new Response(JSON.stringify({ insights: ["Conforme você for fazendo mais registros, eu vou identificando padrões aqui para você."], source: "too_few_entries", count: entries?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: profile } = await supabase.from("profiles").select("name, goal").eq("id", user.id).single();
    const userName = profile?.name || "você";
    const goal = profile?.goal || null;

    // === BUSCAR MEMÓRIAS RELEVANTES ===
    let relevantMemories: string[] = [];
    try {
      // Cria uma query semântica baseada nas tags mais comuns do período para achar memórias relacionadas
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

    const { systemPrompt, userPrompt } = buildPrompts(entries as MoodEntry[], userName, goal, periodLabel, relevantMemories);
    const attempts: Array<{ model: string; status: number; body: string }> = [];
    for (const model of MODELS_TO_TRY) {
      const result = await callClaude(model, systemPrompt, userPrompt, ANTHROPIC_API_KEY);
      if (result.ok && result.data) {
        const claudeData = result.data as { content: Array<{ type: string; text: string }> };
        const rawText = claudeData.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
        const insights = parseInsights(rawText);
        if (insights.length === 0) {
          return new Response(JSON.stringify({ insights: [rawText.trim().slice(0, 300)], source: "ai_unparsed", model_used: model, count: entries.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({ insights, source: "ai", model_used: model, count: entries.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      attempts.push({ model, status: result.status, body: result.body });
      console.error(`Modelo ${model} falhou ${result.status}: ${result.body}`);
    }
    return new Response(JSON.stringify({ error: "Nenhum modelo aceitou a requisição", attempts }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: "Erro interno", details: error instanceof Error ? error.message : "desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
