import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}");

// Enquanto o domínio amigadebolso.com.br não estiver verificado no Resend,
// os emails saem de onboarding@resend.dev (só entrega para alinealassar@gmail.com).
// Após verificar o domínio: adicione o secret EMAIL_FROM no Supabase
// (Project Settings → Edge Functions → Secrets):
//   EMAIL_FROM = Lis <oi@amigadebolso.com.br>
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Lis <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") || "https://amigadebolso.com.br";

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
            <h1>Como você está hoje?</h1>
            <p>Oi {{name}}, aqui é a Lis. Passei só para te dar um oi e perguntar como está o seu dia.</p>
            <p>Se quiser, vem dar uma passada aqui — em palavras, emojis ou áudio. Sem cobrança, no seu ritmo.</p>
            <p style="font-style: italic; color: #8E3A6B;">"Aqui você não precisa dar conta de nada."</p>
            <a href="${APP_URL}/registrar" class="button">Vem dar uma passada</a>
            <p style="margin-top: 40px; font-style: italic; color: #8E3A6B;">com carinho, Lis.</p>
        </div>
    </div>
</body>
</html>
`;

const PUSH_TITLE = "Oi, é a Lis";
function pushBody(name: string | null) {
  return `${name || "Você"}, passei pra te dar um oi. Como você está hoje?`;
}

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

  // Body opcional para casos de teste/debug
  let body: { only_user_id?: string; skip_email?: boolean; skip_push?: boolean } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch (_) { /* body opcional */ }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca usuárias com lembretes ativados (default true).
    // SEM filtro de 24h — manda diariamente para TODOS conforme decidido em 16/05/2026.
    let query = supabaseAdmin
      .from("profiles")
      .select("id, name, reminders_enabled")
      .or("reminders_enabled.is.null,reminders_enabled.eq.true");
    if (body.only_user_id) query = query.eq("id", body.only_user_id);

    const { data: profiles, error: profilesError } = await query;
    if (profilesError) {
      console.error("Erro ao buscar profiles:", profilesError);
      return new Response(JSON.stringify({ error: profilesError.message }), { status: 500 });
    }

    const targets = profiles || [];
    console.log(`[daily-reminder] targets=${targets.length}`);

    let fcmAccessToken = "";
    if (!body.skip_push && FIREBASE_SERVICE_ACCOUNT.project_id) {
      fcmAccessToken = await getAccessToken(FIREBASE_SERVICE_ACCOUNT);
    }

    let emails_sent = 0;
    let emails_failed = 0;
    let pushes_sent = 0;
    let pushes_failed = 0;

    for (const user of targets) {
      // --- EMAIL ---
      if (!body.skip_email) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
        const email = authUser.user?.email;
        if (email) {
          try {
            const html = EMAIL_TEMPLATE.replace("{{name}}", user.name || "amiga");
            const resp = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
              body: JSON.stringify({
                from: EMAIL_FROM,
                to: [email],
                subject: "Oi, é a Lis 🌸",
                html,
              }),
            });
            if (resp.ok) emails_sent++;
            else {
              emails_failed++;
              console.warn(`Email falhou para ${email}: ${resp.status} ${await resp.text()}`);
            }
          } catch (e: any) {
            emails_failed++;
            console.warn(`Email throw para ${user.id}:`, e.message);
          }
        }
      }

      // --- PUSH ---
      if (!body.skip_push && fcmAccessToken) {
        const { data: tokens } = await supabaseAdmin
          .from("user_push_tokens")
          .select("token")
          .eq("user_id", user.id);
        if (tokens && tokens.length > 0) {
          for (const { token } of tokens) {
            try {
              const resp = await fetch(
                `https://fcm.googleapis.com/v1/projects/${FIREBASE_SERVICE_ACCOUNT.project_id}/messages:send`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${fcmAccessToken}` },
                  body: JSON.stringify({
                    message: {
                      token,
                      notification: { title: PUSH_TITLE, body: pushBody(user.name) },
                      webpush: { fcm_options: { link: "${APP_URL}/registrar" } },
                    },
                  }),
                }
              );
              if (resp.ok) pushes_sent++;
              else {
                pushes_failed++;
                console.warn(`Push falhou para token ${token.slice(0,12)}...: ${resp.status}`);
              }
            } catch (e: any) {
              pushes_failed++;
              console.warn(`Push throw:`, e.message);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        targets: targets.length,
        emails_sent,
        emails_failed,
        pushes_sent,
        pushes_failed,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("daily-reminder erro fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
