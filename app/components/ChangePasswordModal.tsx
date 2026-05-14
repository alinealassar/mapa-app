"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  email: string;
  onClose: () => void;
  onSuccess: () => void;
}

function validatePassword(password: string): string | null {
  if (password.length < 8)
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (password.length > 12)
    return "A senha pode ter no máximo 12 caracteres.";
  if (!/[a-z]/.test(password))
    return "A senha precisa ter pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(password))
    return "A senha precisa ter pelo menos uma letra maiúscula.";
  if (!/[0-9]/.test(password))
    return "A senha precisa ter pelo menos um número.";
  if (!/[^a-zA-Z0-9\s]/.test(password))
    return "A senha precisa ter pelo menos um caractere especial (ex: @ # $ % & * ! ?).";
  return null;
}

export default function ChangePasswordModal({ email, onClose, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validation = validatePassword(newPassword);
    if (validation) {
      setError(validation);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas novas não estão iguais.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("A senha nova precisa ser diferente da atual.");
      return;
    }

    setLoading(true);

    // 1. Reautenticar com senha atual (Supabase não tem endpoint próprio para isso)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      setLoading(false);
      setError("Senha atual incorreta.");
      return;
    }

    // 2. Atualizar para a senha nova
    const { error: upError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (upError) {
      setError("Não consegui trocar a senha agora. Tenta de novo daqui a pouco.");
      return;
    }

    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl relative animate-in fade-in zoom-in duration-300">
        <h2 className="text-[20px] font-semibold text-mapa-text mb-1 font-[family-name:var(--font-quicksand)] text-center">
          Trocar senha
        </h2>
        <p className="text-xs text-mapa-pink-deep italic text-center mb-5 font-[family-name:var(--font-playfair)]">
          escolhe uma que você lembre depois 🌸
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              placeholder="Senha atual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full pl-4 pr-11 py-2.5 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text text-sm placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mapa-muted bg-transparent border-none cursor-pointer"
              aria-label={showCurrent ? "Ocultar senha" : "Mostrar senha"}
            >
              {showCurrent ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              placeholder="Senha nova"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full pl-4 pr-11 py-2.5 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text text-sm placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mapa-muted bg-transparent border-none cursor-pointer"
              aria-label={showNew ? "Ocultar senha" : "Mostrar senha"}
            >
              {showNew ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
            </button>
          </div>

          <input
            type={showNew ? "text" : "password"}
            placeholder="Confirme a senha nova"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text text-sm placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
          />

          <p className="text-[11px] text-mapa-muted leading-relaxed">
            8 a 12 caracteres, com maiúscula, minúscula, número e caractere especial.
          </p>

          {error && (
            <p className="text-xs text-mapa-coral text-center">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border-[1.5px] border-mapa-border bg-transparent text-mapa-muted text-xs font-semibold cursor-pointer disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white text-xs font-semibold cursor-pointer disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
            >
              {loading ? "Salvando..." : "Trocar senha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
