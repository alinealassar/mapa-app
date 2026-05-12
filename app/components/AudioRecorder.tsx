"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AudioRecorderProps {
  onTranscription: (text: string, lisResponse: string) => void;
}

export default function AudioRecorder({ onTranscription }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("audio", blob, "audio.webm");

          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/transcribe-audio`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${session?.access_token}` },
              body: formData,
            }
          );

          if (!res.ok) throw new Error("Erro ao processar o áudio.");
          const { transcription, lisResponse } = await res.json();
          onTranscription(transcription, lisResponse);
        } catch (err: any) {
          setError("Não consegui processar o áudio. Tente novamente. 🌸");
        } finally {
          setProcessing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);

      // Vibração háptica ao iniciar
      if (navigator.vibrate) navigator.vibrate(50);
    } catch {
      setError("Não consegui acessar o microfone. Verifique as permissões. 🎙️");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={processing}
        className={`
          w-16 h-16 rounded-full flex items-center justify-center text-2xl
          transition-all duration-200 shadow-lg
          ${recording
            ? "bg-red-400 scale-110 shadow-red-200"
            : processing
            ? "bg-mapa-lavender-light opacity-60 cursor-wait"
            : "bg-mapa-pink hover:bg-mapa-pink-deep hover:scale-105"
          }
        `}
        aria-label={recording ? "Solte para enviar" : "Segure para gravar"}
      >
        {processing ? "⏳" : recording ? "⏹️" : "🎙️"}
      </button>

      <p className="text-[11px] text-mapa-muted font-[family-name:var(--font-quicksand)]">
        {processing
          ? "A Lis está ouvindo..."
          : recording
          ? "Gravando... solte para enviar"
          : "Segure para falar com a Lis"}
      </p>

      {error && (
        <p className="text-[11px] text-red-400 text-center px-4">{error}</p>
      )}
    </div>
  );
}
