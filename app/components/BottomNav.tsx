"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { PenLine, Map, BookOpen, User, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/registrar", label: "Diário", icon: PenLine },
  { href: "/mapa", label: "Mapa", icon: Map },
  { href: "/historico", label: "Momentos", icon: BookOpen },
  { href: "/eu", label: "Perfil", icon: User },
];

// Chave localStorage onde guardamos o week_start do ultimo resumo semanal
// que a usuaria viu. Se o resumo mais recente do banco for mais novo, mostra
// badge "novidade" na aba Mapa.
const LAST_SEEN_KEY = "lis_last_seen_weekly_summary";

export default function BottomNav() {
  const pathname = usePathname();
  const [hasNewWeekly, setHasNewWeekly] = useState(false);

  // Detecta se ha resumo semanal novo nao visto
  useEffect(() => {
    if (pathname === "/login") return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("weekly_summaries")
        .select("week_start")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(1);
      const latest = data?.[0]?.week_start;
      if (!latest) {
        setHasNewWeekly(false);
        return;
      }
      const lastSeen = typeof window !== "undefined"
        ? localStorage.getItem(LAST_SEEN_KEY)
        : null;
      setHasNewWeekly(latest !== lastSeen);
    })();
  }, [pathname]);

  // Quando a usuaria abre /mapa, marca o resumo mais recente como "visto"
  // (apaga o dot). Isso roda toda vez que entra em /mapa.
  useEffect(() => {
    if (pathname !== "/mapa") return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("weekly_summaries")
        .select("week_start")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(1);
      const latest = data?.[0]?.week_start;
      if (latest && typeof window !== "undefined") {
        localStorage.setItem(LAST_SEEN_KEY, latest);
        setHasNewWeekly(false);
      }
    })();
  }, [pathname]);

  // Não mostra nav na tela de login
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-mapa-card border-t border-mapa-border/50 flex justify-around py-2.5 pb-5 z-50">
      {TABS.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.href === "/registrar" && pathname === "/");
        const Icon = tab.icon;
        // Badge "novidade" so na aba Mapa quando ha resumo semanal nao visto
        const showBadge = tab.href === "/mapa" && hasNewWeekly && !isActive;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center gap-1 no-underline text-[11px] transition-all font-[family-name:var(--font-quicksand)] py-1.5 px-3.5 rounded-2xl ${
              isActive
                ? "text-white bg-mapa-pink font-semibold shadow-sm"
                : "text-mapa-muted font-normal hover:bg-mapa-pink-light/30"
            }`}
          >
            <div className="relative">
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
              {showBadge && (
                <span
                  aria-label="Resumo da semana novo"
                  className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-mapa-coral border-2 border-mapa-card animate-pulse"
                />
              )}
            </div>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
