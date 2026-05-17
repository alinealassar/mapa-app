"use client";

import { useEffect, useState } from "react";
import { Pencil, Bell, BellOff, Lock, Heart, LogOut, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/components/BottomNav";
import ChangePasswordModal from "@/app/components/ChangePasswordModal";
import { useNotifications } from "@/lib/hooks/useNotifications";

export default function EuPage() {
  const {
    permission,
    loading: notifLoading,
    enabled: remindersEnabled,
    toggleReminders,
  } = useNotifications();
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  // Editar nome
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Alterar senha
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordSavedToast, setPasswordSavedToast] = useState(false);

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
      if (user) {
        setUserId(user.id);
        setEmail(user.email || "");
        const { data } = await supabase
          .from("profiles")
          .select("name, onboarding_done")
          .eq("id", user.id)
          .single();
        if (!data?.onboarding_done) {
          window.location.href = "/onboarding";
          return;
        }
        if (data?.name) {
          setName(data.name);
        } else if (user.email) {
          const fromEmail = user.email.split("@")[0];
          setName(fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1));
        }
      }
      setAuthenticated(true);
    }
    check();
  }, []);

  async function handleSignOut() {
    const ok = window.confirm("Tem certeza que quer sair da sua conta? 🌸");
    if (!ok) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function startEditingName() {
    setDraftName(name);
    setEditingName(true);
  }

  function cancelEditingName() {
    setEditingName(false);
    setDraftName("");
  }

  async function saveName() {
    const trimmed = draftName.trim();
    if (!trimmed) {
      alert("Coloca um nome 🌸");
      return;
    }
    if (trimmed.length > 40) {
      alert("Nome muito longo (máximo 40 caracteres).");
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, name: trimmed });
    setSavingName(false);
    if (error) {
      alert(
        "Não consegui salvar agora. Tenta de novo daqui a pouco.\n\nDetalhe: " +
          error.message
      );
      return;
    }
    setName(trimmed);
    setEditingName(false);
  }

  function handlePasswordSuccess() {
    setShowPasswordModal(false);
    setPasswordSavedToast(true);
    setTimeout(() => setPasswordSavedToast(false), 3500);
  }

  // Estado visual do toggle de lembretes:
  // - "blocked": navegador negou permissão (não dá para reverter daqui, precisa do cadeado do navegador)
  // - "on": flag profiles.reminders_enabled=true
  // - "off": flag false (ou null)
  const remindersBlocked = permission === "denied";
  const remindersOn = remindersEnabled === true && !remindersBlocked;

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
        <div className="px-6 pt-6 text-center">
          <h1 className="font-[family-name:var(--font-quicksand)] text-[22px] font-medium text-mapa-text">
            Minha conta
          </h1>
          <p className="text-[13px] text-mapa-pink-deep mt-1 font-[family-name:var(--font-playfair)] italic">
            um espaço só seu 🌸
          </p>
        </div>

        <div className="px-6 pt-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-mapa-pink-light to-mapa-lavender-light flex items-center justify-center text-4xl border-[3px] border-mapa-pink-light mb-3">
            🌸
          </div>
          <p className="font-[family-name:var(--font-quicksand)] text-[20px] font-semibold text-mapa-text">
            {name || "..."}
          </p>
          <p className="text-xs text-mapa-muted mb-6 break-all font-[family-name:var(--font-quicksand)]">
            {email}
          </p>
        </div>

        <div className="px-5">
          <div className="bg-mapa-card border border-mapa-border rounded-[18px] overflow-hidden mb-3.5">
            {/* EDITAR NOME */}
            {editingName ? (
              <div className="px-4 py-3.5 border-b border-mapa-border/60 bg-mapa-pink-light/30">
                <p className="text-[11px] font-semibold text-mapa-pink-deep uppercase tracking-wide mb-2">
                  Como você quer ser chamada?
                </p>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") cancelEditingName();
                  }}
                  placeholder="Seu nome"
                  maxLength={40}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl border border-mapa-border bg-mapa-card text-mapa-text text-[14px] focus:outline-none focus:ring-2 focus:ring-mapa-pink mb-2.5 font-[family-name:var(--font-quicksand)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={cancelEditingName}
                    disabled={savingName}
                    className="flex-1 py-2 rounded-xl border-[1.5px] border-mapa-border bg-transparent text-mapa-muted text-xs font-semibold cursor-pointer disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveName}
                    disabled={savingName}
                    className="flex-1 py-2 rounded-xl bg-mapa-pink text-white text-xs font-semibold cursor-pointer disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
                  >
                    {savingName ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={startEditingName}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-mapa-border/60 bg-transparent cursor-pointer text-left text-[13px] font-medium text-mapa-text font-[family-name:var(--font-quicksand)] hover:bg-mapa-pink-light/40 transition"
              >
                <Pencil size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />
                <span className="flex-1">Editar meu nome</span>
                <span className="text-mapa-muted text-base">›</span>
              </button>
            )}

            {/* LEMBRETES — toggle real */}
            <div className="px-4 py-3.5 border-b border-mapa-border/60">
              <div className="flex items-center gap-3">
                {remindersOn ? (
                  <Bell size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />
                ) : (
                  <BellOff size={18} strokeWidth={1.75} className="text-mapa-muted" />
                )}
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-mapa-text font-[family-name:var(--font-quicksand)]">
                    Lembretes diários
                  </p>
                  <p className="text-[11px] text-mapa-muted mt-0.5 font-[family-name:var(--font-quicksand)]">
                    {remindersBlocked
                      ? "Bloqueado no navegador — abra o cadeado 🔒 ao lado do endereço para liberar"
                      : remindersOn
                      ? "Você recebe um carinho da Lis às 20h"
                      : "Ative para receber um lembrete gentil às 20h"}
                  </p>
                </div>
                {/* Switch */}
                <button
                  onClick={toggleReminders}
                  disabled={notifLoading || remindersBlocked || remindersEnabled === null}
                  aria-label={remindersOn ? "Desativar lembretes" : "Ativar lembretes"}
                  aria-pressed={remindersOn}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none flex-shrink-0 ${
                    remindersOn
                      ? "bg-gradient-to-br from-mapa-pink to-mapa-lavender"
                      : "bg-mapa-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      remindersOn ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* ALTERAR SENHA */}
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-mapa-border/60 bg-transparent cursor-pointer text-left text-[13px] font-medium text-mapa-text font-[family-name:var(--font-quicksand)] hover:bg-mapa-pink-light/40 transition"
            >
              <Lock size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />
              <span className="flex-1">Alterar senha</span>
              <span className="text-mapa-muted text-base">›</span>
            </button>

            {/* TUTORIAL */}
            <button
              onClick={() => (window.location.href = "/tutorial")}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-mapa-border/60 bg-transparent cursor-pointer text-left text-[13px] font-medium text-mapa-text font-[family-name:var(--font-quicksand)] hover:bg-mapa-pink-light/40 transition"
            >
              <Sparkles size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />
              <span className="flex-1">Ver tutorial</span>
              <span className="text-mapa-muted text-base">›</span>
            </button>

            {/* SOBRE */}
            <button
              onClick={() => (window.location.href = "/sobre")}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent cursor-pointer text-left text-[13px] font-medium text-mapa-text font-[family-name:var(--font-quicksand)] hover:bg-mapa-pink-light/40 transition"
            >
              <Heart size={18} strokeWidth={1.75} className="text-mapa-pink-deep" />
              <span className="flex-1">Sobre o Mapa</span>
              <span className="text-mapa-muted text-base">›</span>
            </button>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full py-3.5 rounded-[18px] border-[1.5px] border-mapa-coral bg-transparent text-mapa-coral font-semibold text-sm cursor-pointer disabled:opacity-50 transition font-[family-name:var(--font-quicksand)] flex items-center justify-center gap-2"
          >
            <LogOut size={16} strokeWidth={1.75} />
            {signingOut ? "Saindo..." : "Sair da minha conta"}
          </button>
        </div>

        {passwordSavedToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-mapa-mint text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg z-50 font-[family-name:var(--font-quicksand)]">
            Senha atualizada 🌸
          </div>
        )}
      </main>

      {showPasswordModal && (
        <ChangePasswordModal
          email={email}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={handlePasswordSuccess}
        />
      )}

      <BottomNav />
    </>
  );
}
