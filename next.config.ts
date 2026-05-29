import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: gera pasta out/ com HTML/CSS/JS estáticos.
  // Compatível porque todas as páginas são "use client" + useEffect.
  // Headers de cache movidos para netlify.toml (headers() é ignorado em static export).
  output: "export",
};

export default nextConfig;
