import { createClient } from "@supabase/supabase-js";

// Fallback vazio permite o build estático do Netlify funcionar antes de as
// env vars estarem configuradas. Em produção (com as vars definidas no Netlify),
// os valores reais são embutidos no bundle pelo Next.js em tempo de build.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
);
