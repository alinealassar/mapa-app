"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/components/BottomNav";

export default function SobrePage() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      setAuthenticated(true);
    }
    check();
  }, []);

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-mapa-bg">
        <p className="text-mapa-muted italic">Carregando...</p>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-mapa-bg pb-24">
        {/* Header com voltar */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <button
            onClick={() => (window.location.href = "/eu")}
            className="text-mapa-pink-deep text-2xl leading-none cursor-pointer bg-transparent border-none p-1"
            aria-label="Voltar"
          >
            ‹
          </button>
          <p className="text-[13px] text-mapa-muted font-[family-name:var(--font-quicksand)]">
            Voltar
          </p>
        </div>

        <div className="px-6 pt-2 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-mapa-pink-light to-mapa-lavender-light flex items-center justify-center text-4xl border-[3px] border-white/70 shadow-[0_8px_30px_rgba(232,160,191,0.2)] mb-3">
            🌸
          </div>
          <h1 className="font-[family-name:var(--font-quicksand)] text-[24px] font-semibold text-mapa-text">
            Sobre o Mapa
          </h1>
          <p className="text-[13px] text-mapa-pink-deep mt-1 font-[family-name:var(--font-playfair)] italic">
            o que tem por trás do seu diário
          </p>
        </div>

        <div className="px-5 pt-6 space-y-3.5">
          <Section
            emoji="💖"
            title="A filosofia anti-culpa"
            content="O Mapa nasceu para ser um espaço diferente. Aqui você não precisa dar conta de nada. Sem streak, sem cobrança, sem 'você esqueceu hoje'. Cada momento que você registra é seu, no seu ritmo. Quando bate aquela culpa de não ter feito o suficiente, esse aplicativo te lembra: estar aqui já é o suficiente."
          />

          <Section
            emoji="🌿"
            title="Como a Lis pensa"
            content="A Lis (a IA do Mapa) conhece seu nome, seu objetivo (escolhido no onboarding), seus últimos 5 registros, e o humor + sentimentos + atividades do momento atual. Com isso ela responde de forma personalizada — nunca genérica. As respostas são curtas (no máximo 3 frases) e sempre acompanhadas de uma sugestão pequena, gentil e factível em 5 minutos. Ela nunca diagnostica nem prescreve, e nunca substitui terapia."
          />

          <Section
            emoji="📊"
            title="Como ler seus caminhos"
            content="A aba Mapa tem 5 cards: Resumo (números rápidos), Humor por dia (gráfico de barras), Sentimentos mais presentes (top 5), Atividades mais frequentes (top 5) e O que percebi (padrões automáticos). Em cada um você encontra o ícone ⓘ — toque para ver a explicação detalhada daquele card específico."
          />

          <Section
            emoji="🔒"
            title="Sua Privacidade Intocável (LGPD)"
            content="Tudo que você registra fica criptografado e salvo de forma segura. A inteligência artificial (Lis) NÃO treina e não aprende com os seus desabafos. Além disso, o Mapa possui uma tecnologia de proteção (Data Masking) que oculta automaticamente números de CPF e telefones antes de qualquer processamento. Seus segredos estão seguros."
          />

          <Section
            emoji="🌷"
            title="Por que se chama Mapa"
            content="Porque a ideia não é te dizer para onde ir, mas te ajudar a desenhar o seu próprio mapa emocional. Os caminhos, os ciclos, os lugares onde você mais passa. O resto, você decide."
          />

          <div className="bg-mapa-pink-light/40 rounded-[22px] border-2 border-mapa-pink p-6 text-center shadow-[0_6px_24px_rgba(232,160,191,0.2)]">
            <p className="text-[15px] text-mapa-pink-deep italic font-[family-name:var(--font-playfair)] leading-relaxed">
              feito com carinho para quem cansa de dar conta de tudo
            </p>
            <p className="text-[10px] text-mapa-muted mt-2.5">
              versão de desenvolvimento
            </p>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function Section({
  emoji,
  title,
  content,
}: {
  emoji: string;
  title: string;
  content: string;
}) {
  return (
    <div className="bg-mapa-card rounded-[18px] border border-mapa-border p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <p className="text-[14px] font-semibold text-mapa-pink-deep font-[family-name:var(--font-quicksand)]">
          {title}
        </p>
      </div>
      <p className="text-[13px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)]">
        {content}
      </p>
    </div>
  );
}
