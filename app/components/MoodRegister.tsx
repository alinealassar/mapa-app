"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Mic, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { containsCrisisKeywords, maskSensitiveData } from "@/lib/safety";
import Link from "next/link";

const MOODS = [
  { key: "pessima", emoji: "😣", label: "Péssima", scale: 1 },
  { key: "mal", emoji: "😒", label: "Mal", scale: 3 },
  { key: "neutra", emoji: "😐", label: "Neutra", scale: 5 },
  { key: "bem", emoji: "😊", label: "Bem", scale: 8 },
  { key: "otima", emoji: "🤩", label: "Ótima", scale: 10 },
];
const TAGS = [
  // Calma e afeto
  { emoji: "😌", label: "tranquila" },
  { emoji: "🪶", label: "leve" },
  { emoji: "💖", label: "grata" },
  { emoji: "😍", label: "amada" },
  { emoji: "💘", label: "apaixonada" },
  { emoji: "🤗", label: "acolhida" },
  { emoji: "🌱", label: "esperançosa" },
  // Energia e motivação
  { emoji: "💪", label: "motivada" },
  { emoji: "✨", label: "inspirada" },
  { emoji: "🎯", label: "focada" },
  { emoji: "🤩", label: "confiante" },
  // Corpo e cansaço
  { emoji: "😴", label: "com sono" },
  { emoji: "😩", label: "cansada" },
  { emoji: "🤒", label: "indisposta" },
  // Tensão e sobrecarga
  { emoji: "😰", label: "ansiosa" },
  { emoji: "😫", label: "estressada" },
  { emoji: "🤯", label: "sobrecarregada" },
  { emoji: "😠", label: "irritada" },
  { emoji: "😤", label: "frustrada" },
  // Baixa
  { emoji: "😔", label: "desanimada" },
  { emoji: "😓", label: "fracassada" },
  { emoji: "🥺", label: "carente" },
  { emoji: "😶‍🌫️", label: "perdida" },
  { emoji: "🌑", label: "solitária" },
];
const ACTIVITIES = [
  // Corpo e movimento
  { emoji: "🏋️‍♀️", label: "Treinei" },
  { emoji: "🚶‍♀️", label: "Saí para caminhar" },
  { emoji: "🌳", label: "Fui ao ar livre" },
  // Trabalho e estudo
  { emoji: "💻", label: "Trabalhei" },
  { emoji: "📚", label: "Estudei" },
  { emoji: "💡", label: "Aprendi algo novo" },
  // Espírito e descanso (cuidados internos)
  { emoji: "💆‍♀️", label: "Cuidei de mim" },
  { emoji: "🧘‍♀️", label: "Meditei" },
  { emoji: "🕯️", label: "Pratiquei minha fé" },
  { emoji: "😴", label: "Descansei" },
  // Pessoas e afeto
  { emoji: "👫", label: "Vi amigos" },
  { emoji: "👪", label: "Vi a família" },
  { emoji: "🫂", label: "Cuidei de alguém querido" },
  { emoji: "🐾", label: "Cuidei do pet" },
  // Lazer e prazer
  { emoji: "🎨", label: "Fiz um hobby" },
  { emoji: "📖", label: "Li algo" },
  { emoji: "🍿", label: "Assisti algo" },
  { emoji: "🎵", label: "Ouvi música" },
  // Casa e rotina (tarefas obrigatórias do dia — vai pro fim)
  { emoji: "🍳", label: "Cozinhei" },
  { emoji: "🧹", label: "Faxinei" },
  { emoji: "🛍️", label: "Fui ao mercado" },
];

// Sprint 3.1: opções de qualidade do sono. Os valores ('good', 'ok', 'bad')
// batem com o CHECK constraint da coluna sleep_quality em mood_entries.
const SLEEP_QUALITIES: { value: "good" | "ok" | "bad"; emoji: string; label: string }[] = [
  { value: "good", emoji: "😴", label: "acordei bem" },
  { value: "ok", emoji: "🥱", label: "mais ou menos" },
  { value: "bad", emoji: "😵‍💫", label: "acordei mal" },
];

// Tags pesadas — usadas para detectar se o último registro foi um momento difícil
const HEAVY_TAGS_LOWER = [
  "fracassada",
  "desanimada",
  "sobrecarregada",
  "carente",
  "perdida",
  "solitária",
  "ansiosa",
  "estressada",
  "irritada",
  "frustrada",
  "cansada",
];

interface LastEntry {
  mood_scale: number;
  tags: string[] | null;
  created_at: string;
}

// Calcula um placeholder de texto sensível ao contexto
function getAdaptivePrompt(
  lastEntry: LastEntry | null,
  goal: string | null,
  now: Date
): string {
  // Pequeno seed para variar entre opções (rotaciona ao longo do mês)
  const seed = now.getDate();
  const pick = (arr: string[]) => arr[seed % arr.length];

  // 1. Faz mais de 3 dias sem registrar?
  if (lastEntry) {
    const lastDate = new Date(lastEntry.created_at);
    const daysSince =
      (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 3) {
      return pick([
        "Senti sua falta. Como você tem estado?",
        "Faz uns dias. Me conta o que tem passado por aí.",
        "Que bom te ver de volta. Como anda?",
      ]);
    }

    // 2. Último registro foi pesado? (humor ≤4 + tag pesada)
    const tagsLower = (lastEntry.tags || []).map((t) => t.toLowerCase());
    const lastWasHeavy =
      lastEntry.mood_scale <= 4 &&
      tagsLower.some((t) => HEAVY_TAGS_LOWER.includes(t));
    if (lastWasHeavy) {
      return pick([
        "Como você está depois daquele momento difícil?",
        "Tô aqui. Como você tá agora?",
        "Aquele dia foi pesado. E hoje, como anda?",
      ]);
    }

    // 3. Último registro foi muito bom (humor ≥8)?
    if (lastEntry.mood_scale >= 8) {
      return pick([
        "Como segue a sensação boa do seu último registro?",
        "Aquela leveza continua aí ou mudou?",
        "Conta como foi desde aquele momento bom.",
      ]);
    }
  }

  // 4. Mensagem por objetivo (goal)
  if (goal === "culpa") {
    return pick([
      "Aqui você não precisa dar conta de nada. Como você está?",
      "Estar aqui já é o suficiente. Me conta como anda.",
      "Tudo bem não estar bem. O que sente agora?",
    ]);
  }
  if (goal === "ansiedade") {
    return pick([
      "Respira fundo. O que está pesando agora?",
      "Sem pressa. Me conta o que tá na sua cabeça.",
      "Vai com calma. Como tá esse momento?",
    ]);
  }
  if (goal === "solidao") {
    return pick([
      "Esse espaço é só seu. Estou aqui te ouvindo.",
      "Você não tá sozinha aqui. Me conta.",
      "Conta o que estiver aí dentro, sem pressa.",
    ]);
  }
  if (goal === "autocuidado") {
    return pick([
      "Como você se cuidou hoje, mesmo no pequeno?",
      "Que pequeno gesto você teve com você hoje?",
      "Como tá sendo o seu dia até aqui?",
    ]);
  }
  if (goal === "energia") {
    return pick([
      "Como tá sua energia agora?",
      "O que tá te enchendo ou te esvaziando hoje?",
      "Me conta como você tá sentindo o seu corpo agora.",
    ]);
  }

  // 5. Fallback por hora do dia (sem goal definido)
  const hour = now.getHours();
  if (hour < 5)
    return "O que está te acordando essa noite?";
  if (hour < 12)
    return pick(["Como começa seu dia hoje?", "Como você acordou?"]);
  if (hour < 18)
    return pick(["O que aconteceu até aqui no dia?", "Como tá indo o dia?"]);
  return pick(["Como foi o seu dia?", "O que ficou desse dia para você?"]);
}

const FALLBACK: Record<string, string> = {
  otima: "Que lindo ver você assim! Continue celebrando esses momentos. 🌸",
  bem: "Dia bonito por aí! Esses cuidados fazem toda diferença. 💖",
  neutra: "Dias tranquilos têm seu valor. Que tal um tempinho para você? ☕",
  mal: "Obrigada por compartilhar. Você é corajosa. 💜",
  pessima: "Está tudo bem não estar bem. Respire fundo, estou aqui. 🤍",
};

const triggerHaptic = () => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate([50]);
    } catch (e) {
      // ignore
    }
  }
};

export default function MoodRegister() {
  const [userName, setUserName] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodScale, setMoodScale] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(0);
  // Sprint 3.1: campos de sono (opcionais)
  const [sleepQuality, setSleepQuality] = useState<"good" | "ok" | "bad" | null>(
    null
  );
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  // Sprint 3.2: tempo de tela manual (opcional, copy anti-culpa)
  const [screenTimeHours, setScreenTimeHours] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [noteTab, setNoteTab] = useState<"text" | "audio">("text");
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [placeholderText, setPlaceholderText] = useState(
    "Conte o que quiser, esse espaço é só seu..."
  );
  const [audioState, setAudioState] = useState<"idle" | "recording" | "done">(
    "idle"
  );
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar profile (name + goal)
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, goal")
        .eq("id", user.id)
        .single();

      if (profile?.name) {
        setUserName(profile.name);
      } else if (user.email) {
        // Fallback: parte do email antes do @, capitalizada
        const fromEmail = user.email.split("@")[0];
        setUserName(fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1));
      }

      // Buscar último registro (para placeholder adaptativo)
      const { data: lastEntries } = await supabase
        .from("mood_entries")
        .select("mood_scale, tags, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastEntry = (lastEntries?.[0] as LastEntry | undefined) || null;
      setPlaceholderText(
        getAdaptivePrompt(lastEntry, profile?.goal || null, new Date())
      );
    })();
  }, []);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function handleMoodSelect(m: (typeof MOODS)[0]) {
    triggerHaptic();
    setSelectedMood(m.key);
    setMoodScale(m.scale);
  }

  function toggleItem<T extends string>(
    list: T[],
    item: T,
    setter: (v: T[]) => void
  ) {
    setter(
      list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
    );
  }

  // Audio
  async function startRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert(
          "Seu navegador não suporta gravação de áudio. Tente usar Chrome, Edge ou Firefox atualizado."
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(b);
        setAudioUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setAudioState("recording");
      setRecSeconds(0);
      recTimerRef.current = setInterval(
        () => setRecSeconds((p) => p + 1),
        1000
      );
    } catch (e: unknown) {
      console.error("Erro ao acessar microfone:", e);
      const err = e as { name?: string; message?: string };
      if (err.name === "NotAllowedError") {
        alert(
          "Você não deu permissão pro app usar o microfone.\n\nClique no cadeado 🔒 ao lado do endereço (http://localhost:3000) e libere o microfone. Depois recarregue a página com F5."
        );
      } else if (err.name === "NotFoundError") {
        alert(
          "Não encontrei nenhum microfone no seu computador.\n\nVerifique se ele está conectado e ligado nas configurações do Windows (Configurações → Sistema → Som)."
        );
      } else if (err.name === "NotReadableError") {
        alert(
          "Outro app está usando seu microfone agora (Zoom, Teams, Meet, WhatsApp, Discord, etc.).\n\nFeche esses apps e tente de novo."
        );
      } else if (err.name === "SecurityError") {
        alert(
          "Por segurança, o microfone só funciona em endereços localhost ou https://. Verifique se você está em http://localhost:3000."
        );
      } else {
        alert(
          `Não consegui ligar o microfone.\n\nErro: ${err.name || "desconhecido"}\nDetalhe: ${err.message || "(sem detalhe)"}\n\nTire um print dessa mensagem e me mande.`
        );
      }
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state !== "inactive")
      mediaRecorderRef.current?.stop();
    clearInterval(recTimerRef.current!);
    setAudioState("done");
  }

  function deleteRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioState("idle");
    setRecSeconds(0);
    setIsPlaying(false);
    setPlayProgress(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    clearInterval(playTimerRef.current!);
  }

  function redoRecording() {
    deleteRecording();
    setTimeout(startRecording, 100);
  }

  function togglePlayback() {
    if (!audioUrl) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      clearInterval(playTimerRef.current!);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setPlayProgress(100);
        clearInterval(playTimerRef.current!);
      };
    }
    audioRef.current.play();
    setIsPlaying(true);
    playTimerRef.current = setInterval(() => {
      if (audioRef.current)
        setPlayProgress(
          Math.round(
            (audioRef.current.currentTime / audioRef.current.duration) * 100
          )
        );
    }, 100);
  }

  function fmt(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  async function handleSave() {
    if (!selectedMood) {
      // Mensagem específica: o único campo obrigatório é o emoji de Humor (1ª seção).
      // Tags, energia, atividades, sono, nota e áudio são todos opcionais.
      alert(
        "Para registrar, escolha primeiro como está seu humor (toque em um dos emojis no topo: 😣 😒 😐 😊 🤩)."
      );
      // Rola a tela até a seção de Humor pra Marina ver onde clicar
      document
        .getElementById("section-humor")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (containsCrisisKeywords(note)) {
      setShowCrisisModal(true);
      return;
    }

    const maskedNote = maskSensitiveData(note);

    setSaving(true);
    setAiFeedback(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticada");
      let uploadedAudioUrl: string | null = null;
      if (audioBlob) {
        const fn = `${user.id}/${Date.now()}.webm`;
        const { error } = await supabase.storage
          .from("mood-audios")
          .upload(fn, audioBlob, { contentType: "audio/webm" });
        if (!error) {
          const { data } = supabase.storage
            .from("mood-audios")
            .getPublicUrl(fn);
          uploadedAudioUrl = data.publicUrl;
        }
      }
      const { data: entry, error: ie } = await supabase
        .from("mood_entries")
        .insert({
          user_id: user.id,
          mood_emoji: selectedMood,
          mood_scale: moodScale,
          energy_level: energyLevel > 0 ? energyLevel : null,
          tags: selectedTags,
          activities: selectedActivities,
          note: maskedNote || null,
          audio_url: uploadedAudioUrl,
          // Sprint 3.1: campos de sono (NULL se não preenchidos)
          sleep_quality: sleepQuality,
          sleep_hours: sleepHours,
          // Sprint 3.2: tempo de tela manual (NULL se não preenchido)
          screen_time_hours: screenTimeHours,
        })
        .select("id")
        .single();
      if (ie) throw ie;
      const now = new Date();
      setSavedAt(
        `salvo em ${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
      );
      setSaving(false);
      setAiLoading(true);
      try {
        const { data: aiData, error: aiError } =
          await supabase.functions.invoke("generate-mood-feedback", {
            body: {
              entry: {
                id: entry?.id,
                user_id: user.id,
                mood_emoji: selectedMood,
                mood_scale: moodScale,
                energy_level: energyLevel,
                tags: selectedTags,
                activities: selectedActivities,
                note: maskedNote || null,
              },
            },
          });
        if (aiError) {
          console.error("Erro ao chamar IA:", aiError);
          // Tentar extrair detalhes do body da response (a função v4 retorna info detalhada)
          try {
            const errCtx = (aiError as { context?: Response }).context;
            if (errCtx && typeof errCtx.clone === "function") {
              const errBody = await errCtx.clone().json();
              console.error("Detalhes do erro da IA:", errBody);
            }
          } catch (parseErr) {
            console.error("Não consegui ler detalhes do erro:", parseErr);
          }
          setAiFeedback(FALLBACK[selectedMood] || FALLBACK.neutra);
        } else if (aiData?.feedback) {
          setAiFeedback(aiData.feedback);
        } else {
          console.warn("IA respondeu sem feedback:", aiData);
          setAiFeedback(FALLBACK[selectedMood] || FALLBACK.neutra);
        }
      } catch (e) {
        console.error("Erro ao chamar IA:", e);
        setAiFeedback(FALLBACK[selectedMood] || FALLBACK.neutra);
      } finally {
        setAiLoading(false);
      }
    } catch (e) {
      console.error(e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Erro desconhecido";
      alert(`Erro ao salvar.\n\nDetalhe: ${msg}`);
      setSaving(false);
    }
  }

  function handleNewEntry() {
    setSelectedMood(null);
    setMoodScale(5);
    setEnergyLevel(0);
    setSleepQuality(null);
    setSleepHours(null);
    setScreenTimeHours(null);
    setSelectedTags([]);
    setSelectedActivities([]);
    setNote("");
    setAudioState("idle");
    setAudioBlob(null);
    setAudioUrl(null);
    setRecSeconds(0);
    setSavedAt(null);
    setAiFeedback(null);
    setAiLoading(false);
    setNoteTab("text");
    // Volta a tela pro topo (Sprint 4 polimento)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div>
      {/* HEADER */}
      <div className="px-6 pt-6">
        <h1 className="text-center font-[family-name:var(--font-quicksand)] text-[22px] font-medium mb-3">
          Diário da{" "}
          <span className="text-mapa-pink-deep">{userName || "..."}</span>
        </h1>
        <div className="flex items-baseline justify-center gap-2 pb-3">
          <span className="font-[family-name:var(--font-playfair)] italic text-xs text-mapa-muted">
            Querido diário,
          </span>
          <span className="font-[family-name:var(--font-playfair)] italic text-xs text-mapa-muted">
            {today}
          </span>
        </div>
      </div>

      <div className="px-5 pb-7">
        {/* HUMOR — obrigatório, único campo que bloqueia o save se vazio */}
        <div id="section-humor">
        <Section
          label="Humor"
          hint="toque no emoji que mais combina com você agora"
        >
          <div className="flex gap-1.5 justify-between mb-3.5">
            {MOODS.map((m) => (
              <button
                key={m.key}
                onClick={() => handleMoodSelect(m)}
                className={`flex-1 py-2.5 px-0.5 pb-2 rounded-[20px] border-[1.5px] flex flex-col items-center gap-1 cursor-pointer transition-all duration-200 font-[family-name:var(--font-quicksand)] ${selectedMood === m.key ? "border-mapa-pink bg-mapa-pink-light shadow-[0_4px_16px_rgba(232,160,191,0.25)] scale-105" : "border-mapa-border bg-mapa-card"}`}
              >
                <span className="text-[26px] leading-none">{m.emoji}</span>
                <span
                  className={`text-[9px] font-medium ${selectedMood === m.key ? "text-mapa-pink-deep" : "text-mapa-muted"}`}
                >
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </Section>
        </div>

        {/* ENERGIA */}
        <Section
          label="Energia"
          hint="como está seu corpo e sua disposição agora?"
          collapsible
          defaultExpanded={false}
        >
          <div className="flex gap-1.5 items-end h-11 mb-1">
            {[1, 2, 3, 4, 5, 6].map((l) => (
              <div
                key={l}
                onClick={() => setEnergyLevel(l)}
                className={`flex-1 rounded-lg cursor-pointer transition-all duration-200 ${l <= energyLevel ? "bg-mapa-lavender" : "bg-mapa-border"}`}
                style={{ height: `${15 + l * 15}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[10px] text-mapa-muted">
              esgotada
            </span>
            <span className="text-[10px] text-mapa-muted">
              energizada
            </span>
          </div>
        </Section>

        {/* SONO (Sprint 3.1) — V1 do mockup (Section padrão) com a barrinha inline compacta */}
        <Section
          label="Como foi seu sono?"
          hint="se quiser registrar como você dormiu"
          optional
          collapsible
          defaultExpanded={false}
        >
          {/* 3 botões de qualidade — estilo V1: fundo branco + border padrão */}
          <div className="grid grid-cols-3 gap-2 mb-2.5">
            {SLEEP_QUALITIES.map((q) => {
              const selected = sleepQuality === q.value;
              return (
                <button
                  key={q.value}
                  type="button"
                  onClick={() =>
                    setSleepQuality(selected ? null : q.value)
                  }
                  className={`py-2.5 px-1 rounded-2xl border-[1.5px] cursor-pointer text-center transition-all duration-200 font-[family-name:var(--font-quicksand)] ${
                    selected
                      ? "bg-mapa-lavender-light border-mapa-lavender text-[#5A4A8C] shadow-[0_2px_8px_rgba(184,169,212,0.25)]"
                      : "bg-mapa-card border-mapa-border text-mapa-text hover:border-mapa-lavender"
                  }`}
                >
                  <span className="text-2xl block mb-0.5 leading-none">
                    {q.emoji}
                  </span>
                  <span className="text-[11px] font-medium">{q.label}</span>
                </button>
              );
            })}
          </div>

          {/* Slider padronizado (RangeBar) — Horas dormidas */}
          <RangeBar
            label="horas dormidas"
            value={sleepHours ?? 7}
            hasValue={sleepHours !== null}
            displayText={sleepHours !== null ? String(sleepHours) : undefined}
            unit="h"
            min={4}
            max={12}
            step={0.5}
            ticks={["4h", "8h", "12h"]}
            onChange={(v) => { triggerHaptic(); setSleepHours(v); }}
            textColor="#5A4A8C"
            accent="#5A4A8C"
          />

          {/* "Prefiro não responder" — só aparece se algum campo está preenchido */}
          {(sleepQuality !== null || sleepHours !== null) && (
            <div className="text-center mt-2.5">
              <button
                type="button"
                onClick={() => {
                  setSleepQuality(null);
                  setSleepHours(null);
                }}
                className="text-[11px] text-mapa-muted italic font-[family-name:var(--font-playfair)] underline underline-offset-[3px] cursor-pointer hover:text-mapa-pink-deep transition-colors"
              >
                prefiro não responder
              </button>
            </div>
          )}
        </Section>

        {/* TAGS */}
        <Section
          label="Como você está se sentindo?"
          hint="escolha tudo que faz sentido para você neste momento"
          collapsible
          defaultExpanded={false}
        >
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <button
                key={t.label}
                onClick={() =>
                  toggleItem(selectedTags, t.label, setSelectedTags)
                }
                className={`py-[7px] px-4 rounded-3xl text-xs font-medium border-[1.5px] cursor-pointer transition-all duration-200 font-[family-name:var(--font-quicksand)] ${selectedTags.includes(t.label) ? "bg-mapa-pink text-white border-mapa-pink shadow-[0_2px_8px_rgba(232,160,191,0.2)]" : "bg-mapa-card text-mapa-text border-mapa-border hover:border-mapa-pink"}`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </Section>

        {/* ATIVIDADES */}
        <Section
          label="O que você fez hoje?"
          hint="selecione as atividades que fizeram parte do seu dia"
          collapsible
          defaultExpanded={false}
        >
          <div className="grid grid-cols-3 gap-2">
            {ACTIVITIES.map((a) => (
              <button
                key={a.label}
                onClick={() =>
                  toggleItem(
                    selectedActivities,
                    a.label,
                    setSelectedActivities
                  )
                }
                className={`py-2.5 px-1 pb-2 rounded-2xl border-[1.5px] cursor-pointer text-center transition-all duration-200 text-[11px] font-medium font-[family-name:var(--font-quicksand)] ${selectedActivities.includes(a.label) ? "bg-mapa-lavender-light border-mapa-lavender text-[#6B5B95] shadow-[0_2px_8px_rgba(184,169,212,0.2)]" : "bg-mapa-card border-mapa-border text-mapa-text hover:border-mapa-lavender"}`}
              >
                <span className="text-xl block mb-0.5">{a.emoji}</span>
                {a.label}
              </button>
            ))}
          </div>
        </Section>

        {/* TEMPO DE TELA (Sprint 3.2) — opcional, anti-culpa */}
        <Section
          label="Tempo de tela hoje"
          hint="se quiser registrar — sem julgamento, é só seu mapa"
          optional
          collapsible
          defaultExpanded={false}
        >
          {/* Slider padronizado (RangeBar) — Tempo de tela */}
          <RangeBar
            label="horas no celular"
            value={screenTimeHours ?? 3}
            hasValue={screenTimeHours !== null}
            displayText={
              screenTimeHours !== null ? String(screenTimeHours) : undefined
            }
            unit="h"
            min={0}
            max={12}
            step={0.5}
            ticks={["0h", "6h", "12h"]}
            onChange={(v) => { triggerHaptic(); setScreenTimeHours(v); }}
            textColor="#6B6280"
            accent="#6B6280"
          />

          {/* "Prefiro não responder" — só aparece se preencheu */}
          {screenTimeHours !== null && (
            <div className="text-center mt-2.5">
              <button
                type="button"
                onClick={() => setScreenTimeHours(null)}
                className="text-[11px] text-mapa-muted italic font-[family-name:var(--font-playfair)] underline underline-offset-[3px] cursor-pointer hover:text-mapa-pink-deep transition-colors"
              >
                prefiro não responder
              </button>
            </div>
          )}
        </Section>

        {/* NOTA PESSOAL */}
        <Section
          label="Nota pessoal"
          hint="escreva ou grave um áudio sobre como foi seu dia"
        >
          <div className="rounded-[18px] border-[1.5px] border-mapa-border/60 bg-[#FAFAFA] overflow-hidden">
            <div className="flex border-b border-mapa-border/50">
              <button
                onClick={() => setNoteTab("text")}
                className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-none font-[family-name:var(--font-quicksand)] ${noteTab === "text" ? "text-mapa-pink-deep bg-mapa-pink-light" : "text-mapa-muted bg-transparent"}`}
              >
                <Pencil size={14} strokeWidth={1.75} />
                Escrever
              </button>
              <button
                onClick={() => setNoteTab("audio")}
                className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-none font-[family-name:var(--font-quicksand)] ${noteTab === "audio" ? "text-mapa-pink-deep bg-mapa-pink-light" : "text-mapa-muted bg-transparent"}`}
              >
                <Mic size={14} strokeWidth={1.75} />
                Gravar áudio
              </button>
            </div>
            {noteTab === "text" && (
              <div className="p-3 px-4">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={placeholderText}
                  className="w-full border-none text-[13px] resize-none h-16 bg-transparent text-mapa-text outline-none leading-relaxed placeholder:text-mapa-muted/50 font-[family-name:var(--font-quicksand)]"
                />
              </div>
            )}
            {noteTab === "audio" && (
              <div className="py-5 px-4 text-center">
                {audioState === "idle" && (
                  <>
                    <p className="text-[11px] text-mapa-muted mb-3.5 italic">
                      toque no microfone para começar a gravar
                    </p>
                    <button
                      onClick={startRecording}
                      className="w-14 h-14 rounded-full border-[3px] border-mapa-pink bg-mapa-pink-light cursor-pointer inline-flex items-center justify-center hover:bg-mapa-pink group"
                    >
                      <MicIcon className="fill-mapa-pink-deep group-hover:fill-white" />
                    </button>
                  </>
                )}
                {audioState === "recording" && (
                  <>
                    <p className="text-[11px] text-mapa-muted mb-3.5 italic">
                      gravando... toque para parar
                    </p>
                    <button
                      onClick={stopRecording}
                      className="w-14 h-14 rounded-full border-[3px] border-mapa-coral bg-mapa-coral cursor-pointer inline-flex items-center justify-center animate-pulse-rec"
                    >
                      <MicIcon className="fill-white" />
                    </button>
                    <p className="mt-2.5 text-sm font-semibold text-mapa-coral">
                      {fmt(recSeconds)}
                    </p>
                  </>
                )}
                {audioState === "done" && (
                  <div className="bg-mapa-pink-light rounded-2xl p-3.5 px-4 text-left">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <button
                        onClick={togglePlayback}
                        className="w-[38px] h-[38px] rounded-full bg-mapa-pink border-none cursor-pointer flex items-center justify-center shrink-0"
                      >
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                      </button>
                      <div>
                        <p className="text-[13px] font-semibold text-mapa-pink-deep">
                          {fmt(
                            audioRef.current
                              ? Math.round(audioRef.current.currentTime)
                              : 0
                          )}{" "}
                          / {fmt(recSeconds)}
                        </p>
                        <p className="text-[10px] text-mapa-muted mt-px">
                          seu áudio gravado
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-mapa-border rounded-sm overflow-hidden mb-2.5">
                      <div
                        className="h-full bg-mapa-pink rounded-sm transition-[width] duration-100"
                        style={{ width: `${playProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-center gap-4">
                      <button
                        onClick={redoRecording}
                        className="text-[11px] font-semibold text-mapa-pink-deep bg-transparent border-none cursor-pointer py-1 px-2 rounded-lg hover:bg-mapa-pink-deep/10 font-[family-name:var(--font-quicksand)]"
                      >
                        🔄 Regravar
                      </button>
                      <button
                        onClick={deleteRecording}
                        className="text-[11px] font-semibold text-mapa-coral bg-transparent border-none cursor-pointer py-1 px-2 rounded-lg hover:bg-mapa-coral/10 font-[family-name:var(--font-quicksand)]"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

      </div>

      {/* STICKY SAVE BUTTON */}
      <div className="fixed bottom-[65px] left-1/2 -translate-x-1/2 w-full max-w-[420px] p-5 pt-10 bg-gradient-to-t from-mapa-bg via-mapa-bg/90 to-transparent z-40 pointer-events-none">
        <button
          onClick={handleSave}
          disabled={saving || aiLoading}
          className="w-full py-[15px] rounded-3xl border-none bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white text-[15px] font-semibold cursor-pointer tracking-wide shadow-[0_6px_20px_rgba(232,160,191,0.35)] active:scale-[0.95] active:brightness-95 transition-all duration-150 disabled:opacity-70 font-[family-name:var(--font-quicksand)] pointer-events-auto"
        >
          {saving ? "Salvando..." : "Registrar momento"}
        </button>
      </div>

      {/* MODAL DA LIS */}
      {(aiLoading || aiFeedback) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl relative animate-in fade-in zoom-in duration-300 flex flex-col items-center">
            {aiLoading ? (
              <div className="py-6 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-mapa-pink-light flex items-center justify-center mb-4 animate-pulse">
                  <span className="text-xl">🌿</span>
                </div>
                <p className="text-[15px] font-[family-name:var(--font-quicksand)] font-semibold text-mapa-pink-deep mb-2">
                  A Lis está pensando...
                </p>
                <p className="text-[13px] text-mapa-muted text-center italic font-[family-name:var(--font-playfair)]">
                  refletindo sobre o seu dia
                </p>
              </div>
            ) : (
              <>
                <div className="w-full flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-mapa-mint" />
                  <span className="text-[11px] font-semibold text-[#5BA67D] uppercase tracking-wider">
                    Lis para você
                  </span>
                </div>
                <p className="text-[14px] leading-relaxed text-mapa-text w-full text-left mb-6 font-[family-name:var(--font-quicksand)]">
                  {aiFeedback}
                </p>
                {savedAt && (
                  <p className="text-[11px] text-mapa-muted italic w-full text-center mb-5 font-[family-name:var(--font-playfair)]">
                    {savedAt}
                  </p>
                )}
                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleNewEntry}
                    className="flex-1 py-3.5 rounded-[16px] border-[1.5px] border-mapa-mint bg-transparent text-[13px] font-semibold text-[#5BA67D] cursor-pointer hover:bg-mapa-mint/10 font-[family-name:var(--font-quicksand)] transition-colors"
                  >
                    Novo registro
                  </button>
                  <Link
                    href="/mapa"
                    className="flex-1 py-3.5 rounded-[16px] bg-[#5BA67D] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#4A8F6A] text-center no-underline flex items-center justify-center font-[family-name:var(--font-quicksand)] transition-colors"
                  >
                    Ir para o Mapa
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CRISE */}
      {showCrisisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl relative animate-in fade-in zoom-in duration-300">
            <h2 className="text-xl font-bold font-[family-name:var(--font-playfair)] text-mapa-pink-deep mb-3 text-center">
              Você não está sozinha
            </h2>
            <p className="text-[13px] leading-relaxed font-[family-name:var(--font-quicksand)] text-mapa-text mb-5 text-center">
              Percebi que você escreveu palavras muito difíceis. Nesses momentos de crise e de dor profunda, o Mapa (que é uma IA) não substitui o calor de um ser humano preparado para te ouvir.
            </p>
            <div className="bg-[#FFF0F6] rounded-xl p-4 mb-5 border border-[#FCE4ED]">
              <p className="text-sm font-semibold font-[family-name:var(--font-quicksand)] text-center text-[#8E3A6B] mb-1">
                Ligue gratuitamente para 188
              </p>
              <p className="text-xs text-center text-[#8E3A6B]/80 font-[family-name:var(--font-quicksand)]">
                O CVV atende 24 horas por dia, com pessoas reais prontas para te acolher, sob total sigilo.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCrisisModal(false)}
                className="flex-1 py-3 rounded-[16px] text-[13px] font-semibold text-mapa-muted bg-transparent border-[1.5px] border-mapa-border hover:bg-mapa-card font-[family-name:var(--font-quicksand)] cursor-pointer"
              >
                Voltar
              </button>
              <a
                href="tel:188"
                className="flex-1 py-3 rounded-[16px] text-[13px] font-semibold text-white bg-mapa-pink-deep hover:bg-mapa-pink text-center font-[family-name:var(--font-quicksand)] flex items-center justify-center no-underline"
              >
                Ligar 188
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Padrão visual das barras de slider — usado em Humor (escala), Sono (horas
// dormidas) e Tempo de tela. Layout: label+valor em cima, slider full-width
// no meio, 3 ticks embaixo. Cada barra tem uma paleta própria, mas a
// estrutura é idêntica.
function RangeBar({
  emoji,
  label,
  labelSize = 13,
  value,
  hasValue = true,
  displayText,
  unit = "",
  min,
  max,
  step,
  ticks,
  onChange,
  textColor,
  accent,
}: {
  emoji?: string;
  label: string;
  labelSize?: number; // tamanho da fonte do label em px (default 12)
  value: number;
  hasValue?: boolean; // false = mostra "—" no lugar do número
  displayText?: string; // override do número (ex.: "8.5"). Default: String(value)
  unit?: string;
  min: number;
  max: number;
  step: number;
  ticks: [string, string, string];
  onChange: (v: number) => void;
  textColor: string;
  accent: string;
}) {
  return (
    <div className="px-1 pt-1">
      <div className="flex items-baseline justify-between mb-1.5">
        <span
          className="font-medium"
          style={{ color: textColor, fontSize: `${labelSize}px` }}
        >
          {emoji && <span className="mr-1">{emoji}</span>}
          {label}
        </span>
        {hasValue ? (
          <span
            className="text-[16px] font-semibold leading-none"
            style={{ color: textColor }}
          >
            {displayText ?? value}
            {unit && (
              <span className="text-[12px] font-normal opacity-75 ml-0.5">
                {unit}
              </span>
            )}
          </span>
        ) : (
          <span
            className="text-[16px] leading-none opacity-60"
            style={{ color: textColor }}
          >
            —
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: accent }}
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[11px] text-mapa-muted">{ticks[0]}</span>
        <span className="text-[11px] text-mapa-muted">{ticks[1]}</span>
        <span className="text-[11px] text-mapa-muted">{ticks[2]}</span>
      </div>
    </div>
  );
}

function Section({
  label,
  hint,
  optional = false,
  collapsible = false,
  defaultExpanded = true,
  children,
}: {
  label: string;
  hint: string;
  optional?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (collapsible && !expanded) {
    return (
      <button 
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full text-left mb-5 bg-white border border-mapa-border/60 rounded-[20px] px-5 py-4 shadow-[0_2px_10px_rgba(232,160,191,0.04)] flex justify-between items-center transition-all cursor-pointer hover:bg-gray-50/50 group"
      >
        <div>
          <p className="text-[13px] font-semibold text-mapa-pink-deep mb-0.5 font-[family-name:var(--font-quicksand)]">{label}</p>
          <p className="text-[11px] text-mapa-muted italic font-[family-name:var(--font-playfair)]">toque para adicionar</p>
        </div>
        <ChevronDown size={16} className="text-mapa-muted group-hover:text-mapa-pink-deep transition-colors" />
      </button>
    );
  }

  return (
    <div className="mb-5 bg-white border border-mapa-border/60 rounded-[24px] p-5 shadow-[0_4px_20px_rgba(232,160,191,0.06)] relative">
      <div className="mb-4 pr-6">
        <p className="text-sm font-semibold text-mapa-pink-deep mb-0.5">
          {label}
          {optional && (
            <span className="font-[family-name:var(--font-playfair)] italic font-normal text-[11px] text-mapa-muted ml-1.5">
              — opcional
            </span>
          )}
        </p>
        <p className="text-[11px] text-mapa-muted italic leading-snug">
          {hint}
        </p>
      </div>
      {collapsible && (
        <button 
          type="button"
          onClick={() => setExpanded(false)} 
          className="absolute top-5 right-5 text-mapa-muted bg-transparent border-none cursor-pointer hover:text-mapa-coral transition-colors flex items-center justify-center p-1"
        >
          ✕
        </button>
      )}
      {children}
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z"
        className={className}
      />
      <path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={12}
        y1={19}
        x2={12}
        y2={23}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <line
        x1={8}
        y1={23}
        x2={16}
        y2={23}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="white">
      <polygon points="6,3 20,12 6,21" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="white">
      <rect x={5} y={3} width={4} height={18} rx={1} />
      <rect x={15} y={3} width={4} height={18} rx={1} />
    </svg>
  );
}
