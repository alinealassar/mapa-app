"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/components/BottomNav";

export default function EuPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  // Editar nome
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email || "");
        const { data } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        if (data?.name) {
          setName(data.name);
        } else if (user.email) {
          // Fallback: parte do email antes do @, capitalizada
          const fromEmail = user.email.split("@")[0];
          setName(fromEmail.charAt(0).toUpperCase() + fromEmail.slice(1));
        }
      }
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

  function emBreve() {
    alert("Em breve! 🌸 Estou preparando essa parte com carinho.");
  }

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
          <p className="font-[family-name:var(--font-playfair)] text-[22px] text-mapa-pink-deep">
            {name || "..."}
          </p>
          <p className="text-xs text-mapa-muted mb-6 break-all">{email}</p>
        </div>

        <div className="px-5">
          <div className="bg-mapa-card border border-mapa-border rounded-[18px] overflow-hidden mb-3.5">
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
                    {savingName ? "Salvando..." : "Salvar 🌸"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={startEditingName}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-mapa-border/60 bg-transparent cursor-pointer text-left text-[13px] font-medium text-mapa-text font-[family-name:var(--font-quicksand)] hover:bg-mapa-pink-light/40 transition"
              >
                <span className="text-lg">✏️</span>
                <span className="flex-1">Editar meu nome</span>
                <span className="text-mapa-muted text-base">›</span>
              </button>
            )}
            <button
              onClick={emBreve}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-mapa-border/60 bg-transparent cursor-pointer text-left text-[13px] font-medium text-mapa-text font-[family-name:var(--font-quicksand)] hover:bg-mapa-pink-light/40 transition"
            >
              <span className="text-lg">🔔</span>
              <span className="flex-1">Lembretes</span>
              <span className="text-mapa-muted text-base">›</span>
            </button>
            <button
              onClick={emBreve}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-transparent cursor-pointer text-left text-[13px] font-medium text-mapa-text font-[family-name:var(--font-quicksand)] hover:bg-mapa-pink-light/40 transition"
            >
              <span className="text-lg">💖</span>
              <span className="flex-1">Sobre o Mapa</span>
              <span className="text-mapa-muted text-base">›</span>
            </button>
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full py-3.5 rounded-[18px] border-[1.5px] border-mapa-coral bg-transparent text-mapa-coral font-semibold text-sm cursor-pointer disabled:opacity-50 transition font-[family-name:var(--font-quicksand)]"
          >
            {signingOut ? "Saindo..." : "↗ Sair da minha conta"}
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
