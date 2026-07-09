import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// v2 (16/05/2026): removida a chamada redundante do Claude Haiku que gerava
// uma "lisResponse" nunca usada pelo MoodRegister. Agora a funcao so transcreve
// via Groq Whisper e devolve { transcription, duration_seconds }.
// O feedback real da Lis acontece no generate-mood-feedback, com Sonnet 4.5,
// RAG da memoria semantica e personalizacao por humor/tags/goal.

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Token ausente" }), { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Não autenticada" }), { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: "Nenhum arquivo de audio enviado." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Whisper-large-v3-turbo via Groq (free tier ate 7.200s de audio/dia).
    // Idioma fixo pt-BR pra evitar deteccao errada em audios curtos.
    // Pede verbose_json pra extrair a duracao do audio (em segundos) que a
    // Lis usa pra detectar "desabafo" (>60s) vs "registro rapido".
    const groqFormData = new FormData();
    groqFormData.append("file", audioFile, "audio.webm");
    groqFormData.append("model", "whisper-large-v3-turbo");
    groqFormData.append("language", "pt");
    groqFormData.append("response_format", "verbose_json");

    const transcriptionRes = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
        body: groqFormData,
      }
    );

    if (!transcriptionRes.ok) {
      const errBody = await transcriptionRes.text();
      console.error("Groq erro:", transcriptionRes.status, errBody);
      return new Response(
        JSON.stringify({ error: "Nao foi possivel transcrever o audio agora." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const data = await transcriptionRes.json();
    const transcription: string = (data.text || "").trim();
    const duration_seconds: number =
      typeof data.duration === "number" ? Math.round(data.duration) : 0;

    return new Response(
      JSON.stringify({ transcription, duration_seconds }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("transcribe-audio erro fatal:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro inesperado" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
