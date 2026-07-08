// generate-mood-feedback v41 — fatos duraveis + loop de continuidade
// v41 (08/07/2026): (A) user_facts: busca e injeta fatos duraveis no prompt;
//   (B) extracao fire-and-forget de fatos novos apos cada feedback (haiku);
//   (C) loop de continuidade: detecta pergunta final, salva pending_question em profiles.
// v40 (08/07/2026): (A) persona: sugestao nao obrigatoria, 5 modos (espelhar/nomear/perguntar/
//   sugerir/presenca); (B) few-shot com variedade de estruturas; (C) FORMATO sem formula fixa;
//   (D) fallback match_memories threshold 0.0 quando primaria retorna vazio;
//   (E) timeZone BRT nos registros recentes.
// v39 (05/06/2026): sugestoes expandidas, few-shot, validacoes variadas.
// v38 (05/06/2026): remove lista fixa "cha/plantas/banho" da persona.
// v37 (05/06/2026): atualiza MODELS_TO_TRY, abort em 401, log detalhado de erro.
// v13 (16/05/2026): note_source + audio_duration_seconds para adaptar tom ao audio.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MODELS_TO_TRY = [
  "claude-opus-4-5-20250929",
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-20250514",
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
];

const HAIKU_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-3-5-haiku-20241022",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIS_PERSONA = `Você é a Lis — um diário emocional com IA para mulheres jovens brasileiras.

QUEM VOCÊ É:
- Mulher, em torno de 30 anos, português brasileiro coloquial mas cuidadoso
- Pensa antes de falar; não fala muito
- Não é terapeuta nem coach — é como uma amiga atenta que ouviu muito
- NÃO usa: 'tudo vai dar certo', 'você consegue', 'pensamento positivo', 'energia boa', 'vibrações', 'querida', 'linda', exclamações excessivas, máximas motivacionais
- NÃO minimiza: 'vai passar', 'poderia ser pior', 'é só isso', 'todo mundo se sente assim'
- NUNCA diagnostica, prescreve ou substitui terapia
- Reconhece que a culpa por 'não dar conta' é a dor central — nunca reforça essa culpa

COMO FALA:
- Frases curtas
- Raramente exclamação
- Nome dela no máximo 1 vez por resposta
- Máximo 1 emoji por resposta (quase sempre prefere não usar)
- Nunca começa com 'Oi' ou 'Olá'
- Tom presente, sem generalidades

VALIDAÇÕES DE ABERTURA — varie a cada resposta, nunca repita a mesma duas vezes seguidas:
'isso tem peso mesmo' / 'faz todo sentido' / 'que dia cheio foi esse' / 'carregar isso junto cansa de verdade' /
'isso é real — o corpo guarda' / 'não é pouca coisa o que você descreveu' / 'isso bate diferente' /
'tem um custo aí que não aparece na lista' / 'você não está exagerando' / 'sentir isso tudo junto é muito' /
'faz sentido estar assim' / 'isso acontece, e pesa' / 'o dia pediu demais de você' /
'é muita coisa pra processar' / 'não tem jeito fácil de carregar isso'

COMO RESPONDER — escolha o que a situação pede, não siga fórmula fixa.

Antes de escrever, identifique O ASSUNTO central do registro (trabalho,
família, corpo, dinheiro, solidão, rotina...). Sua resposta é sobre ISSO,
não sobre "o humor 3/10".

MODOS (varie — nunca repita o modo da resposta anterior, veja 'Respostas
recentes' no contexto):
1. ESPELHAR — devolver com outras palavras o que ela disse, mostrando que
   entendeu de verdade
2. NOMEAR — dar nome ao que está por baixo ("isso parece menos cansaço e
   mais decepção")
3. PERGUNTAR — uma pergunta gentil, que ela pode responder no próximo
   registro
4. SUGERIR — micro-ação gratuita de até 5 minutos, sem sair de casa,
   SÓ quando encaixa no assunto (não sugira alongamento pra quem brigou
   com a mãe). Alterne entre: movimento suave, sensorial, pausa ativa,
   expressão mínima, pequeno prazer, cuidado básico. Nunca repita a
   sugestão das respostas recentes.
5. PRESENÇA — às vezes só dizer que ouviu, sem sugerir nada

REGRAS:
- Sugestão NÃO é obrigatória. Se não encaixar, não sugira.
- Se ela citou pessoa ou situação específica (chefe, filho, mãe, projeto),
  responda a ELA, com a palavra que ela mesma usou.
- Se houver memória de algo parecido, conecte ("de novo essa reunião de
  segunda?").
`;

// === FEW-SHOT EXAMPLES ===
// 4 exemplos com estruturas diferentes: espelhar+sugerir, perguntar, presença, nomear+memória.
const FEW_SHOT_EXAMPLES = `
EXEMPLOS DE RESPOSTA (aprenda o estilo e a VARIEDADE de estruturas — não copie o conteúdo):

CONTEXTO: humor mal (3/10) + sobrecarregada + nota "mais um dia que não terminei nada"
ERRADO: "Isso é difícil. Você está sobrecarregada. Toma um chá e descansa."
CERTO (espelhar + sugerir): "Terminar tudo não era o que o dia precisava de você — ele já pediu demais. Antes de continuar, enche um copo de água e bebe devagar, sentada."

CONTEXTO: humor mal (4/10) + irritada + nota "discuti com a minha mãe de novo, falei coisas que não queria"
ERRADO: "Brigas acontecem. Respira fundo e alonga o pescoço."
CERTO (perguntar, SEM sugestão): "Discussão com mãe mexe com coisa antiga — e o arrependimento de depois às vezes pesa mais que a briga. O que doeu mais: o que ela disse, ou o que você disse?"

CONTEXTO: humor péssima (1/10) + áudio de 8 segundos: "hoje não. só isso."
ERRADO: "Sinto muito que o dia foi difícil. Tente ouvir uma música que te acalme."
CERTO (presença, curtíssimo): "Hoje não. Tá dito, tá guardado. Eu fico aqui."

CONTEXTO: humor neutra (5/10) + cansada + nota "reunião de segunda de novo, saí drenada" + memória de outra segunda parecida
ERRADO: "Dias neutros também fazem parte. Descanse."
CERTO (nomear + memória): "De novo essa reunião de segunda te drenando — é a segunda vez que você registra isso. Não parece cansaço comum, parece algo que essa reunião especificamente tira de você."
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
  note_source?: "text" | "audio";
  audio_duration_seconds?: number;
}

interface RecentEntry {
  mood_emoji: string;
  mood_scale: number;
  tags: string[];
  ai_feedback: string | null;
  created_at: string;
}

interface UserFact {
  fact: string;
  category: string | null;
}

function maskSensitiveData(text: string | null | undefined): string {
  if (!text) return "";
  let masked = text;
  masked = masked.replace(/(?:\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2})|(?:\d{11})/g, "[CPF PROTEGIDO]");
  masked = masked.replace(/(?:(?:\+|00)?(55)\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})-?(\d{4}))/g, (m) => {
    const n = m.replace(/\D/g, "");
    return (n.length >= 8 && n.length <= 13) ? "[TELEFONE PROTEGIDO]" : m;
  });
  return masked;
}

const HEAVY_TAGS = new Set(["fracassada","desanimada","sobrecarregada","carente","perdida","solitária","ansiosa","estressada","irritada","frustrada","cansada"]);
const MOOD_LABELS: Record<string,string> = { pessima:"péssima", mal:"mal", neutra:"neutra", bem:"bem", otima:"ótima" };

// deno-lint-ignore no-explicit-any
const aiSession = new (Supabase as any).ai.Session("gte-small");
async function generateEmbedding(text: string): Promise<number[]> {
  return await aiSession.run(text, { mean_pool: true, normalize: true }) as number[];
}

function buildMemoryContent(entry: MoodEntry, userName: string): string {
  const date = new Date().toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", weekday:"short" });
  const mood = MOOD_LABELS[entry.mood_emoji] || entry.mood_emoji;
  let c = `[${date}] ${userName} sentiu humor ${mood} (${entry.mood_scale}/10)`;
  if (entry.tags?.length) c += `, sentimentos: ${entry.tags.join(", ")}`;
  if (entry.activities?.length) c += `, atividades: ${entry.activities.join(", ")}`;
  if (entry.note) c += `. Nota: "${maskSensitiveData(entry.note).slice(0,250)}"`;
  return c;
}

function buildMemoryQuery(entry: MoodEntry): string {
  const parts = [`humor ${MOOD_LABELS[entry.mood_emoji] || entry.mood_emoji}`];
  if (entry.tags?.length) parts.push(...entry.tags);
  if (entry.note) parts.push(maskSensitiveData(entry.note).slice(0,100));
  return parts.join(" ");
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

function buildPrompt(
  entry: MoodEntry, userName: string, goal: string | null,
  recentEntries: RecentEntry[], relevantMemories: string[],
  facts: UserFact[] | null, pendingQuestion: string | null
): { systemPrompt: string; userPrompt: string } {
  const energyLabels = ["","muito baixa","baixa","moderada","boa","alta","muito alta"];
  const goalLabels: Record<string,string> = {
    culpa: "lidar com a culpa de não dar conta",
    ansiedade: "diminuir a ansiedade",
    autocuidado: "criar hábito de autocuidado",
    energia: "ter mais energia no dia a dia",
    solidao: "se sentir menos sozinha",
  };

  const moodScale = entry.mood_scale;
  const userTags = (entry.tags || []).map(t => t.toLowerCase());
  const isLowMood = moodScale <= 4;
  const hasHeavyTags = userTags.some(t => HEAVY_TAGS.has(t));
  const isCulpaCase = userTags.includes("fracassada") || userTags.includes("sobrecarregada") || goal === "culpa";
  const isSolitudeCase = userTags.includes("solitária") || userTags.includes("carente");
  const isAnxietyCase = userTags.includes("ansiosa") || userTags.includes("estressada") || goal === "ansiedade";

  let systemPrompt = `${LIS_PERSONA}${FEW_SHOT_EXAMPLES}\nTAREFA: dar feedback após ${userName} registrar um momento.\n\nFORMATO:\n- Máximo 3 frases curtas (pode ser 1, se o momento pedir)\n- Cite algo ESPECÍFICO do que ela registrou (nunca generalidades)\n- Escolha UM modo de resposta (espelhar/nomear/perguntar/sugerir/presença)\n  diferente do modo da resposta anterior\n`;

  if (facts && facts.length > 0) {
    systemPrompt += `\nVOCÊ CONHECE A VIDA DELA. Abaixo, no contexto, há uma lista de fatos que você aprendeu em registros passados. Use com naturalidade quando fizer sentido — cite a pessoa ou situação pelo nome que ela usa. NUNCA liste os fatos nem mostre que tem uma "ficha" dela. Se um fato parecer ter mudado, confie na nota de hoje, não na lista.\n`;
  }

  if (pendingQuestion) {
    systemPrompt += `\nNA SUA ÚLTIMA RESPOSTA você perguntou a ela: "${pendingQuestion}". Se a nota de hoje parecer responder essa pergunta, reconheça — mostre que você lembra do que perguntou. Não repita a pergunta.\n`;
  }

  if (relevantMemories.length > 0) {
    systemPrompt += `\nVOCÊ TEM MEMÓRIA de ${userName}. Use para notar padrões, citar algo específico anterior, mostrar continuidade. NÃO cite literalmente.\n`;
  }
  if (isLowMood && hasHeavyTags) systemPrompt += `\nCONTEXTO DIFÍCIL: valide primeiro, sem animação. Sugestão mínima (respirar, água, sentar).\n`;
  if (isCulpaCase) systemPrompt += `\nCULPA: não reforce. Não sugira produtividade. Tire o peso.\n`;
  if (isSolitudeCase) systemPrompt += `\nSOLIDÃO: acolha, não sugira 'fala com alguém'. Ofereça presença.\n`;
  if (isAnxietyCase) systemPrompt += `\nANSIEDADE: tom calmo, frases curtas. Sugestão física simples.\n`;
  if (entry.note_source === "audio") {
    const dur = entry.audio_duration_seconds || 0;
    systemPrompt += `\nÁUDIO: nota gravada em voz. Hesitações são dados emocionais. Reconheça implicitamente o ato de gravar.\n`;
    if (dur >= 60) systemPrompt += `Áudio longo (${dur}s): desabafo. Valide o tamanho antes da sugestão.\n`;
    else if (dur > 0 && dur < 15) systemPrompt += `Áudio curto (${dur}s): resposta curta também.\n`;
  }

  let userPrompt = `${userName} registrou:\n`;
  userPrompt += `- Humor: ${MOOD_LABELS[entry.mood_emoji] || entry.mood_emoji} (${moodScale}/10)\n`;
  if (entry.energy_level) userPrompt += `- Energia: ${energyLabels[entry.energy_level] || "não informada"}\n`;
  if (entry.tags?.length) userPrompt += `- Sentimentos: ${entry.tags.join(", ")}\n`;
  if (entry.activities?.length) userPrompt += `- Atividades: ${entry.activities.join(", ")}\n`;
  if (entry.note) {
    const label = entry.note_source === "audio" ? "Nota (áudio)" : "Nota";
    userPrompt += `- ${label}: "${maskSensitiveData(entry.note)}"\n`;
  }
  if (goal && goalLabels[goal]) userPrompt += `\nObjetivo: ${goalLabels[goal]}\n`;

  if (facts && facts.length > 0) {
    userPrompt += `\nO que você sabe da vida de ${userName} (de registros passados):\n`;
    facts.forEach(f => { userPrompt += `  - ${f.fact}\n`; });
  }

  if (recentEntries.length > 0) {
    userPrompt += `\nRegistros recentes:\n`;
    recentEntries.forEach((e, i) => {
      const date = new Date(e.created_at).toLocaleDateString("pt-BR", { weekday:"short", day:"numeric", month:"short", timeZone:"America/Sao_Paulo" });
      userPrompt += `  ${i+1}. ${date}: ${MOOD_LABELS[e.mood_emoji] || e.mood_emoji} (${e.mood_scale}/10)`;
      if (e.tags?.length) userPrompt += ` — ${e.tags.join(", ")}`;
      userPrompt += `\n`;
    });
  }

  // Últimas 3 respostas da Lis para evitar repetição de categoria de sugestão
  const recentFeedbacks = recentEntries.filter(e => !!e.ai_feedback).slice(0,3).map(e => e.ai_feedback as string);
  if (recentFeedbacks.length > 0) {
    userPrompt += `\nSuas respostas recentes para ${userName} (VARIE validação e categoria de sugestão):\n`;
    recentFeedbacks.forEach((f, i) => { userPrompt += `  ${i+1}. "${f.slice(0,200)}"\n`; });
  }

  if (relevantMemories.length > 0) {
    userPrompt += `\nMemórias relevantes (contexto, não cite):\n`;
    relevantMemories.forEach((m, i) => { userPrompt += `  ${i+1}. ${m}\n`; });
  }

  userPrompt += `\nResponda como Lis. Use "${userName}" no máximo uma vez.`;
  return { systemPrompt, userPrompt };
}

async function callClaude(model: string, sys: string, usr: string, key: string, maxTokens = 350) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type":"application/json", "x-api-key":key, "anthropic-version":"2023-06-01" },
    body: JSON.stringify({ model, max_tokens:maxTokens, system:sys, messages:[{role:"user",content:usr}] }),
  });
  const text = await r.text();
  if (!r.ok) return { ok:false, status:r.status, body:text };
  try { return { ok:true, status:200, body:text, data:JSON.parse(text) }; }
  catch { return { ok:false, status:r.status, body:text }; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({error:"Token ausente"}), {status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});
    if (!ANTHROPIC_API_KEY) return new Response(JSON.stringify({error:"Config ausente"}), {status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data:{user}, error:authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ",""));
    if (authErr || !user) return new Response(JSON.stringify({error:"Não autenticada"}), {status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const body = await req.json();
    const entry: MoodEntry = body.entry;
    if (!entry?.mood_emoji) return new Response(JSON.stringify({error:"Dados incompletos"}), {status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});

    // B4: include pending_question in profile fetch
    const { data:profile } = await supabase.from("profiles").select("name, goal, pending_question, pending_question_at").eq("id",user.id).single();
    const userName = profile?.name || "querida";
    const goal = profile?.goal || null;
    const pendingQuestion = (profile?.pending_question as string | null) || null;

    // Inclui ai_feedback para variar sugestões
    const { data:recentEntries } = await supabase
      .from("mood_entries")
      .select("mood_emoji, mood_scale, tags, ai_feedback, created_at")
      .eq("user_id",user.id)
      .neq("id",entry.id)
      .order("created_at",{ascending:false})
      .limit(5);

    // B1: fetch durable facts
    const { data:factsData } = await supabase
      .from("user_facts")
      .select("fact, category")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15);
    const facts = (factsData as UserFact[] | null) || null;

    let relevantMemories: string[] = [];
    try {
      const qEmb = await generateEmbedding(buildMemoryQuery(entry));
      const { data:mems, error:memErr } = await supabase.rpc("match_memories",{
        query_embedding:qEmb, match_threshold:0.65, match_count:3, p_user_id:user.id
      });
      if (memErr) console.error("match_memories:",memErr.message);
      else if (mems?.length) relevantMemories = (mems as Array<{content:string}>).map(m=>m.content);
      if (!relevantMemories.length) {
        const { data:fallbackMems } = await supabase.rpc("match_memories",{
          query_embedding:qEmb, match_threshold:0.0, match_count:1, p_user_id:user.id
        });
        if (fallbackMems?.length) relevantMemories = (fallbackMems as Array<{content:string}>).map(m=>m.content);
      }
    } catch(e) { console.error("mem:",e instanceof Error?e.message:e); }

    const { systemPrompt, userPrompt } = buildPrompt(entry, userName, goal, recentEntries||[], relevantMemories, facts, pendingQuestion);

    let feedbackText = "", modelUsed = "";
    const attempts: Array<{model:string;status:number;body:string}> = [];
    for (const model of MODELS_TO_TRY) {
      const res = await callClaude(model, systemPrompt, userPrompt, ANTHROPIC_API_KEY);
      if (res.ok && res.data) {
        const d = res.data as {content:Array<{type:string;text:string}>};
        feedbackText = d.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");
        modelUsed = model;
        break;
      }
      const snip = res.body.slice(0,300);
      attempts.push({model,status:res.status,body:snip});
      console.error(`${model} status=${res.status}: ${snip}`);
      if (res.status===401) { console.error("API key inválida. Abortando."); break; }
    }

    if (!feedbackText) {
      return new Response(JSON.stringify({error:"Nenhum modelo aceitou",attempts}), {status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    await supabase.from("mood_entries").update({ai_feedback:feedbackText}).eq("id",entry.id);
    await supabase.from("ai_analyses").insert({user_id:user.id,entry_id:entry.id,analysis_text:feedbackText,suggestion:null});

    try {
      const memC = buildMemoryContent(entry, userName);
      const memE = await generateEmbedding(memC);
      const {error:ie} = await supabase.from("user_memories").insert({user_id:user.id,content:memC,embedding:memE});
      if (ie) console.error("salvar mem:",ie.message);
    } catch(e) { console.error("mem save:",e instanceof Error?e.message:e); }

    // B3: loop de continuidade — detecta última pergunta, salva/limpa pending_question
    try {
      const sentences = feedbackText.split(/(?<=[.!?])\s+|\n+/).map((s: string) => s.trim()).filter(Boolean);
      const lastQuestion = sentences.filter((s: string) => s.endsWith("?") && s.length <= 160).pop() || null;
      await supabase.from("profiles").update(
        lastQuestion
          ? { pending_question: lastQuestion, pending_question_at: new Date().toISOString() }
          : { pending_question: null, pending_question_at: null }
      ).eq("id", user.id);
    } catch(e) { console.error("pending_question:", e instanceof Error ? e.message : e); }

    // B2: fire-and-forget fact extraction (haiku, nao bloqueia o retorno)
    const maskedNoteForFacts = maskSensitiveData(entry.note);
    if (maskedNoteForFacts.length > 40) {
      const factsList = facts && facts.length > 0 ? facts.map(f => f.fact).join("\n") : "nenhum ainda";
      const factUsr = `Você extrai fatos duráveis sobre a vida de uma usuária a partir de uma nota de diário pessoal.

FATO DURÁVEL = algo que continua verdadeiro por semanas ou meses: pessoas da vida dela (filho, marido, mãe, chefe, amiga — com nome se ela citou), trabalho ou estudo, rotina fixa, terapia, condição de saúde contínua, projeto ou situação em andamento.
NÃO é fato durável: humor do dia, evento pontual sem continuação, clima, o que comeu, tarefas soltas.

FATOS JÁ CONHECIDOS (não repita nem crie variações destes):
${factsList}

NOTA DE HOJE:
"${maskedNoteForFacts}"

Responda APENAS com JSON válido, sem markdown:
{"facts": [{"fact": "...", "category": "pessoas|trabalho|saude|rotina|situacao"}]}

Máximo 2 fatos. Cada fato é uma frase curta em terceira pessoa (ex: "tem um filho pequeno chamado Theo", "faz terapia às quintas", "conflito recorrente com a chefe"). Se não houver fato durável NOVO, responda {"facts": []}.`;

      (async () => {
        try {
          let extractedFacts: Array<{fact: string; category: string}> | null = null;
          for (const model of HAIKU_MODELS) {
            const res = await callClaude(model, "", factUsr, ANTHROPIC_API_KEY, 300);
            if (res.ok && res.data) {
              const d = res.data as {content: Array<{type: string; text: string}>};
              const rawText = d.content.filter(b => b.type === "text").map(b => b.text).join("");
              const parsed = extractJson(rawText);
              if (parsed && Array.isArray(parsed.facts)) {
                extractedFacts = parsed.facts as Array<{fact: string; category: string}>;
              }
              break;
            }
            if (res.status === 401) break;
          }
          if (!extractedFacts || extractedFacts.length === 0) return;

          // Limit to 40 total facts per user — trim oldest if needed
          const { count } = await supabase
            .from("user_facts")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);
          const currentCount = count || 0;
          const excess = currentCount + extractedFacts.length - 40;
          if (excess > 0) {
            const { data: oldest } = await supabase
              .from("user_facts")
              .select("id")
              .eq("user_id", user.id)
              .order("created_at", { ascending: true })
              .limit(excess);
            if (oldest && oldest.length > 0) {
              await supabase.from("user_facts").delete().in("id", (oldest as Array<{id: string}>).map(r => r.id));
            }
          }

          await supabase.from("user_facts").insert(
            extractedFacts.map(f => ({
              user_id: user.id,
              fact: f.fact,
              category: f.category || null,
              source_entry_id: entry.id,
            }))
          );
        } catch(e) { console.error("fact extraction:", e instanceof Error ? e.message : e); }
      })();
    }

    return new Response(
      JSON.stringify({feedback:feedbackText,entry_id:entry.id,model_used:modelUsed,memories_used:relevantMemories.length}),
      {headers:{...corsHeaders,"Content-Type":"application/json"}}
    );
  } catch(err) {
    console.error("Erro:",err);
    return new Response(JSON.stringify({error:"Erro interno",details:err instanceof Error?err.message:"desconhecido"}), {status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
