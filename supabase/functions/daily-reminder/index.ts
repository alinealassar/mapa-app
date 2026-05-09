import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Template HTML (injetado aqui para facilitar o deploy em arquivo único se necessário, 
// mas usaremos o arquivo separado se o deploy suportar)
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
            <p>Notei que hoje o seu mapa ficou um pouco em silêncio. Passo por aqui apenas para te lembrar que este espaço é seu — para os dias de sol, mas principalmente para os dias pesados.</p>
            <p style="font-style: italic; color: #8E3A6B;">"Aqui você não precisa dar conta de nada. Eu estou aqui para te ouvir."</p>
            <p>Sem nenhuma pressa e sem nenhuma pontinha de culpa. Se sentir vontade de soltar o que está aí dentro, é só chegar.</p>
            <a href="https://mapa-app-q3rh.onrender.com/registrar" class="button">Abrir meu Mapa 🗺️</a>
            <p style="margin-top: 40px; font-style: italic; color: #8E3A6B;">com carinho, Lis.</p>
        </div>
    </div>
</body>
</html>
`;

Deno.serve(async (req) => {
  // Apenas aceita requisições POST para evitar disparos acidentais
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Definir janela de 24 horas
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const yesterdayISO = yesterday.toISOString();

    console.log(`Verificando inatividade desde: ${yesterdayISO}`);

    // 2. Buscar todas as usuárias ativas (profiles)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, name");

    if (profilesError) throw profilesError;

    // 3. Buscar quem registrou algo nas últimas 24h
    const { data: recentEntries, error: entriesError } = await supabaseAdmin
      .from("mood_entries")
      .select("user_id")
      .gt("created_at", yesterdayISO);

    if (entriesError) throw entriesError;

    const activeUserIds = new Set(recentEntries.map((e) => e.user_id));

    // 4. Identificar usuárias inativas
    const inactiveUsers = profiles.filter((p) => !activeUserIds.has(p.id));

    console.log(`Total de usuárias: ${profiles.length}`);
    console.log(`Usuárias ativas (24h): ${activeUserIds.size}`);
    console.log(`Usuárias para notificar: ${inactiveUsers.length}`);

    const results = [];

    // 5. Disparar e-mails via Resend
    for (const user of inactiveUsers) {
      // Precisamos do e-mail que está no Auth do Supabase
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(user.id);
      
      if (authError || !authUser.user?.email) {
        console.error(`Erro ao buscar e-mail da usuária ${user.id}:`, authError);
        continue;
      }

      const userEmail = authUser.user.email;
      const firstName = user.name || "Aline"; // Fallback carinhoso

      const html = EMAIL_TEMPLATE.replace("{{name}}", firstName);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Lis do Mapa <oi@mapaapp.com.br>", // Precisará de domínio validado ou usar e-mail do Resend
          to: [userEmail],
          subject: "Passando para te dar um oi 🌸",
          html: html,
        }),
      });

      const resData = await res.json();
      results.push({ email: userEmail, status: res.status, data: resData });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: inactiveUsers.length,
      results 
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Erro na função daily-reminder:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
