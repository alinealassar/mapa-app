// weekly-summary-reminder v1 (17/05/2026)
// Notifica usuarias que tem >=3 registros na semana fechada (dom-sab) que
// o resumo semanal esta disponivel. Dispara via GitHub Actions todo domingo
// as 10h BRT (13h UTC).
//
// Estrategia: NAO gera o resumo aqui (pra evitar duplicar a logica de
// generate-weekly-summary). Apenas notifica. Quando a usuaria clica no
// link, abre /mapa e o resumo e' gerado on-demand (~5-10s) e cacheado.
//
// Filtros:
// - reminders_enabled != false (respeita o toggle do /eu)
// - >= 3 registros na semana fechada (senao a IA nao gera resumo)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "{}");

// Após verificar amigadebolso.com.br no Resend, adicione o secret EMAIL_FROM
// no Supabase (Project Settings → Edge Functions → Secrets):
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
        body { margin: 0; padding: 0; background-color: #EFE9E4; font-family: sans-serif; color: #4A4A4A; }
        .container { max-width: 600px; margin: 40px auto; background: linear-gradient(165deg,#FFF8F1 0%,#FCEEDD 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 12px 30px rgba(60,30,50,0.12); border: 1px solid rgba(224, 212, 234, 0.5); }
        .top-strip { height: 8px; background: linear-gradient(90deg, #E8A0BF 0%, #B8A9D4 50%, #7BC8A4 100%); }
        .content { padding: 40px; text-align: left; }
        h1 { color: #8E3A6B; font-size: 26px; margin: 0 0 22px 0; font-style: italic; font-weight: 600; line-height: 1.2; }
        p { font-size: 15px; line-height: 1.7; margin-bottom: 16px; color: #4A3F3A; }
        .button-wrap { text-align: center; margin: 28px 0 16px 0; }
        .button { display: inline-block; padding: 14px 32px; background: #FFFFFF; color: #C47A9B; text-decoration: none; border-radius: 999px; font-weight: 600; border: 1.5px solid #C47A9B; box-shadow: 0 4px 12px rgba(196, 122, 155, 0.2); }
        .closing { text-align: right; font-style: italic; color: #8E3A6B; margin-top: 24px; }
        .footer { background: rgba(255,255,255,0.4); padding: 14px 24px; text-align: center; font-style: italic; font-size: 11px; color: #8B5C77; border-top: 1px dashed rgba(196,122,155,0.3); }
    </style>
</head>
<body>
    <div class="container">
        <div class="top-strip"></div>
        <div class="content">
            <h1>Fechou mais uma semana, {{name}}.</h1>
            <p>Acabei de te esperar pra abrir seu mapa juntas. Tem um resumo dos últimos 7 dias me esperando aqui dentro — os dias que pesaram, os que foram leves, e os caminhos que se desenharam sem você perceber.</p>
            <p>Vem dar uma passada quando quiser. Sem pressa.</p>
            <div class="button-wrap">
                <a href="${APP_URL}/mapa" class="button">Ver meu mapa da semana</a>
            </div>
            <p class="closing">com carinho,<br/><em>Lis</em></p>
        </div>
        <div class="footer">
            se preferir não receber esses recados, é só desativar os lembretes na sua conta
        </div>
    </div>
</body>
</html>
`;

const PUSH_TITLE = "Seu mapa da semana chegou";
function pushBody(name: string | null) {
  return `${name || "Você"}, te preparei o resumo dos últimos 7 dias. Vem ver.`;
}

// Calcula a ultima semana FECHADA dom-sab (UTC)
function computeLastWeek(now: Date): { weekStart: Date; weekEnd: Date } {
  const today = new Date(now);
  const day = today.getUTCDay();
  const currentSunday = new Date(today);
  currentSunday.setUTCDate(today.getUTCDate() - day);
  currentSunday.setUTCHours(0, 0, 0, 0);
  const weekStart = new Date(currentSunday);
  weekStart.setUTCDate(currentSunday.getUTCDate() - 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

// === FCM (copiado de daily-reminder) ===
// deno-lint-ignore no-explicit-any
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

  let body: { only_user_id?: string; skip_email?: boolean; skip_push?: boolean } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch (_) { /* body opcional */ }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { weekStart, weekEnd } = computeLastWeek(new Date());

    // 1. Pegar usuarias com lembretes ativados
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
    console.log(`[weekly-summary-reminder] targets=${targets.length} week=${weekStart.toISOString().slice(0, 10)}-${weekEnd.toISOString().slice(0, 10)}`);

    let fcmAccessToken = "";
    if (!body.skip_push && FIREBASE_SERVICE_ACCOUNT.project_id) {
      fcmAccessToken = await getAccessToken(FIREBASE_SERVICE_ACCOUNT);
    }

    let notified = 0;
    let skipped_few_entries = 0;
    let emails_sent = 0;
    let emails_failed = 0;
    let pushes_sent = 0;
    let pushes_failed = 0;

    for (const user of targets) {
      // Filtra usuarias com menos de 3 registros na semana fechada
      const { count } = await supabaseAdmin
        .from("mood_entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());
      if ((count || 0) < 3) {
        skipped_few_entries++;
        continue;
      }

      // EMAIL
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
                subject: "Seu mapa da semana chegou 🌸",
                html,
              }),
            });
            if (resp.ok) emails_sent++;
            else {
              emails_failed++;
              console.warn(`Email falhou para ${email}: ${resp.status}`);
            }
          } catch (e: any) {
            emails_failed++;
            console.warn(`Email throw:`, e.message);
          }
        }
      }

      // PUSH
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
                      webpush: { fcm_options: { link: "${APP_URL}/mapa" } },
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

      notified++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        targets: targets.length,
        notified,
        skipped_few_entries,
        emails_sent,
        emails_failed,
        pushes_sent,
        pushes_failed,
        week_start: weekStart.toISOString().slice(0, 10),
        week_end: weekEnd.toISOString().slice(0, 10),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("weekly-summary-reminder erro fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
