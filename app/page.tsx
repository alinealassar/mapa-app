"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  useEffect(() => {
    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
      } else {
        window.location.href = "/registrar";
      }
    }
    checkUser();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-mapa-bg">
      <p className="text-mapa-muted italic">Carregando...</p>
    </main>
  );
}
