"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/redefinir-senha`
        : undefined;

    const { error: rpError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    );

    setLoading(false);

    if (rpError) {
      setError(
        "Não consegui enviar agora. Confere se o e-mail está certo e tenta de novo."
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-mapa-bg p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-mapa-pink-light to-mapa-lavender-light flex items-center justify-center text-5xl border-4 border-white/70 shadow-[0_10px_40px_rgba(232,160,191,0.25)] mb-5">
            💌
          </div>
          <h1 className="text-[24px] font-semibold text-mapa-text mb-2 font-[family-name:var(--font-quicksand)]">
            Olha sua caixa de entrada
          </h1>
          <p className="font-[family-name:var(--font-playfair)] italic text-sm text-mapa-pink-deep mb-5">
            mandei um link para você criar uma senha nova
          </p>

          <div className="bg-mapa-card border border-mapa-border rounded-[18px] p-5 text-center mb-5">
            <p className="text-[13px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)] mb-3">
              Mandamos um link para:
            </p>
            <p className="text-[14px] font-semibold text-mapa-pink-deep break-all mb-3 font-[family-name:var(--font-quicksand)]">
              {email}
            </p>
            <p className="text-[12px] text-mapa-muted leading-relaxed font-[family-name:var(--font-quicksand)]">
              Abra sua caixa de entrada (e o spam, sempre o spam), clique no link e crie a senha nova.
            </p>
          </div>

          <a
            href="/login"
            className="inline-block w-full py-3.5 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-semibold text-[15px] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(232,160,191,0.35)] transition font-[family-name:var(--font-quicksand)] no-underline"
          >
            Voltar para o login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-mapa-bg p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-[24px] font-semibold text-mapa-text text-center mb-2 font-[family-name:var(--font-quicksand)]">
          Recuperar senha
        </h1>
        <p className="text-sm text-mapa-pink-deep text-center mb-8 italic font-[family-name:var(--font-playfair)]">
          sem stress, mando um link para você criar uma nova
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-medium hover:opacity-90 transition disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
          >
            {loading ? "Enviando..." : "Mandar link de recuperação"}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-center text-mapa-coral">{error}</p>
        )}

        <a
          href="/login"
          className="mt-6 block w-full text-sm text-mapa-pink-deep hover:underline text-center font-[family-name:var(--font-quicksand)]"
        >
          ← Voltar para o login
        </a>
      </div>
    </main>
  );
}
