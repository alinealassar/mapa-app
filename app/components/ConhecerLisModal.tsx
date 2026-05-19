"use client";

import { X } from "lucide-react";

// Modal de 3 dicas pra quem quiser revisitar "como o app funciona".
// Substituiu a rota /tutorial (que era duplicacao do HowStep do onboarding
// e bombardeava 7 telas pre-uso). Aqui fica como fallback elegante pra
// usuarias que querem revisar — sem ocupar rota inteira.

const DICAS = [
  {
    emoji: "✏️",
    title: "Registre seus momentos",
    text: "Marque humor, sentimentos, atividades. Em texto ou áudio. Sem cobrança — só o que fizer sentido.",
  },
  {
    emoji: "🌸",
    title: "A Lis te escuta",
    text: "Depois que você registra, eu te respondo com base no seu humor e no seu histórico. Como uma amiga atenta.",
  },
  {
    emoji: "🗺️",
    title: "Veja sua jornada",
    text: "Na aba Mapa, sua semana ganha um resumo. No Histórico, todos os momentos ficam guardados pra você revisitar.",
  },
];

interface Props {
  onClose: () => void;
}

export default function ConhecerLisModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-[24px] shadow-2xl relative animate-in fade-in zoom-in duration-300 overflow-hidden">
        {/* Top color strip pra reforçar identidade */}
        <div
          className="h-1.5 w-full"
          style={{
            background: "linear-gradient(90deg, #E8A0BF 0%, #B8A9D4 50%, #7BC8A4 100%)",
          }}
        />

        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-mapa-card hover:bg-mapa-pink-light flex items-center justify-center cursor-pointer border-none transition-colors"
        >
          <X size={16} strokeWidth={2} className="text-mapa-muted" />
        </button>

        <div className="px-6 pt-6 pb-5">
          <h2 className="text-[20px] font-semibold text-mapa-text font-[family-name:var(--font-quicksand)] text-center mb-1">
            Conhecer a Lis
          </h2>
          <p className="text-[12px] text-mapa-pink-deep italic font-[family-name:var(--font-playfair)] text-center mb-5">
            três coisas, no seu ritmo
          </p>

          <div className="space-y-3">
            {DICAS.map((d) => (
              <div
                key={d.title}
                className="bg-mapa-pink-light/40 rounded-[18px] border border-mapa-border/60 p-3.5 text-left flex gap-3 items-start"
              >
                <span className="text-2xl mt-0.5 shrink-0">{d.emoji}</span>
                <div>
                  <p className="text-[13px] font-semibold text-mapa-pink-deep mb-0.5 font-[family-name:var(--font-quicksand)]">
                    {d.title}
                  </p>
                  <p className="text-[12px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)]">
                    {d.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full mt-5 py-3 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-semibold text-sm cursor-pointer font-[family-name:var(--font-quicksand)] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(232,160,191,0.35)] transition"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
