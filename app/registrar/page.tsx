"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MoodRegister from "@/app/components/MoodRegister";
import BottomNav from "@/app/components/BottomNav";

export default function RegistrarPage() {
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
      <MoodRegister />
      <BottomNav />
    </>
  );
}
