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
  title: "Amiga de Bolso — Diário de Bem-Estar Emocional com IA",
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
        <div className="max-w-[420px] mx-auto w-full min-h-[100dvh] relative pb-[72px]">
          {children}
        </div>
      </body>
    </html>
  );
}
