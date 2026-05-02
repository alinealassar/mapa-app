"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

const MOODS = [
  { key: "pessima", emoji: "😣", label: "Péssima", scale: 1 },
  { key: "mal", emoji: "😒", label: "Mal", scale: 3 },
  { key: "neutra", emoji: "😐", label: "Neutra", scale: 5 },
  { key: "bem", emoji: "😊", label: "Bem", scale: 8 },
  { key: "otima", emoji: "🥰", label: "Ótima", scale: 10 },
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
  // Casa e rotina
  { emoji: "🍳", label: "Cozinhei" },
  { emoji: "🧹", label: "Faxinei" },
  { emoji: "🛍️", label: "Fui ao mercado" },
  // Produtividade
  { emoji: "💻", label: "Trabalhei" },
  { emoji: "📚", label: "Estudei" },
  // Corpo e movimento
  { emoji: "🏋️‍♀️", label: "Treinei" },
  { emoji: "🚶‍♀️", label: "Saí pra caminhar" },
  { emoji: "🌳", label: "Fui ao ar livre" },
  // Autocuidado e descanso
  { emoji: "💆‍♀️", label: "Cuidei de mim" },
  { emoji: "🧘‍♀️", label: "Meditei" },
  { emoji: "😴", label: "Descansei" },
  // Pessoas e afeto
  { emoji: "👫", label: "Vi amigos" },
  { emoji: "👪", label: "Vi a família" },
  { emoji: "🫂", label: "Cuidei de alguém querido" },
  { emoji: "🐾", label: "Cuidei do pet" },
  // Lazer e prazer
  { emoji: "🎨", label: "Fiz um hobby" },
  { emoji: "💡", label: "Aprendi algo novo" },
  { emoji: "📖", label: "Li algo" },
  { emoji: "🍿", label: "Assisti algo" },
  { emoji: "🎵", label: "Ouvi música" },
  { emoji: "🌸", label: "Curti minha companhia" },
];
const FALLBACK: Record<string, string> = {
  otima: "Que lindo ver você assim! Continue celebrando esses momentos. 🌸",
  bem: "Dia bonito por aí! Esses cuidados fazem toda diferença. 💖",
  neutra: "Dias tranquilos têm seu valor. Que tal um tempinho pra você? ☕",
  mal: "Obrigada por compartilhar. Você é corajosa. 💜",
  pessima: "Está tudo bem não estar bem. Respire fundo, estou aqui. 🤍",
};

export default function MoodRegister() {
  const [userName, setUserName] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodScale, setMoodScale] = useState(5);
  const [energyLevel, setEnergyLevel] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [noteTab, setNoteTab] = useState<"text" | "audio">("text");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
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
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        if (data?.name) {
          setUserName(data.name);
        } else if (user.email) {
          // Fallback: parte do email antes do @, capitalizada
          const fromEmail = user.email.split("@")[0];
          setUserName(
            fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1)
          );
        }
      }
    })();
  }, []);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function handleMoodSelect(m: (typeof MOODS)[0]) {
    setSelectedMood(m.key);
    setMoodScale(m.scale);
  }

  function handleScaleChange(v: string) {
    const n = parseInt(v);
    setMoodScale(n);
    if (n <= 2) setSelectedMood("pessima");
    else if (n <= 4) setSelectedMood("mal");
    else if (n <= 6) setSelectedMood("neutra");
    else if (n <= 8) setSelectedMood("bem");
    else setSelectedMood("otima");
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
      alert("Selecione como você está se sentindo!");
      return;
    }
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
          note: note || null,
          audio_url: uploadedAudioUrl,
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
                note: note || null,
              },
            },
          });
        if (aiError) {
          console.error("Erro ao chamar IA:", aiError);
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
  }

  return (
    <div>
      {/* HEADER */}
      <div className="px-6 pt-6">
        <h1 className="text-center font-[family-name:var(--font-quicksand)] text-[22px] font-medium mb-3">
          Diário da{" "}
          <span className="text-mapa-pink-deep">{userName || "..."}</span> 🌸
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
        {/* HUMOR */}
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
          <div className="flex items-center gap-2.5 bg-mapa-card rounded-[18px] py-2.5 px-4 border border-mapa-border/50">
            <span className="text-[10px] text-mapa-muted">1</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={moodScale}
              onChange={(e) => handleScaleChange(e.target.value)}
              className="flex-1"
            />
            <span className="text-xl font-semibold text-mapa-pink-deep min-w-[22px] text-center">
              {moodScale}
            </span>
            <span className="text-[10px] text-mapa-muted">10</span>
          </div>
        </Section>

        {/* ENERGIA */}
        <Section
          label="Energia"
          hint="como está seu corpo e sua disposição agora?"
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
          <div className="flex justify-between">
            <span className="text-[10px] text-mapa-muted italic">
              esgotada
            </span>
            <span className="text-[10px] text-mapa-muted italic">
              energizada
            </span>
          </div>
        </Section>

        {/* TAGS */}
        <Section
          label="Como você está se sentindo?"
          hint="escolha tudo que faz sentido pra você neste momento"
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

        {/* NOTA PESSOAL */}
        <Section
          label="Nota pessoal"
          hint="escreva ou grave um áudio sobre como foi seu dia"
        >
          <div className="bg-mapa-card rounded-[18px] border-[1.5px] border-mapa-border overflow-hidden">
            <div className="flex border-b border-mapa-border/50">
              <button
                onClick={() => setNoteTab("text")}
                className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-none font-[family-name:var(--font-quicksand)] ${noteTab === "text" ? "text-mapa-pink-deep bg-mapa-pink-light" : "text-mapa-muted bg-transparent"}`}
              >
                ✏️ Escrever
              </button>
              <button
                onClick={() => setNoteTab("audio")}
                className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border-none font-[family-name:var(--font-quicksand)] ${noteTab === "audio" ? "text-mapa-pink-deep bg-mapa-pink-light" : "text-mapa-muted bg-transparent"}`}
              >
                🎤 Gravar áudio
              </button>
            </div>
            {noteTab === "text" && (
              <div className="p-3 px-4">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Conte o que quiser, esse espaço é só seu..."
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

        {/* SAVE */}
        <button
          onClick={handleSave}
          disabled={saving || aiLoading}
          className="w-full py-[15px] rounded-3xl border-none bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white text-[15px] font-semibold cursor-pointer mt-1 tracking-wide hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(232,160,191,0.35)] active:scale-[0.97] transition-all disabled:opacity-70 font-[family-name:var(--font-quicksand)]"
        >
          {saving ? "Salvando..." : "Registrar momento 🌸"}
        </button>
        {savedAt && (
          <p className="text-center text-[11px] text-mapa-muted italic mt-2">
            {savedAt}
          </p>
        )}

        {aiLoading && (
          <div className="mt-4 p-5 rounded-[20px] bg-mapa-pink-light border border-mapa-border text-center">
            <p className="text-xs text-mapa-pink-deep italic">
              A Mapa está pensando em você... 🌿
            </p>
          </div>
        )}

        {aiFeedback && (
          <div className="mt-4 p-4 rounded-[20px] bg-mapa-mint-light border border-mapa-mint">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-mapa-mint" />
              <span className="text-[11px] font-semibold text-[#5BA67D] uppercase tracking-wider">
                Mapa IA para você
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-mapa-text">
              {aiFeedback}
            </p>
            <button
              onClick={handleNewEntry}
              className="mt-3.5 py-2 px-4 rounded-[14px] border-[1.5px] border-mapa-mint bg-transparent text-xs font-semibold text-[#5BA67D] cursor-pointer w-full hover:bg-mapa-mint/10 font-[family-name:var(--font-quicksand)]"
            >
              Registrar outro momento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-mapa-pink-deep mb-0.5">
        {label}
      </p>
      <p className="text-[11px] text-mapa-muted italic mb-2.5 leading-snug">
        {hint}
      </p>
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
