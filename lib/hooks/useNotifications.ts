import { useState, useEffect } from "react";
import { getToken } from "firebase/messaging";
import { messaging } from "@/lib/firebase";
import { supabase } from "@/lib/supabaseClient";

export const useNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!messaging) return;
    
    setLoading(true);
    try {
      const status = await Notification.requestPermission();
      setPermission(status);

      if (status === "granted") {
        // Pega o token do Firebase usando a VAPID KEY fornecida pela Aline
        const currentToken = await getToken(messaging, {
          vapidKey: "BLMpdmwVD8LHQC9yiQUMiqyo3rQw9iWXk3g5ljs-_5H4CwXizqQIfnzjL8f36wvFmFuEsJSLnrtsE3xLVSHBymk",
        });

        if (currentToken) {
          setToken(currentToken);
          await saveTokenToDatabase(currentToken);
        } else {
          console.warn("Nenhum token de registro disponível. Solicite permissão para gerar um.");
        }
      }
    } catch (error) {
      console.error("Erro ao solicitar permissão de notificação:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveTokenToDatabase = async (fcmToken: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_push_tokens")
      .upsert(
        { 
          user_id: user.id, 
          token: fcmToken,
          device_type: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop"
        },
        { onConflict: "user_id, token" }
      );

    if (error) {
      console.error("Erro ao salvar token no banco de dados:", error);
    }
  };

  return { token, permission, loading, requestPermission };
};
