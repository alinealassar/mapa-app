"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { PenLine, Map, BookOpen, User, type LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/registrar", label: "Registrar", icon: PenLine },
  { href: "/mapa", label: "Mapa", icon: Map },
  { href: "/historico", label: "Histórico", icon: BookOpen },
  { href: "/eu", label: "Eu", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Não mostra nav na tela de login
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] bg-mapa-card border-t border-mapa-border/50 flex justify-around py-2.5 pb-5 z-50">
      {TABS.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.href === "/registrar" && pathname === "/");
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-1 no-underline text-[11px] transition-all font-[family-name:var(--font-quicksand)] py-1.5 px-3.5 rounded-2xl ${
              isActive
                ? "text-white bg-mapa-pink font-semibold shadow-sm"
                : "text-mapa-muted font-normal hover:bg-mapa-pink-light/30"
            }`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
