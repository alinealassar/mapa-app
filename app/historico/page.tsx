"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MoodHistory from "@/app/components/MoodHistory";
import BottomNav from "@/app/components/BottomNav";

export default function HistoricoPage() {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
      } else {
        setAuthenticated(true);
      }
    }
    check();
  }, []);

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-mapa-bg">
        <p className="text-mapa-muted italic">Carregando...</p>
      </main>
    );
  }

  return (
    <>
      <MoodHistory />
      <BottomNav />
    </>
  );
}
