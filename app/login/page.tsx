"use client";

import { useState } from "react";
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
  // Caractere especial: qualquer um que NÃO seja letra (a-z, A-Z), número (0-9) ou espaço.
  // Cobre @ # $ % & * ( ) ! ? - _ + = . , ; : / \ | etc.
  if (!/[^a-zA-Z0-9\s]/.test(password))
    return "A senha precisa ter pelo menos um caractere especial (ex: @ # $ % & * ! ?).";
  return null;
}

export default function Login() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  // Tela de pós-cadastro (quando precisa confirmar email)
  const [signupComplete, setSignupComplete] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<
    "idle" | "loading" | "sent" | "error"
  >("idle");

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
      const trimmedName = name.trim();
      if (!trimmedName) {
        setMessage("Como você quer ser chamada?");
        setMessageType("error");
        setLoading(false);
        return;
      }

      // Sprint 4 polimento: nome coletado no signup vai pro user_metadata
      // (campo full_name) — fica disponível no email de confirmação
      // ({{ .Data.full_name }}) e o onboarding lê de lá pra pular a tela "qual seu nome?"
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: trimmedName },
        },
      });
      if (error) {
        setMessage(error.message);
        setMessageType("error");
      } else if (data.session) {
        // Confirmação de email desativada — usuária já tá logada, vai pro onboarding
        window.location.href = "/onboarding";
        return;
      } else {
        // Confirmação de email ativada — mostrar tela de "confirme seu email"
        setSignupEmail(email);
        setSignupComplete(true);
        setPassword("");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          // Em vez de mensagem solta, jogar para a tela de "confirme seu email"
          setSignupEmail(email);
          setSignupComplete(true);
          setPassword("");
        } else if (error.message.includes("Invalid login credentials")) {
          setMessage("E-mail ou senha incorretos.");
          setMessageType("error");
        } else {
          setMessage("Não consegui entrar agora. Tenta de novo daqui a pouco.");
          setMessageType("error");
        }
      } else {
        window.location.href = "/";
      }
    }

    setLoading(false);
  }

  async function handleResendEmail() {
    if (!signupEmail) return;
    setResendStatus("loading");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: signupEmail,
    });
    if (error) {
      setResendStatus("error");
    } else {
      setResendStatus("sent");
    }
  }

  function handleAlreadyConfirmed() {
    // Volta para a tela de login com o email pré-preenchido
    setSignupComplete(false);
    setIsSignUp(false);
    setEmail(signupEmail);
    setPassword("");
    setMessage("");
    setResendStatus("idle");
  }

  function handleChangeEmail() {
    // Volta para a tela de cadastro limpa
    setSignupComplete(false);
    setIsSignUp(true);
    setEmail("");
    setPassword("");
    setSignupEmail("");
    setMessage("");
    setResendStatus("idle");
  }

  // ===== TELA DE PÓS-CADASTRO (esperando confirmação) =====
  if (signupComplete) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-mapa-bg p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-mapa-pink-light to-mapa-lavender-light flex items-center justify-center text-5xl border-4 border-white/70 shadow-[0_10px_40px_rgba(232,160,191,0.25)] mb-5">
            💌
          </div>

          <h1 className="text-[24px] font-semibold text-mapa-text mb-2 font-[family-name:var(--font-quicksand)]">
            Quase lá!
          </h1>
          <p className="font-[family-name:var(--font-playfair)] italic text-sm text-mapa-pink-deep mb-5">
            só falta confirmar seu e-mail
          </p>

          <div className="bg-mapa-card border border-mapa-border rounded-[18px] p-5 text-center mb-5">
            <p className="text-[13px] text-mapa-text leading-relaxed font-[family-name:var(--font-quicksand)] mb-3">
              Mandamos um link para:
            </p>
            <p className="text-[14px] font-semibold text-mapa-pink-deep break-all mb-3 font-[family-name:var(--font-quicksand)]">
              {signupEmail}
            </p>
            <p className="text-[12px] text-mapa-muted leading-relaxed font-[family-name:var(--font-quicksand)]">
              Abra sua caixa de entrada (e o spam, sempre o spam), clique no link e volta aqui.
            </p>
          </div>

          <button
            onClick={handleAlreadyConfirmed}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-semibold text-[15px] cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(232,160,191,0.35)] transition mb-3 font-[family-name:var(--font-quicksand)]"
          >
            Já confirmei, entrar
          </button>

          <button
            onClick={handleResendEmail}
            disabled={resendStatus === "loading" || resendStatus === "sent"}
            className="w-full py-3 rounded-2xl border-[1.5px] border-mapa-border bg-transparent text-mapa-text font-semibold text-sm cursor-pointer disabled:opacity-50 hover:bg-mapa-pink-light/40 transition mb-4 font-[family-name:var(--font-quicksand)]"
          >
            {resendStatus === "loading" && "Enviando..."}
            {resendStatus === "sent" && "✓ E-mail reenviado"}
            {resendStatus === "error" && "Não consegui reenviar"}
            {resendStatus === "idle" && "Reenviar e-mail"}
          </button>

          {resendStatus === "error" && (
            <p className="text-xs text-mapa-coral mb-3">
              Tenta de novo em alguns minutos.
            </p>
          )}

          <button
            onClick={handleChangeEmail}
            className="py-2 px-3 text-sm text-mapa-pink-deep hover:underline bg-transparent border-none cursor-pointer font-[family-name:var(--font-quicksand)]"
          >
            Usei o e-mail errado, criar de novo
          </button>
        </div>
      </main>
    );
  }

  // ===== TELA NORMAL DE LOGIN/CADASTRO =====
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-mapa-bg p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-[24px] font-semibold text-mapa-text text-center mb-2 font-[family-name:var(--font-quicksand)]">
          Lis
        </h1>
        <p className="text-sm text-mapa-pink-deep text-center mb-8 italic font-[family-name:var(--font-playfair)]">
          Antes de qualquer coisa, respira.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <input
              type="text"
              placeholder="Como você quer ser chamada?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
              className="w-full px-4 py-3 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
            />
          )}
          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
          />
          <div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-4 pr-12 py-3 rounded-2xl border border-mapa-border bg-mapa-card text-mapa-text placeholder-mapa-muted focus:outline-none focus:ring-2 focus:ring-mapa-pink"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Ocultar senha" : "Mostrar senha"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mapa-muted hover:text-mapa-pink-deep cursor-pointer transition-colors bg-transparent border-none"
              >
                {showPassword ? (
                  <EyeOff size={18} strokeWidth={1.75} />
                ) : (
                  <Eye size={18} strokeWidth={1.75} />
                )}
              </button>
            </div>
            {isSignUp && (
              <div className="mt-2 text-[11px] text-mapa-muted leading-relaxed font-[family-name:var(--font-quicksand)]">
                <p>8 a 12 caracteres</p>
                <p>1 maiúscula · 1 minúscula · 1 número · 1 caractere especial</p>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gradient-to-br from-mapa-pink to-mapa-lavender text-white font-medium hover:opacity-90 transition disabled:opacity-50 font-[family-name:var(--font-quicksand)]"
          >
            {loading ? (isSignUp ? "Criando conta..." : "Entrando...") : isSignUp ? "Criar conta" : "Entrar"}
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

        {!isSignUp && (
          <div className="mt-3 text-center">
            <a
              href="/recuperar-senha"
              className="inline-block py-2 px-3 text-sm text-mapa-pink-deep hover:underline font-[family-name:var(--font-quicksand)]"
            >
              Esqueci minha senha
            </a>
          </div>
        )}

        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setMessage("");
            setEmail("");
            setPassword("");
            setName("");
          }}
          className="mt-4 w-full py-3 text-sm text-mapa-pink-deep hover:underline text-center bg-transparent border-none cursor-pointer"
        >
          {isSignUp ? "Já tem conta? Entrar" : "Primeira vez? Criar conta"}
        </button>
      </div>
    </main>
  );
}
