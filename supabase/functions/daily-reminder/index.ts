import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}");

// Template de E-mail (Lis Persona)
const EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; background-color: #FFF8F1; font-family: sans-serif; color: #4A4A4A; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(142, 58, 107, 0.08); border: 1px solid rgba(224, 212, 234, 0.5); }
        .top-strip { height: 8px; background: linear-gradient(90deg, #FFD0DA 0%, #E8DDF5 50%, #D8F3DC 100%); }
        .content { padding: 40px; text-align: center; }
        h1 { color: #8E3A6B; font-size: 24px; margin-bottom: 24px; }
        p { font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #5A5A5A; }
        .button { display: inline-block; padding: 16px 32px; background-color: #8E3A6B; color: #ffffff !important; text-decoration: none; border-radius: 100px; font-weight: 600; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="top-strip"></div>
        <div class="content">
            <h1>Que bom te ver por aqui.</h1>
            <p>Oi {{name}}, como você está se sentindo agora?</p>
            <p>Notei que hoje o seu mapa ficou um pouco em silêncio. Passo por aqui apenas para te lembrar que este espaço é seu.</p>
            <p style="font-style: italic; color: #8E3A6B;">"Aqui você não precisa dar conta de nada."</p>
            <a href="https://mapa-app-q3rh.onrender.com/registrar" class="button">Abrir meu Mapa 🗺️</a>
            <p style="margin-top: 40px; font-style: italic; color: #8E3A6B;">com carinho, Lis.</p>
        </div>
    </div>
</body>
</html>
`;

// Helper para gerar token de acesso do Google para o FCM
async function getAccessToken(serviceAccount: any) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedClaim = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const signInput = `${encodedHeader}.${encodedClaim}`;

  const privateKey = serviceAccount.private_key.replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    str2ab(atob(privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, ""))),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signInput)
  );
  const encodedSignature = Buffer.from(signature).toString("base64url");

  const jwt = `${signInput}.${encodedSignature}`;

  const res = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  return data.access_token;
}

function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Buscar usuárias inativas (sem registro em 24h)
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, name");
    const { data: recentEntries } = await supabaseAdmin.from("mood_entries").select("user_id").gt("created_at", yesterday);
    
    const activeUserIds = new Set(recentEntries?.map((e) => e.user_id) || []);
    const inactiveUsers = profiles?.filter((p) => !activeUserIds.has(p.id)) || [];

    // 2. Preparar Firebase Access Token
    let fcmAccessToken = "";
    if (FIREBASE_SERVICE_ACCOUNT.project_id) {
      fcmAccessToken = await getAccessToken(FIREBASE_SERVICE_ACCOUNT);
    }

    const results = [];

    for (const user of inactiveUsers) {
      // --- ENVIO DE E-MAIL ---
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
      if (authUser.user?.email) {
        const html = EMAIL_TEMPLATE.replace("{{name}}", user.name || "Aline");
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: "Lis do Mapa <oi@mapaapp.com.br>",
            to: [authUser.user.email],
            subject: "Passando para te dar um oi 🌸",
            html
          }),
        });
      }

      // --- ENVIO DE PUSH ---
      if (fcmAccessToken) {
        const { data: tokens } = await supabaseAdmin.from("user_push_tokens").select("token").eq("user_id", user.id);
        if (tokens && tokens.length > 0) {
          for (const { token } of tokens) {
            await fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_SERVICE_ACCOUNT.project_id}/messages:send`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcmAccessToken}` },
              body: JSON.stringify({
                message: {
                  token,
                  notification: {
                    title: "Passando para te dar um oi 🌸",
                    body: `${user.name || "Aline"}, notei que o seu mapa ficou em silêncio hoje. Estou aqui para te ouvir.`
                  },
                  webpush: {
                    fcm_options: { link: "https://mapa-app-q3rh.onrender.com/registrar" }
                  }
                }
              }),
            });
          }
        }
      }
      results.push(user.id);
    }

    return new Response(JSON.stringify({ success: true, notified: results.length }), { status: 200 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
