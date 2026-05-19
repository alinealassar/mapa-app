"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNotifications } from "@/lib/hooks/useNotifications";

// Sprint 4 polimento: nome agora é coletado no signup (vai pro user_metadata.full_name).
// O step "name" do onboarding foi removido — fica welcome, how, goal, ready.
type Step = "welcome" | "how" | "goal" | "ready";
const STEPS: Step[] = ["welcome", "how", "goal", "ready"];

const GOALS = [
  { key: "culpa", emoji: "🌷", label: "Lidar com a culpa de não dar conta" },
  { key: "ansiedade", emoji: "🌿", label: "Diminuir minha ansiedade" },
  { key: "autocuidado", emoji: "💆‍♀️", label: "Criar um hábito de autocuidado" },
  { key: "energia", emoji: "✨", label: "Ter mais energia no dia a dia" },
  { key: "solidao", emoji: "🫂", label: "Me sentir menos sozinha" },
];

export default function OnboardingPage() {
  const { enableReminders } = useNotifications();
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState("");
  const [step, setStep] = useState<Step>("welcome");

  // Dados coletados
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, goal, onboarding_done")
        .eq("id", user.id)
        .single();

      if (profile?.onboarding_done) {
        window.location.href = "/registrar";
        return;
      }

      // Pré-preenche nome com prioridade: profile.name > user_metadata.full_name (do signup) > parte do email
      const metadataName =
        (user.user_metadata?.full_name as string | undefined)?.trim() || "";
      if (profile?.name) {
        setName(profile.name);
      } else if (metadataName) {
        setName(metadataName);
      } else if (user.email) {
        const fromEmail = user.email.split("@")[0];
        setName(fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1));
      }
      // Pré-preenche objetivo se já tiver
      if (profile?.goal) {
        setGoal(profile.goal);
      }

      setAuthenticated(true);
    }
    check();
  }, []);

  const stepIndex = STEPS.indexOf(step);
  const isLastStep = stepIndex === STEPS.length - 1;
  const isFirstStep = stepIndex === 0;

  function next() {
    setError("");
    if (step === "goal" && !goal) {
      setError("Escolhe uma opção para eu te conhecer melhor 🌸");
      return;
    }
    if (isLastStep) {
      finish();
      return;
    }
    setStep(STEPS[stepIndex + 1]);
  }

  function back() {
    setError("");
    if (isFirstStep) return;
    setStep(STEPS[stepIndex - 1]);
  }

  async function finish() {
    setSaving(true);
    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: userId,
      name: name.trim(),
      goal,
      onboarding_done: true,
    });
    if (upsertError) {
      setError(
        "Não consegui salvar agora — tenta de novo em alguns minutos? (" +
          upsertError.message +
          ")"
      );
      setSaving(false);
      return;
    }
    // Pede permissão de push automaticamente ao finalizar o onboarding
    // (lembretes já vêm habilitados por default via migration reminders_enabled=true).
    // Email continua mesmo se ela negar push. Erros silenciosos: o que importa é
    // chegar no tutorial mesmo se o popup do navegador for negado.
    try {
      await enableReminders();
    } catch (e) {
      console.warn("Não foi possível ativar push no onboarding:", e);
    }
    // Passa pelo tutorial de 3 slides antes do app real. O tutorial verifica
    // onboarding_done=true via guard, entao precisa estar setado antes.
    window.location.href = "/tutorial";
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-mapa-bg">
        <p className="text-mapa-muted italic">um instante</p>
      </main>
    );
  }

  return (
    <main
      className="bg-gradient-to-b from-mapa-bg via-mapa-pink-light to-mapa-lavender-light flex flex-col items-center px-6 py-4"
      style={{ minHeight: "100dvh" }}
    >
      {/* Mesma tecnica do tutorial: minHeight 100dvh + flex flex-col flex-1
          + min-h-0 distribui as 3 zonas (header, conteudo, botoes) sem
          conflito com o pb-[72px] do layout pai. */}
      <div className="w-full max-w-sm flex flex-col flex-1 min-h-0">
        {/* Indicador de progresso */}
        <div className="flex gap-1.5 pt-2 pb-3 w-full">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-all ${
                i <= stepIndex ? "bg-mapa-pink" : "bg-mapa-border"
              }`}
            />
          ))}
        </div>

        {/* Conteudo central */}
        <div className="flex-1 flex flex-col items-center justify-center text-center w-full py-4">
          {step === "welcome" && <WelcomeStep name={name} />}
          {step === "how" && <HowStep />}
          {step === "goal" && <GoalStep selected={goal} onSelect={setGoal} />}
          {step === "ready" && <ReadyStep name={name} goal={goal} />}

          {error && (
            <p className="mt-4 text-xs text-mapa-coral text-center">{error}</p>
          )}
        </div>

        {/* Navegação na base */}
        <div className="w-full pt-3 flex gap-3">
          {!isFirstStep && (
            <button
              onClick={back}
              disabled={saving}
              className="flex-1 py-3 rounded-2xl border-[1.5px] border-mapa-border bg-transparent text-mapa-muted font-semibold text-sm cursor-pointer disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
            >
              Voltar
            </button>
          )}
          <button
            onClick={next}
            disabled={saving}
            className={`${
              isFirstStep ? "w-full" : "flex-[2]"
            } py-3 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-semibold text-[15px] cursor-pointer disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(232,160,191,0.35)] transition font-[family-name:var(--font-quicksand)]`}
          >
            {saving
              ? "Preparando seu espaço..."
              : isLastStep
                ? "Começar"
                : "Continuar"}
          </button>
        </div>
      </div>
    </main>
  );
}

function WelcomeStep({ name }: { name: string }) {
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-mapa-pink-light to-mapa-lavender-light flex items-center justify-center text-4xl border-[3px] border-white/70 shadow-[0_8px_30px_rgba(232,160,191,0.22)] mb-5">
        🌸
      </div>
      <h1 className="font-[family-name:var(--font-quicksand)] text-[24px] font-semibold text-mapa-text mb-3">
        Bem-vinda à Lis{name && ` ${name}`}
      </h1>
      <p className="font-[family-name:var(--font-playfair)] italic text-base text-mapa-pink-deep mb-5">
        Antes de qualquer coisa, respira.
      </p>
      <p className="text-[14px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)] max-w-xs mx-auto">
        Aqui você não precisa{" "}
        <span className="font-semibold text-mapa-pink-deep">
          dar conta de nada
        </span>
        . Esse é o seu espaço para se ouvir, sem julgamentos.
      </p>
    </div>
  );
}

function HowStep() {
  const items = [
    {
      emoji: "✏️",
      title: "Registre seus momentos",
      text: "Marque humor, sentimentos e o que rolou no dia. Em texto ou áudio.",
    },
    {
      emoji: "🌿",
      title: "Receba acolhimento",
      text: "A Lis te responde com carinho e contexto, baseada no que você compartilhou.",
    },
    {
      emoji: "📖",
      title: "Descubra seus padrões",
      text: "Com o tempo, você vê o que te move e o que te pesa.",
    },
  ];
  return (
    <div className="text-center w-full">
      <h2 className="font-[family-name:var(--font-quicksand)] text-[22px] font-semibold text-mapa-text mb-2">
        Como funciona
      </h2>
      <p className="font-[family-name:var(--font-playfair)] italic text-sm text-mapa-pink-deep mb-6">
        três passos, no seu ritmo
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="bg-mapa-card/80 backdrop-blur rounded-[18px] border border-mapa-border/60 p-4 text-left flex gap-3 items-start"
          >
            <span className="text-2xl mt-0.5 shrink-0">{item.emoji}</span>
            <div>
              <p className="text-[14px] font-semibold text-mapa-pink-deep mb-0.5 font-[family-name:var(--font-quicksand)]">
                {item.title}
              </p>
              <p className="text-[12px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)]">
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (g: string) => void;
}) {
  return (
    <div className="text-center w-full">
      <h2 className="font-[family-name:var(--font-quicksand)] text-[22px] font-semibold text-mapa-text mb-2">
        O que mais te toca hoje?
      </h2>
      <p className="font-[family-name:var(--font-playfair)] italic text-sm text-mapa-pink-deep mb-6">
        escolhe a que mais combina (dá para mudar depois)
      </p>
      <div className="space-y-2">
        {GOALS.map((g) => (
          <button
            key={g.key}
            onClick={() => onSelect(g.key)}
            className={`w-full px-4 py-3 rounded-2xl border-[1.5px] text-left flex items-center gap-3 cursor-pointer transition-all font-[family-name:var(--font-quicksand)] ${
              selected === g.key
                ? "bg-mapa-pink-light border-mapa-pink shadow-[0_2px_8px_rgba(232,160,191,0.2)]"
                : "bg-mapa-card border-mapa-border hover:border-mapa-pink"
            }`}
          >
            <span className="text-xl shrink-0">{g.emoji}</span>
            <span
              className={`text-[13px] font-medium ${
                selected === g.key ? "text-mapa-pink-deep" : "text-mapa-text"
              }`}
            >
              {g.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadyStep({ name, goal }: { name: string; goal: string }) {
  const goalObj = GOALS.find((g) => g.key === goal);
  return (
    <div className="text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-mapa-mint-light to-mapa-lavender-light flex items-center justify-center text-4xl border-[3px] border-white/70 shadow-[0_8px_30px_rgba(155,202,176,0.28)] mb-5">
        ✨
      </div>
      <h2 className="font-[family-name:var(--font-quicksand)] text-[22px] font-semibold text-mapa-text mb-2">
        Tudo pronto {name || "amiga"}
      </h2>
      <p className="font-[family-name:var(--font-playfair)] italic text-sm text-mapa-pink-deep mb-5">
        agora é só começar
      </p>
      <div className="bg-mapa-card/70 backdrop-blur rounded-[18px] border border-mapa-border/60 p-5 text-center">
        <p className="text-[13px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)]">
          Quando você registrar seu primeiro momento, eu vou te ouvir{" "}
          <span className="font-semibold text-mapa-pink-deep">
            {goalObj
              ? `pensando em ${goalObj.label.toLowerCase()}`
              : "com carinho"}
          </span>
          .
        </p>
      </div>
    </div>
  );
}
