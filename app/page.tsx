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
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_done")
        .eq("id", user.id)
        .single();
      if (!profile?.onboarding_done) {
        window.location.href = "/onboarding";
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
