import type { Metadata } from "next";
import { Quicksand, Playfair_Display } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Mapa — Diário de Bem-Estar Emocional",
  description:
    "Registre seus sentimentos, ouça sua IA companheira e descubra padrões no seu bem-estar emocional.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${quicksand.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-mapa-bg font-[family-name:var(--font-quicksand)] text-mapa-text">
        {/* Gradientes SVG globais — usados por icones lucide via stroke="url(#mapa-grad-...)" */}
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <linearGradient id="mapa-grad-warm" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E8A0BF" />
              <stop offset="50%" stopColor="#B8A9D4" />
              <stop offset="100%" stopColor="#7BC8A4" />
            </linearGradient>
            <linearGradient id="mapa-grad-pink" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E8A0BF" />
              <stop offset="100%" stopColor="#B8A9D4" />
            </linearGradient>
          </defs>
        </svg>
        <div className="max-w-[420px] mx-auto w-full min-h-screen relative pb-[72px]">
          {children}
        </div>
      </body>
    </html>
  );
}
