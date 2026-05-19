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
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_done")
          .eq("id", user.id)
          .single();
        if (!profile?.onboarding_done) {
          window.location.href = "/onboarding";
          return;
        }
      }
      setAuthenticated(true);
    }
    check();
  }, []);

  if (!authenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-mapa-bg">
        <p className="text-mapa-muted italic">buscando seus momentos</p>
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
