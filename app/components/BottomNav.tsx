"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const TABS = [
  { href: "/registrar", label: "Registrar", emoji: "✏️" },
  { href: "/historico", label: "Histórico", emoji: "📖" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Não mostra nav na tela de login
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-mapa-card border-t border-mapa-border/50 flex justify-around py-2.5 pb-5 z-50">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || (tab.href === "/registrar" && pathname === "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 no-underline text-[11px] transition-all font-[family-name:var(--font-quicksand)] ${
              isActive
                ? "text-mapa-pink-deep font-semibold"
                : "text-mapa-muted font-normal"
            }`}
          >
            <span className="text-xl">{tab.emoji}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
