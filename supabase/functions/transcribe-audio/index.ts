import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo de áudio enviado." }), { status: 400 });
    }

    // 1. Transcrever áudio com Groq Whisper
    const groqFormData = new FormData();
    groqFormData.append("file", audioFile, "audio.webm");
    groqFormData.append("model", "whisper-large-v3-turbo");
    groqFormData.append("language", "pt");

    const transcriptionRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: groqFormData,
    });

    if (!transcriptionRes.ok) {
      const err = await transcriptionRes.text();
      throw new Error(`Groq error: ${err}`);
    }

    const { text: transcription } = await transcriptionRes.json();

    // 2. Analisar com a Lis (Claude)
    const analysisRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: `Você é a Lis, uma IA compassiva e acolhedora do app Mapa. A usuária acabou de gravar um áudio com seus pensamentos e sentimentos. O conteúdo transcrito foi:

"${transcription}"

Responda com uma reflexão curta (2-3 frases), empática e sem julgamentos. Não dê conselhos. Apenas acolha o que ela compartilhou, valide o sentimento e deixe-a saber que você está aqui. Use linguagem simples e calorosa.`,
          },
        ],
      }),
    });

    const analysisData = await analysisRes.json();
    const lisResponse = analysisData.content?.[0]?.text || "Obrigada por compartilhar isso comigo. 🌸";

    return new Response(
      JSON.stringify({ transcription, lisResponse }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
