"use client";

import { useState } from "react";
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
  return null;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (isSignUp) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        setMessage(passwordError);
        setMessageType("error");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(error.message);
        setMessageType("error");
      } else {
        setMessage("Conta criada! Verifique seu e-mail para confirmar.");
        setMessageType("success");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage("E-mail ou senha incorretos.");
        setMessageType("error");
      } else {
        window.location.href = "/";
      }
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-mapa-bg p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-mapa-text text-center mb-2 font-[family-name:var(--font-playfair)]">
          Mapa
        </h1>
        <p className="text-sm text-mapa-pink-deep text-center mb-8 italic font-[family-name:var(--font-playfair)]">
          Antes de qualquer coisa, respira.
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
          <div>
            <input
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
            />
            {isSignUp && (
              <p className="mt-2 text-xs text-mapa-muted">
                8 a 12 caracteres, com maiúscula, minúscula e número.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-medium hover:opacity-90 transition disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
          >
            {loading ? "Aguarde..." : isSignUp ? "Criar conta" : "Entrar"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 text-sm text-center ${
              messageType === "error" ? "text-mapa-coral" : "text-mapa-mint"
            }`}
          >
            {message}
          </p>
        )}

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setMessage("");
          }}
          className="mt-6 w-full text-sm text-mapa-pink-deep hover:underline text-center bg-transparent border-none cursor-pointer"
        >
          {isSignUp ? "Já tem conta? Entrar" : "Primeira vez? Criar conta"}
        </button>
      </div>
    </main>
  );
}
