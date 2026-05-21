import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // HTML/dados — sempre revalidar com o servidor, pra um deploy novo
        // aparecer no refresh normal. NÃO afeta /_next/static (hash + cache longo).
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
