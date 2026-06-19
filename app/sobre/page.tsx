"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Heart,
  MessageCircle,
  BarChart3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
        <p className="text-mapa-muted italic">um instante</p>
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

        <div className="px-6 pt-2">
          <h1 className="font-[family-name:var(--font-quicksand)] text-[24px] font-semibold text-mapa-pink-deep">
            Sobre a Lis
          </h1>
          <p className="text-[13px] text-mapa-muted mt-1 font-[family-name:var(--font-playfair)] italic">
            o que tem por trás do seu diário
          </p>
        </div>

        <div className="px-5 pt-6 space-y-3.5">
          <Section
            icon={<Heart size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />}
            title="A filosofia anti-culpa"
            content="O Amiga de Bolso nasceu para ser um espaço diferente. Aqui você não precisa dar conta de nada. Sem streak, sem cobrança, sem 'você esqueceu hoje'. Cada momento que você registra é seu, no seu ritmo. Quando bate aquela culpa de não ter feito o suficiente, esse aplicativo te lembra: estar aqui já é o suficiente."
          />

          <Section
            icon={<MessageCircle size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />}
            title="Como a Lis pensa"
            content="A Lis conhece seu nome, seu objetivo (escolhido no onboarding), seus últimos 5 registros, e o humor + sentimentos + atividades do momento atual. Com isso ela responde de forma personalizada — nunca genérica. As respostas são curtas (no máximo 3 frases) e sempre acompanhadas de uma sugestão pequena, gentil e factível em 5 minutos. Ela nunca diagnostica nem prescreve, e nunca substitui terapia."
          />

          <Section
            icon={<BarChart3 size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />}
            title="Como ler seus caminhos"
            content="A aba Mapa tem 5 cards: Resumo (números rápidos), Humor por dia (gráfico de barras), Sentimentos mais presentes (top 5), Atividades mais frequentes (top 5) e O que percebi (padrões automáticos). Em cada um você encontra o ícone ⓘ — toque para ver a explicação detalhada daquele card específico."
          />

          <Section
            icon={<ShieldCheck size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />}
            title="Sua Privacidade Intocável (LGPD)"
            content="Tudo que você registra fica criptografado e salvo de forma segura. A inteligência artificial (Lis) NÃO treina e não aprende com os seus desabafos. Além disso, a Lis possui uma tecnologia de proteção (Data Masking) que oculta automaticamente números de CPF e telefones antes de qualquer processamento. Seus segredos estão seguros."
          />

          <Section
            icon={<Sparkles size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />}
            title="Por que a IA se chama Lis"
            content="Lis é o nome da inteligência artificial que te escuta aqui dentro. Nome curto, de gente — não era pra ser uma marca, era pra ser uma amiga atenta. Quando você registra um momento, é a Lis que te ouve. Quando ela responde, é a Lis que está aqui. A aba Mapa, com seus caminhos e ciclos, fica como metáfora — porque a ideia não é te dizer para onde ir, mas te ajudar a desenhar o seu próprio mapa emocional."
          />

          <div className="bg-mapa-pink-light/40 rounded-[22px] border-2 border-mapa-pink p-6 text-center shadow-[0_6px_24px_rgba(232,160,191,0.2)]">
            <p className="text-[15px] text-mapa-pink-deep italic font-[family-name:var(--font-playfair)] leading-relaxed">
              feito com carinho para quem cansa de dar conta de tudo sozinha
            </p>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function Section({
  icon,
  title,
  content,
}: {
  icon: ReactNode;
  title: string;
  content: string;
}) {
  return (
    <div className="bg-mapa-card rounded-[18px] border border-mapa-border/40 p-5 shadow-[0_4px_16px_rgba(196,122,155,0.10),0_1px_3px_rgba(60,30,50,0.05)]">
      <div className="flex items-center gap-2 mb-2">
        {icon}
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
