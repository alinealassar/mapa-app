// generate-mood-feedback v12 — com memória semântica (Supabase.ai gte-small + pgvector)
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

// === PERSONA OFICIAL DA LIS ===
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
- Usa o nome dela com economia (no máximo 1 vez por resposta)
- Máximo 1 emoji por resposta inteira (e quase sempre prefere não usar)
- Nunca começa com 'Oi' ou 'Olá'
- Tom presente, sem distrair com generalidades
`;

interface MoodEntry {
  id: string;
  user_id: string;
  mood_emoji: string;
  mood_scale: number;
  energy_level: number;
  tags: string[];
  activities: string[];
  note: string | null;
}

interface RecentEntry {
  mood_emoji: string;
  mood_scale: number;
  tags: string[];
  created_at: string;
}

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

const HEAVY_TAGS = new Set([
  "fracassada", "desanimada", "sobrecarregada", "carente", "perdida", "solitária",
  "ansiosa", "estressada", "irritada", "frustrada", "cansada",
]);

const MOOD_LABELS: Record<string, string> = { pessima: "péssima", mal: "mal", neutra: "neutra", bem: "bem", otima: "ótima" };

// === MEMORIA SEMÂNTICA (gte-small + pgvector) ===
// Inicia uma sessão do modelo gte-small (384 dims) no Edge Runtime do Supabase.
// Roda local na função, sem custo externo.
// deno-lint-ignore no-explicit-any
const aiSession = new (Supabase as any).ai.Session("gte-small");

async function generateEmbedding(text: string): Promise<number[]> {
  const embedding = await aiSession.run(text, { mean_pool: true, normalize: true });
  return embedding as number[];
}

// Constrói a string que vai ser salva como memória (formato legível pra IA)
function buildMemoryContent(entry: MoodEntry, userName: string): string {
  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", weekday: "short",
  });
  const moodLabel = MOOD_LABELS[entry.mood_emoji] || entry.mood_emoji;
  let content = `[${date}] ${userName} sentiu humor ${moodLabel} (${entry.mood_scale}/10)`;
  if (entry.tags && entry.tags.length > 0) content += `, sentimentos: ${entry.tags.join(", ")}`;
  if (entry.activities && entry.activities.length > 0) content += `, atividades: ${entry.activities.join(", ")}`;
  if (entry.note) {
    const masked = maskSensitiveData(entry.note);
    content += `. Nota: "${masked.slice(0, 250)}"`;
  }
  return content;
}

// Constrói a query usada pra buscar memórias relevantes (foco no contexto emocional)
function buildMemoryQuery(entry: MoodEntry): string {
  const moodLabel = MOOD_LABELS[entry.mood_emoji] || entry.mood_emoji;
  const parts: string[] = [`humor ${moodLabel}`];
  if (entry.tags && entry.tags.length > 0) parts.push(...entry.tags);
  if (entry.note) parts.push(maskSensitiveData(entry.note).slice(0, 100));
  return parts.join(" ");
}

function buildPrompt(
  entry: MoodEntry, userName: string, goal: string | null,
  recentEntries: RecentEntry[], relevantMemories: string[]
): { systemPrompt: string; userPrompt: string } {
  const energyLabels = ["", "muito baixa", "baixa", "moderada", "boa", "alta", "muito alta"];
  const goalLabels: Record<string, string> = {
    culpa: "lidar com a culpa de não dar conta",
    ansiedade: "diminuir a ansiedade",
    autocuidado: "criar hábito de autocuidado",
    energia: "ter mais energia no dia a dia",
    solidao: "se sentir menos sozinha",
  };
  const moodScale = entry.mood_scale;
  const isLowMood = moodScale <= 4;
  const userTags = (entry.tags || []).map((t) => t.toLowerCase());
  const hasHeavyTags = userTags.some((t) => HEAVY_TAGS.has(t));
  const isCulpaCase = userTags.includes("fracassada") || userTags.includes("sobrecarregada") || goal === "culpa";
  const isSolitudeCase = userTags.includes("solitária") || userTags.includes("carente");
  const isAnxietyCase = userTags.includes("ansiosa") || userTags.includes("estressada") || goal === "ansiedade";

  let systemPrompt = `${LIS_PERSONA}

TAREFA AGORA: dar feedback após ${userName} acabar de registrar um momento.

FORMATO DA RESPOSTA:
- Máximo 3 frases curtas
- Cite ALGO específico do que ela registrou (nunca generalidades)
- Termine com uma sugestão pequena, gentil e CONCRETA, factível em 5 minutos sem custo, sem sair de casa
`;
  if (relevantMemories.length > 0) {
    systemPrompt += `
VOCÊ TEM MEMÓRIA. Você já conhece ${userName} de outros momentos. Use as MEMÓRIAS RELEVANTES no userPrompt pra:
- Notar padrão (ex.: "você costuma ficar assim no domingo")
- Citar algo específico que ela mencionou (ex.: "aquele projeto que você estava fazendo")
- Mostrar continuidade afetiva, sem invadir nem ser invasiva
- NÃO cite as memórias literalmente; use como contexto pra responder mais sintonizada
`;
  }
  if (isLowMood && hasHeavyTags) {
    systemPrompt += `
CONTEXTO ATUAL: ela está num momento difícil (humor baixo + emoções pesadas).
- VALIDE primeiro: reconheça que o que ela sente é legítimo
- NÃO celebre, não seja animada, não use exclamações
- A sugestão final deve ser mínima (respirar, beber água, sentar)
`;
  }
  if (isCulpaCase) {
    systemPrompt += `
CONTEXTO DE CULPA: ela tende a se sentir culpada por não dar conta.
- NÃO reforçe a culpa
- NÃO sugira mais produtividade nem organização
- Diga explicitamente algo que tire o peso
`;
  }
  if (isSolitudeCase) {
    systemPrompt += `
CONTEXTO DE SOLIDÃO: ela registrou se sentir sozinha ou carente.
- NÃO sugira "fala com alguém"
- ACOLHA o sentimento como legítimo
- Ofereça presença ("estou aqui", "você não está sozinha aqui")
`;
  }
  if (isAnxietyCase) {
    systemPrompt += `
CONTEXTO DE ANSIEDADE: ela está ansiosa ou estressada.
- Tom calmo, frases curtas, sem exclamações
- Sugira algo físico simples (3 respirações, pés no chão, água)
`;
  }

  let userPrompt = `${userName} acabou de registrar como está se sentindo:\n`;
  userPrompt += `- Humor: ${MOOD_LABELS[entry.mood_emoji] || entry.mood_emoji} (${moodScale}/10)\n`;
  if (entry.energy_level) userPrompt += `- Energia: ${energyLabels[entry.energy_level] || "não informada"}\n`;
  if (entry.tags && entry.tags.length > 0) userPrompt += `- Sentimentos marcados: ${entry.tags.join(", ")}\n`;
  if (entry.activities && entry.activities.length > 0) userPrompt += `- Atividades do dia: ${entry.activities.join(", ")}\n`;
  if (entry.note) userPrompt += `- Nota pessoal dela: "${maskSensitiveData(entry.note)}"\n`;
  if (goal && goalLabels[goal]) userPrompt += `\nObjetivo dela no Mapa: ${goalLabels[goal]}\n`;
  if (recentEntries.length > 0) {
    userPrompt += `\nRegistros recentes dela (mais recente primeiro):\n`;
    recentEntries.forEach((e, i) => {
      const date = new Date(e.created_at).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
      userPrompt += `  ${i + 1}. ${date}: ${MOOD_LABELS[e.mood_emoji] || e.mood_emoji} (${e.mood_scale}/10)`;
      if (e.tags && e.tags.length > 0) userPrompt += ` — ${e.tags.join(", ")}`;
      userPrompt += `\n`;
    });
  }
  if (relevantMemories.length > 0) {
    userPrompt += `\nMEMÓRIAS RELEVANTES (momentos passados de ${userName} com contexto parecido, ordenados do mais relevante):\n`;
    relevantMemories.forEach((m, i) => {
      userPrompt += `  ${i + 1}. ${m}\n`;
    });
  }
  userPrompt += `\nResponda como Lis. Use o nome "${userName}" naturalmente.`;
  return { systemPrompt, userPrompt };
}

async function callClaude(model: string, systemPrompt: string, userPrompt: string, apiKey: string): Promise<{ ok: boolean; status: number; body: string; data?: unknown }> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 300, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
  });
  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body: text };
  try { return { ok: true, status: 200, body: text, data: JSON.parse(text) }; } catch { return { ok: false, status: r.status, body: text }; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Token de autenticação ausente" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: "Configuração da IA ausente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Usuária não autenticada" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body = await req.json();
    const entry: MoodEntry = body.entry;
    if (!entry || !entry.mood_emoji) return new Response(JSON.stringify({ error: "Dados do registro incompletos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: profile } = await supabase.from("profiles").select("name, goal").eq("id", user.id).single();
    const userName = profile?.name || "querida";
    const goal = profile?.goal || null;
    const { data: recentEntries } = await supabase.from("mood_entries").select("mood_emoji, mood_scale, tags, created_at").eq("user_id", user.id).neq("id", entry.id).order("created_at", { ascending: false }).limit(5);

    // === BUSCAR MEMORIAS RELEVANTES ===
    let relevantMemories: string[] = [];
    try {
      const queryText = buildMemoryQuery(entry);
      const queryEmbedding = await generateEmbedding(queryText);
      const { data: memories, error: memErr } = await supabase.rpc("match_memories", {
        query_embedding: queryEmbedding,
        match_threshold: 0.65,
        match_count: 3,
        p_user_id: user.id,
      });
      if (memErr) {
        console.error("Erro match_memories:", memErr.message);
      } else if (memories && memories.length > 0) {
        relevantMemories = (memories as Array<{ content: string }>).map((m) => m.content);
      }
    } catch (e) {
      console.error("Falha ao buscar memórias:", e instanceof Error ? e.message : e);
      // Falha silenciosa: a Lis ainda funciona sem memórias
    }

    const { systemPrompt, userPrompt } = buildPrompt(entry, userName, goal, recentEntries || [], relevantMemories);
    const attempts: Array<{ model: string; status: number; body: string }> = [];
    let feedbackText = "";
    let modelUsed = "";
    for (const model of MODELS_TO_TRY) {
      const result = await callClaude(model, systemPrompt, userPrompt, ANTHROPIC_API_KEY);
      if (result.ok && result.data) {
        const claudeData = result.data as { content: Array<{ type: string; text: string }> };
        feedbackText = claudeData.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
        modelUsed = model;
        break;
      }
      attempts.push({ model, status: result.status, body: result.body });
      console.error(`Modelo ${model} falhou ${result.status}: ${result.body}`);
    }

    if (!feedbackText) {
      return new Response(JSON.stringify({ error: "Nenhum modelo aceitou a requisição", attempts }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("mood_entries").update({ ai_feedback: feedbackText }).eq("id", entry.id);
    await supabase.from("ai_analyses").insert({ user_id: user.id, entry_id: entry.id, analysis_text: feedbackText, suggestion: null });

    // === SALVAR MEMORIA DA INTERAÇÃO ===
    try {
      const memoryContent = buildMemoryContent(entry, userName);
      const memoryEmbedding = await generateEmbedding(memoryContent);
      const { error: insErr } = await supabase.from("user_memories").insert({
        user_id: user.id,
        content: memoryContent,
        embedding: memoryEmbedding,
      });
      if (insErr) console.error("Erro ao salvar user_memory:", insErr.message);
    } catch (e) {
      console.error("Falha ao salvar memória:", e instanceof Error ? e.message : e);
      // Falha silenciosa: feedback já foi entregue
    }

    return new Response(
      JSON.stringify({ feedback: feedbackText, entry_id: entry.id, model_used: modelUsed, memories_used: relevantMemories.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: "Erro interno", details: error instanceof Error ? error.message : "desconhecido" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
