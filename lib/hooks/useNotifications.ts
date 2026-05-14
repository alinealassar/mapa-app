import { useState, useEffect, useCallback } from "react";
import { getToken } from "firebase/messaging";
import { messaging } from "@/lib/firebase";
import { supabase } from "@/lib/supabaseClient";

const VAPID_KEY =
  "BLMpdmwVD8LHQC9yiQUMiqyo3rQw9iWXk3g5ljs-_5H4CwXizqQIfnzjL8f36wvFmFuEsJSLnrtsE3xLVSHBymk";

export const useNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  // Estado consultado da coluna profiles.reminders_enabled
  const [enabled, setEnabled] = useState<boolean | null>(null);

  // Carrega permissão do navegador + flag persistido em profiles
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("reminders_enabled")
        .eq("id", user.id)
        .single();
      // Default: true (mesmo comportamento de antes — se a coluna não existir, fica null)
      setEnabled(data?.reminders_enabled ?? true);
    })();
  }, []);

  const saveTokenToDatabase = useCallback(async (fcmToken: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("user_push_tokens").upsert(
      {
        user_id: user.id,
        token: fcmToken,
        device_type: /Mobi|Android/i.test(navigator.userAgent)
          ? "mobile"
          : "desktop",
      },
      { onConflict: "user_id, token" }
    );
  }, []);

  const setRemindersFlag = useCallback(async (value: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .upsert({ id: user.id, reminders_enabled: value });
  }, []);

  const enableReminders = useCallback(async () => {
    if (!messaging) {
      // Mesmo sem FCM (desktop sem service worker etc), ainda dá pra ligar e-mail
      await setRemindersFlag(true);
      setEnabled(true);
      return;
    }
    setLoading(true);
    try {
      const status = await Notification.requestPermission();
      setPermission(status);
      if (status === "granted") {
        try {
          const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
          if (currentToken) {
            setToken(currentToken);
            await saveTokenToDatabase(currentToken);
          }
        } catch (err) {
          console.warn("Não consegui pegar token FCM:", err);
        }
      }
      await setRemindersFlag(true);
      setEnabled(true);
    } catch (error) {
      console.error("Erro ao ativar lembretes:", error);
    } finally {
      setLoading(false);
    }
  }, [saveTokenToDatabase, setRemindersFlag]);

  const disableReminders = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Remove tokens push (assim para de receber notificação no celular).
        // O e-mail também para via flag reminders_enabled (lido pela Edge Function).
        await supabase
          .from("user_push_tokens")
          .delete()
          .eq("user_id", user.id);
      }
      await setRemindersFlag(false);
      setEnabled(false);
      setToken(null);
    } catch (e) {
      console.error("Erro ao desativar lembretes:", e);
    } finally {
      setLoading(false);
    }
  }, [setRemindersFlag]);

  const toggleReminders = useCallback(async () => {
    if (enabled) {
      await disableReminders();
    } else {
      await enableReminders();
    }
  }, [enabled, enableReminders, disableReminders]);

  return {
    token,
    permission,
    loading,
    enabled,
    enableReminders,
    disableReminders,
    toggleReminders,
    // alias antigo para não quebrar quem ainda chama
    requestPermission: enableReminders,
  };
};
