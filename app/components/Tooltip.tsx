"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Tooltip contextual de "primeiro uso". Aparece UMA vez (controlado por chave
// no localStorage) num ponto especifico da tela. Usado em pontos de
// descoberta cirurgica — onde a feature nao e' obvia visualmente.
//
// Decisao 18/05: NAO espalhar tooltips em todo lugar. Apenas em fricoes reais
// de descoberta. Maioria das telas e' auto-explicativa pelas labels.

interface Props {
  storageKey: string; // chave localStorage unica, ex: "tooltip_audio_seen"
  text: string;
  // Posicao em relacao ao parent (parent precisa ter position: relative)
  position?: "bottom" | "top";
  // Onde a setinha aponta no eixo horizontal
  arrowAt?: "left" | "center" | "right";
  // Atraso pra aparecer (em ms)
  delay?: number;
  // Callback opcional ao dispensar
  onDismiss?: () => void;
}

export default function Tooltip({
  storageKey,
  text,
  position = "bottom",
  arrowAt = "left",
  delay = 700,
  onDismiss,
}: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(storageKey) === "true") return;
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [storageKey, delay]);

  function dismiss() {
    localStorage.setItem(storageKey, "true");
    setShow(false);
    onDismiss?.();
  }

  if (!show) return null;

  const positionClasses =
    position === "bottom"
      ? "top-full mt-2"
      : "bottom-full mb-2";
  const arrowHorizontal =
    arrowAt === "left" ? "left-6" : arrowAt === "right" ? "right-6" : "left-1/2 -translate-x-1/2";
  const arrowClasses =
    position === "bottom"
      ? `top-[-6px] ${arrowHorizontal} border-b-mapa-pink-deep border-l-transparent border-r-transparent border-t-0`
      : `bottom-[-6px] ${arrowHorizontal} border-t-mapa-pink-deep border-l-transparent border-r-transparent border-b-0`;

  return (
    <div
      className={`absolute left-0 right-0 ${positionClasses} z-30 animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      <div className="relative bg-mapa-pink-deep text-white rounded-2xl px-4 py-3 shadow-[0_8px_24px_rgba(142,58,107,0.35)] flex items-start gap-2">
        {/* setinha */}
        <div
          className={`absolute w-0 h-0 border-[6px] border-solid ${arrowClasses}`}
        />
        <p className="flex-1 text-[12.5px] leading-snug font-[family-name:var(--font-quicksand)]">
          {text}
        </p>
        <button
          onClick={dismiss}
          aria-label="Fechar dica"
          className="shrink-0 text-white/80 hover:text-white cursor-pointer bg-transparent border-none -mr-1 -mt-1 p-1"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
