"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useNotifications } from "@/lib/hooks/useNotifications";

const DISMISS_KEY = "mapa_reminders_prompt_v1";

/**
 * Banner que aparece UMA vez para usuárias que:
 * - Tem reminders_enabled = true (default da migration)
 * - Não tem push token cadastrado (nunca clicou pra ativar OU permissão default)
 * - Não dispensou esse banner antes (localStorage flag)
 *
 * Se ela clicar "Ativar", chama enableReminders (pede permissão do navegador +
 * salva token FCM). Se clicar "Agora não", fecha e nunca mais aparece.
 */
export default function RemindersPrompt() {
  const { enableReminders, disableReminders, loading } = useNotifications();
  const [show, setShow] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (localStorage.getItem(DISMISS_KEY) === "true") return;
    if (Notification.permission !== "default") return;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Reminders_enabled deve estar true (default da migration). Se false, não importuna.
      const { data: profile } = await supabase
        .from("profiles")
        .select("reminders_enabled")
        .eq("id", user.id)
        .single();
      if (profile?.reminders_enabled === false) return;

      // Já tem token cadastrado? Se sim, não precisa do banner.
      const { count } = await supabase
        .from("user_push_tokens")
        .select("token", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((count ?? 0) > 0) return;

      setShow(true);
    })();
  }, []);

  // Quando dispensa o banner (Agora não / X), também marca no banco
  // reminders_enabled=false + reminders_disabled_at=now. Assim a decisão fica
  // registrada (não só local no navegador) e o disparo das 20h pula ela.
  async function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setShow(false);
    try {
      await disableReminders();
    } catch (e) {
      console.warn("Não consegui salvar a dispensa do banner:", e);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      await enableReminders();
      localStorage.setItem(DISMISS_KEY, "true");
      setShow(false);
    } finally {
      setActivating(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-[400px] px-4 z-40">
      <div className="bg-mapa-card border border-mapa-border rounded-2xl p-4 shadow-[0_8px_30px_rgba(60,30,50,0.15)] flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="w-9 h-9 rounded-full bg-mapa-pink-light flex items-center justify-center shrink-0">
          <Bell size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-mapa-text font-[family-name:var(--font-quicksand)] leading-snug">
            Posso te lembrar às 20h?
          </p>
          <p className="text-[11.5px] text-mapa-muted mt-1 leading-relaxed font-[family-name:var(--font-quicksand)]">
            Um oi rapidinho da Lis, sem cobrança. Pode mudar essa escolha depois na sua conta.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={handleActivate}
              disabled={activating || loading}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white text-[12px] font-semibold cursor-pointer disabled:opacity-60 font-[family-name:var(--font-quicksand)]"
            >
              {activating ? "Ativando..." : "Ativar"}
            </button>
            <button
              onClick={dismiss}
              disabled={activating}
              className="px-3 py-1.5 rounded-xl bg-transparent text-mapa-muted text-[12px] font-semibold cursor-pointer disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
            >
              Não quero
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          disabled={activating}
          className="text-mapa-muted hover:text-mapa-text cursor-pointer bg-transparent border-none p-1 -mt-1 -mr-1 disabled:opacity-50"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
