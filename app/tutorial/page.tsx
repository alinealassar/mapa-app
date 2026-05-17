"use client";

import { useEffect, useState } from "react";
import { Sparkles, Map, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Tutorial pos-onboarding (3 slides) — primeira vez que a usuaria entra
// no app. Mostra como REGISTRAR, como a LIS responde e onde ver o
// HISTORICO/MAPA. Botao "Pular" sempre visivel. Apos o ultimo slide,
// redireciona para /registrar.
//
// Nao tem flag no banco — usuaria que ja passou nao volta aqui automaticamente.
// Se quiser oferecer o tour pras usuarias existentes, adicionar um link em /eu
// futuramente.

const SLIDES = [
  {
    key: "registrar",
    title: "Comece registrando",
    text: "Toque num emoji pra marcar como você está. Marque sentimentos, atividades, sono — só o que fizer sentido. Tudo opcional, no seu ritmo.",
  },
  {
    key: "lis",
    title: "A Lis te escuta",
    text: "Depois que você registra, ela responde como uma amiga atenta — com base no seu humor, no que você marcou, e no seu histórico. Pode escrever ou gravar áudio.",
  },
  {
    key: "mapa",
    title: "Veja sua jornada",
    text: "No Mapa, sua semana ganha um resumo da Lis. No Histórico, todos os momentos ficam guardados pra você revisitar quando quiser.",
  },
];

export default function TutorialPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_done")
        .eq("id", user.id)
        .single();
      if (!profile?.onboarding_done) {
        window.location.href = "/onboarding";
        return;
      }
      setAuthenticated(true);
    }
    check();
  }, []);

  function finish() {
    window.location.href = "/registrar";
  }

  function next() {
    if (step >= SLIDES.length - 1) {
      finish();
      return;
    }
    setStep(step + 1);
  }

  function back() {
    if (step === 0) return;
    setStep(step - 1);
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-mapa-bg">
        <p className="text-mapa-muted italic">Carregando...</p>
      </main>
    );
  }

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <main className="min-h-screen bg-gradient-to-b from-mapa-bg via-mapa-pink-light to-mapa-lavender-light flex flex-col px-6 py-3">
      {/* Topo: progresso + pular */}
      <div className="max-w-sm w-full mx-auto pt-1 pb-3 flex items-center justify-between">
        <div className="flex gap-1.5 flex-1">
          {SLIDES.map((s, i) => (
            <div
              key={s.key}
              className={`flex-1 h-1 rounded-full transition-all ${
                i <= step ? "bg-mapa-pink" : "bg-mapa-border"
              }`}
            />
          ))}
        </div>
        <button
          onClick={finish}
          className="ml-4 text-xs text-mapa-muted hover:text-mapa-pink-deep cursor-pointer bg-transparent border-none font-[family-name:var(--font-quicksand)]"
        >
          Pular
        </button>
      </div>

      {/* Conteudo central: SEM justify-center pra colar no topo logo apos
          o header. flex-1 garante que o footer (botoes) fique grudado
          na base sem espaco extra. */}
      <div className="flex-1 flex flex-col items-center max-w-sm w-full mx-auto pt-2">
        {slide.key === "registrar" && <RegistrarMock />}
        {slide.key === "lis" && <LisMock />}
        {slide.key === "mapa" && <MapaMock />}

        <h1 className="font-[family-name:var(--font-quicksand)] text-[22px] font-semibold text-mapa-text mt-4 mb-1.5 text-center">
          {slide.title}
        </h1>
        <p className="text-[13.5px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)] text-center max-w-xs">
          {slide.text}
        </p>
      </div>

      {/* Navegacao */}
      <div className="max-w-sm w-full mx-auto pt-3 pb-2 flex gap-3">
        {step > 0 && (
          <button
            onClick={back}
            className="flex-1 py-3 rounded-2xl border-[1.5px] border-mapa-border bg-transparent text-mapa-muted font-semibold text-sm cursor-pointer font-[family-name:var(--font-quicksand)]"
          >
            Voltar
          </button>
        )}
        <button
          onClick={next}
          className={`${
            step > 0 ? "flex-[2]" : "w-full"
          } py-3 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-semibold text-[15px] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(232,160,191,0.35)] transition font-[family-name:var(--font-quicksand)]`}
        >
          {isLast ? "Começar a usar" : "Próximo"}
        </button>
      </div>
    </main>
  );
}

// --- Mockups CSS (sem imagens) -------------------------------------------

// Mock 1: card de humor com emoji selecionado + chips de sentimento
function RegistrarMock() {
  return (
    <div className="w-full max-w-[280px] bg-mapa-card/90 backdrop-blur rounded-[20px] border border-mapa-border/60 p-4 shadow-[0_8px_30px_rgba(232,160,191,0.18)]">
      <p className="text-[10px] font-semibold text-mapa-pink-deep uppercase tracking-wide mb-2.5">
        Humor
      </p>
      <div className="flex justify-between gap-1.5 mb-3">
        {["😣", "😒", "😐", "😊", "🤩"].map((e, i) => (
          <div
            key={i}
            className={`flex-1 py-2 rounded-[14px] border-[1.5px] flex items-center justify-center text-[20px] ${
              i === 3
                ? "border-mapa-pink bg-mapa-pink-light scale-105"
                : "border-mapa-border bg-mapa-card"
            }`}
          >
            {e}
          </div>
        ))}
      </div>
      <p className="text-[10px] font-semibold text-mapa-pink-deep uppercase tracking-wide mb-1.5">
        Sentimentos
      </p>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[11px] py-1 px-2.5 rounded-2xl bg-mapa-pink text-white font-medium">
          🪶 leve
        </span>
        <span className="text-[11px] py-1 px-2.5 rounded-2xl bg-mapa-pink text-white font-medium">
          💖 grata
        </span>
        <span className="text-[11px] py-1 px-2.5 rounded-2xl bg-mapa-card border border-mapa-border text-mapa-muted">
          ✨ inspirada
        </span>
      </div>
    </div>
  );
}

// Mock 2: card da Lis (modal) com resposta
function LisMock() {
  return (
    <div className="w-full max-w-[280px] bg-white rounded-[24px] p-5 shadow-[0_10px_36px_rgba(60,30,50,0.15)] border border-mapa-border/40">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} strokeWidth={1.75} className="text-[#5BA67D]" />
        <span className="text-[10px] font-semibold text-[#5BA67D] uppercase tracking-wider">
          Lis para você
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-mapa-text font-[family-name:var(--font-quicksand)]">
        Esse cansaço tem peso. Tira cinco minutos só pra respirar antes de
        seguir — pode ser deitar no chão, fechar os olhos, beber água. Você
        não precisa dar conta de tudo agora.
      </p>
    </div>
  );
}

// Mock 3: mini-gráfico + lista cronológica
function MapaMock() {
  return (
    <div className="w-full max-w-[280px] flex gap-3">
      {/* Mini Mapa */}
      <div className="flex-1 bg-mapa-card/90 backdrop-blur rounded-[18px] border border-mapa-border/60 p-3 shadow-[0_6px_20px_rgba(232,160,191,0.15)]">
        <div className="flex items-center gap-1 mb-2">
          <Map size={11} strokeWidth={1.75} className="text-mapa-pink-deep" />
          <p className="text-[9px] font-semibold text-mapa-pink-deep uppercase tracking-wide">
            Mapa
          </p>
        </div>
        <div className="flex items-end gap-1 h-12">
          {[40, 60, 80, 55, 90, 70, 95].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-mapa-pink to-mapa-lavender rounded-t-sm"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      {/* Mini Histórico */}
      <div className="flex-1 bg-mapa-card/90 backdrop-blur rounded-[18px] border border-mapa-border/60 p-3 shadow-[0_6px_20px_rgba(232,160,191,0.15)]">
        <div className="flex items-center gap-1 mb-2">
          <BookOpen size={11} strokeWidth={1.75} className="text-mapa-pink-deep" />
          <p className="text-[9px] font-semibold text-mapa-pink-deep uppercase tracking-wide">
            Histórico
          </p>
        </div>
        <div className="space-y-1.5">
          {["😊 Bem", "😐 Neutra", "🤩 Ótima"].map((t, i) => (
            <div
              key={i}
              className="text-[10px] py-1 px-1.5 bg-mapa-pink-light rounded-md text-mapa-text border-l-2 border-mapa-pink"
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
