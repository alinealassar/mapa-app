import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://amigadebolso.com.br";

// Após verificar amigadebolso.com.br no Resend, adicione o secret EMAIL_FROM:
//   EMAIL_FROM = Lis <oi@amigadebolso.com.br>
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "Lis <onboarding@resend.dev>";

// ─── TEMPLATES ──────────────────────────────────────────────────────────────

const TEMPLATES: Record<number, { subject: string; html: (name: string, appUrl: string) => string }> = {

  // ── D0: Bem-vinda ─────────────────────────────────────────────────────────
  0: {
    subject: "tá aqui o seu colo. 🤍",
    html: (name, appUrl) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin:0; padding:0; background:#FFF8F1; font-family:'Helvetica Neue',Arial,sans-serif; color:#4A4458; }
    .wrap { max-width:600px; margin:40px auto; background:#fff; border-radius:24px; overflow:hidden; box-shadow:0 10px 30px rgba(142,58,107,0.08); border:1px solid rgba(184,169,212,0.3); }
    .strip { height:8px; background:linear-gradient(90deg,#E8A0BF 0%,#B8A9D4 55%,#5BA67D 100%); }
    .body { padding:48px 40px; text-align:center; }
    h1 { font-size:26px; font-weight:700; color:#8E3A6B; margin:0 0 8px; line-height:1.3; }
    .sub { font-style:italic; font-size:16px; color:#8B8398; margin:0 0 32px; }
    p { font-size:16px; line-height:1.7; color:#4A4458; margin:0 0 20px; }
    .pillars { list-style:none; padding:0; margin:28px auto; max-width:360px; text-align:left; display:flex; flex-direction:column; gap:12px; }
    .pillars li { font-size:15px; color:#4A4458; line-height:1.5; }
    .btn { display:inline-block; margin:32px 0 8px; padding:16px 40px; background:linear-gradient(135deg,#E8A0BF,#D98AAE); color:#fff !important; text-decoration:none; border-radius:50px; font-size:15px; font-weight:700; box-shadow:0 8px 24px rgba(232,160,191,0.4); }
    .btn-note { font-size:12px; color:#8B8398; margin-top:8px; }
    .sign { font-style:italic; font-size:15px; color:#8E3A6B; margin-top:40px; }
    .footer { background:#FAFAFA; padding:24px 32px; text-align:center; font-size:12px; color:#9CA3AF; border-top:1px solid #F3F4F6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="strip"></div>
    <div class="body">
      <h1>Que bom que você chegou. 🤍</h1>
      <p class="sub">Eu sou a Lis — e esse espaço é seu.</p>

      <p>Oi ${name},</p>

      <p>Aqui você não precisa chegar bem. Não precisa fazer sentido. Não precisa ter vocabulário pra nomear o que está sentindo.</p>

      <p>Você só precisa aparecer — com humor, uma palavra, um áudio de 30 segundos. A Lis faz o resto.</p>

      <ul class="pillars">
        <li>🤍 <strong>Te escuta</strong> — em texto ou áudio, a qualquer hora, sem pressa</li>
        <li>🌿 <strong>Lembra de você</strong> — não começa do zero toda vez</li>
        <li>🤲 <strong>Te dá a mão</strong> — um próximo passinho pequeno, sem "você devia"</li>
        <li>✨ <strong>Sem cobrança</strong> — sem streak, sem "você falhou hoje"</li>
      </ul>

      <a href="${appUrl}/registrar" class="btn">Conhecer a Lis agora →</a>
      <p class="btn-note">Grátis pra começar · 14 dias com tudo</p>

      <p class="sign">com carinho, Lis.</p>
    </div>
    <div class="footer">
      Amiga de Bolso · Diário emocional com IA<br />
      <span style="font-size:11px;margin-top:6px;display:block;">
        Seus dados são seus. A Lis não treina IA com o que você compartilha.
      </span>
    </div>
  </div>
</body>
</html>`,
  },

  // ── D1: Uma coisa. pode ser um emoji. ────────────────────────────────────
  1: {
    subject: "uma coisa. pode ser um emoji. 🌸",
    html: (name, appUrl) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin:0; padding:0; background:#FFF8F1; font-family:'Helvetica Neue',Arial,sans-serif; color:#4A4458; }
    .wrap { max-width:600px; margin:40px auto; background:#fff; border-radius:24px; overflow:hidden; box-shadow:0 10px 30px rgba(142,58,107,0.08); border:1px solid rgba(184,169,212,0.3); }
    .strip { height:8px; background:linear-gradient(90deg,#E8A0BF 0%,#B8A9D4 55%,#5BA67D 100%); }
    .body { padding:48px 40px; text-align:center; }
    h1 { font-size:26px; font-weight:700; color:#8E3A6B; margin:0 0 32px; line-height:1.3; }
    p { font-size:16px; line-height:1.7; color:#4A4458; margin:0 0 20px; }
    .highlight { font-size:18px; font-style:italic; color:#8E3A6B; background:#FFF0F6; border-radius:16px; padding:20px 28px; margin:28px 0; line-height:1.6; }
    .btn { display:inline-block; margin:32px 0 8px; padding:16px 40px; background:linear-gradient(135deg,#E8A0BF,#D98AAE); color:#fff !important; text-decoration:none; border-radius:50px; font-size:15px; font-weight:700; box-shadow:0 8px 24px rgba(232,160,191,0.4); }
    .sign { font-style:italic; font-size:15px; color:#8E3A6B; margin-top:40px; }
    .footer { background:#FAFAFA; padding:24px 32px; text-align:center; font-size:12px; color:#9CA3AF; border-top:1px solid #F3F4F6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="strip"></div>
    <div class="body">
      <h1>Oi, ${name}. 🌸</h1>

      <p>Só queria dar um oi e te lembrar de uma coisa:</p>

      <div class="highlight">
        Não precisa de muito.<br />Um emoji já conta.
      </div>

      <p>A Lis entende "😮‍💨" tão bem quanto um parágrafo inteiro. Você não precisa saber o que está sentindo — ela te ajuda a descobrir.</p>

      <p>Pode ser literalmente uma palavra. Pode ser um áudio de 10 segundos. Qualquer fragmento já vira algo.</p>

      <a href="${appUrl}/registrar" class="btn">Dar um oi pra Lis →</a>

      <p class="sign">com carinho, Lis.</p>
    </div>
    <div class="footer">
      Amiga de Bolso · Diário emocional com IA<br />
      <span style="font-size:11px;margin-top:6px;display:block;">
        Se não quiser mais receber estes emails, você pode desativar nas configurações do app.
      </span>
    </div>
  </div>
</body>
</html>`,
  },

  // ── D2: A Lis guarda o que você vive ─────────────────────────────────────
  2: {
    subject: "a Lis guarda o que você vive 🌿",
    html: (name, appUrl) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin:0; padding:0; background:#FFF8F1; font-family:'Helvetica Neue',Arial,sans-serif; color:#4A4458; }
    .wrap { max-width:600px; margin:40px auto; background:#fff; border-radius:24px; overflow:hidden; box-shadow:0 10px 30px rgba(142,58,107,0.08); border:1px solid rgba(184,169,212,0.3); }
    .strip { height:8px; background:linear-gradient(90deg,#E8A0BF 0%,#B8A9D4 55%,#5BA67D 100%); }
    .body { padding:48px 40px; text-align:center; }
    h1 { font-size:26px; font-weight:700; color:#8E3A6B; margin:0 0 32px; line-height:1.3; }
    p { font-size:16px; line-height:1.7; color:#4A4458; margin:0 0 20px; }
    .card { background:#F5F2F8; border-radius:20px; padding:24px 28px; margin:28px 0; text-align:left; }
    .card-title { font-size:14px; font-weight:700; color:#8E3A6B; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:12px; }
    .card p { font-size:15px; margin:0; }
    .btn { display:inline-block; margin:32px 0 8px; padding:16px 40px; background:linear-gradient(135deg,#E8A0BF,#D98AAE); color:#fff !important; text-decoration:none; border-radius:50px; font-size:15px; font-weight:700; box-shadow:0 8px 24px rgba(232,160,191,0.4); }
    .sign { font-style:italic; font-size:15px; color:#8E3A6B; margin-top:40px; }
    .footer { background:#FAFAFA; padding:24px 32px; text-align:center; font-size:12px; color:#9CA3AF; border-top:1px solid #F3F4F6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="strip"></div>
    <div class="body">
      <h1>Eu lembro de tudo. 🌿</h1>

      <p>Oi ${name},</p>

      <p>A Lis não é um chat qualquer que começa do zero toda vez. Ela guarda o que você compartilha — e vai percebendo padrões que você talvez não tenha notado.</p>

      <div class="card">
        <p class="card-title">Com o tempo, ela pode perceber:</p>
        <p>O que te pesa mais em certas épocas do mês. O que te ajuda a respirar. Os temas que voltam. O que mudou desde a semana passada.</p>
      </div>

      <p>Para isso, só precisa aparecer de vez em quando. Sem agenda. Sem obrigação. Só quando tiver vontade.</p>

      <p>E toda semana, ela te manda a sua <strong>Carta</strong> — um retrato do que você viveu, escrito com carinho. 💜</p>

      <a href="${appUrl}/registrar" class="btn">Continuar meu diário →</a>

      <p class="sign">com carinho, Lis.</p>
    </div>
    <div class="footer">
      Amiga de Bolso · Diário emocional com IA<br />
      <span style="font-size:11px;margin-top:6px;display:block;">
        Se não quiser mais receber estes emails, você pode desativar nas configurações do app.
      </span>
    </div>
  </div>
</body>
</html>`,
  },

  // ── D3: Dia 3. Como você está? ───────────────────────────────────────────
  3: {
    subject: "dia 3. como você está? 💜",
    html: (name, appUrl) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin:0; padding:0; background:#FFF8F1; font-family:'Helvetica Neue',Arial,sans-serif; color:#4A4458; }
    .wrap { max-width:600px; margin:40px auto; background:#fff; border-radius:24px; overflow:hidden; box-shadow:0 10px 30px rgba(142,58,107,0.08); border:1px solid rgba(184,169,212,0.3); }
    .strip { height:8px; background:linear-gradient(90deg,#E8A0BF 0%,#B8A9D4 55%,#5BA67D 100%); }
    .body { padding:48px 40px; text-align:center; }
    h1 { font-size:26px; font-weight:700; color:#8E3A6B; margin:0 0 32px; line-height:1.3; }
    p { font-size:16px; line-height:1.7; color:#4A4458; margin:0 0 20px; }
    .quote { font-style:italic; font-size:17px; color:#8E3A6B; border-left:3px solid #E8A0BF; padding:12px 20px; margin:28px 0; text-align:left; background:#FFF8F1; border-radius:0 16px 16px 0; }
    .btn { display:inline-block; margin:32px 0 8px; padding:16px 40px; background:linear-gradient(135deg,#E8A0BF,#D98AAE); color:#fff !important; text-decoration:none; border-radius:50px; font-size:15px; font-weight:700; box-shadow:0 8px 24px rgba(232,160,191,0.4); }
    .btn-note { font-size:12px; color:#8B8398; margin-top:8px; }
    .sign { font-style:italic; font-size:15px; color:#8E3A6B; margin-top:40px; }
    .footer { background:#FAFAFA; padding:24px 32px; text-align:center; font-size:12px; color:#9CA3AF; border-top:1px solid #F3F4F6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="strip"></div>
    <div class="body">
      <h1>Dia 3. 💜</h1>

      <p>Oi ${name}, chegou o dia 3.</p>

      <p>Muita gente me conta que nos primeiros dias o mais difícil é saber o que dizer. Mas lá pela segunda ou terceira semana, já aparece naturalmente — como uma conversa com uma amiga que te conhece.</p>

      <div class="quote">
        "Você não precisa estar bem pra aparecer. Às vezes aparecer é exatamente o que te ajuda a estar."
      </div>

      <p>Essa semana, se você registrar pelo menos um momento, a Lis já começa a montar o seu <strong>Mapa</strong> — um retrato de como você tem estado, o que tem te pesado, o que tem te aliviado.</p>

      <p>Não precisa ser hoje. Mas quando estiver pronta:</p>

      <a href="${appUrl}/registrar" class="btn">Abrir meu mapa →</a>
      <p class="btn-note">No seu ritmo. Quando você quiser.</p>

      <p class="sign">com carinho, Lis.</p>
    </div>
    <div class="footer">
      Amiga de Bolso · Diário emocional com IA<br />
      <span style="font-size:11px;margin-top:6px;display:block;">
        Se não quiser mais receber estes emails, você pode desativar nas configurações do app.
      </span>
    </div>
  </div>
</body>
</html>`,
  },
};

// ─── HANDLER ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: { day?: number; only_user_id?: string; dry_run?: boolean } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch (_) { /* body opcional */ }

  const day = body.day ?? 0;
  if (![0, 1, 2, 3].includes(day)) {
    return new Response(JSON.stringify({ error: "day deve ser 0, 1, 2 ou 3" }), { status: 400 });
  }

  const template = TEMPLATES[day];

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Busca usuárias que se cadastraram há exatamente N dias
    // (created_at::date = current_date - N days)
    let query = supabaseAdmin
      .from("profiles")
      .select("id, name")
      .gte("created_at", new Date(Date.now() - (day + 1) * 86400_000).toISOString())
      .lt("created_at",  new Date(Date.now() -  day      * 86400_000).toISOString());

    if (body.only_user_id) query = query.eq("id", body.only_user_id);

    const { data: profiles, error: profilesError } = await query;
    if (profilesError) {
      console.error("Erro ao buscar profiles:", profilesError);
      return new Response(JSON.stringify({ error: profilesError.message }), { status: 500 });
    }

    const targets = profiles || [];
    console.log(`[onboarding-emails] day=${day} targets=${targets.length} dry_run=${body.dry_run}`);

    if (body.dry_run) {
      return new Response(JSON.stringify({ dry_run: true, day, targets: targets.length, subject: template.subject }), { status: 200 });
    }

    let sent = 0;
    let failed = 0;

    for (const user of targets) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id);
      const email = authUser.user?.email;
      if (!email) continue;

      try {
        const html = template.html(user.name || "amiga", APP_URL);
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [email],
            subject: template.subject,
            html,
          }),
        });

        if (resp.ok) {
          sent++;
        } else {
          failed++;
          console.warn(`Email D${day} falhou para ${email}: ${resp.status} ${await resp.text()}`);
        }
      } catch (e: any) {
        failed++;
        console.warn(`Email D${day} throw para ${user.id}:`, e.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, day, targets: targets.length, sent, failed }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("onboarding-emails erro fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
