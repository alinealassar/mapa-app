"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

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

export default function RedefinirSenhaPage() {
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // O Supabase coloca o token de recovery em hash da URL e cria sessão temporária.
    // Detecta o evento PASSWORD_RECOVERY e libera o form.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidSession(true);
        setReady(true);
      }
    });

    // Fallback: se já existe sessão (vindo direto do link), libera mesmo assim
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidSession(true);
      setReady(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validation = validatePassword(password);
    if (validation) {
      setError(validation);
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não estão iguais.");
      return;
    }

    setLoading(true);
    const { error: upError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (upError) {
      setError(
        "Não consegui trocar a senha. O link pode ter expirado — tenta pedir um novo."
      );
      return;
    }
    setDone(true);
  }

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-mapa-bg">
        <p className="text-mapa-muted italic">Carregando...</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-mapa-bg p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-mapa-pink-light to-mapa-lavender-light flex items-center justify-center text-5xl border-4 border-white/70 shadow-[0_10px_40px_rgba(232,160,191,0.25)] mb-5">
            🌸
          </div>
          <h1 className="text-[26px] font-semibold text-mapa-text mb-2 font-[family-name:var(--font-quicksand)]">
            Pronto!
          </h1>
          <p className="font-[family-name:var(--font-playfair)] italic text-sm text-mapa-pink-deep mb-6">
            sua senha foi atualizada
          </p>
          <a
            href="/login"
            className="inline-block w-full py-3.5 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-semibold text-[15px] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(232,160,191,0.35)] transition font-[family-name:var(--font-quicksand)] no-underline"
          >
            Entrar com a senha nova 🌷
          </a>
        </div>
      </main>
    );
  }

  if (!validSession) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-mapa-bg p-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-[22px] font-semibold text-mapa-text mb-3 font-[family-name:var(--font-quicksand)]">
            Link inválido ou expirado
          </h1>
          <p className="text-sm text-mapa-muted mb-6 font-[family-name:var(--font-quicksand)]">
            Esse link de recuperação não está mais ativo. Pede um novo na tela de login.
          </p>
          <a
            href="/recuperar-senha"
            className="inline-block w-full py-3.5 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-semibold text-[15px] cursor-pointer hover:-translate-y-0.5 transition font-[family-name:var(--font-quicksand)] no-underline"
          >
            Pedir novo link
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-mapa-bg p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-mapa-text text-center mb-2 font-[family-name:var(--font-quicksand)]">
          Senha nova
        </h1>
        <p className="text-sm text-mapa-pink-deep text-center mb-8 italic font-[family-name:var(--font-playfair)]">
          escolhe uma que você lembre depois
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-4 pr-12 py-3 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mapa-muted hover:text-mapa-pink-deep cursor-pointer transition-colors bg-transparent border-none"
              >
                {showPassword ? (
                  <EyeOff size={18} strokeWidth={1.75} />
                ) : (
                  <Eye size={18} strokeWidth={1.75} />
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-mapa-muted">
              8 a 12 caracteres, com maiúscula, minúscula, número e caractere especial (ex: @ # $ % &).
            </p>
          </div>

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirme a nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-medium hover:opacity-90 transition disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
          >
            {loading ? "Salvando..." : "Trocar senha"}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-center text-mapa-coral">{error}</p>
        )}
      </div>
    </main>
  );
}
