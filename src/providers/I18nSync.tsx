import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import "@/i18n";

/**
 * Syncs the user's preferred language from their profile into i18n
 * once authenticated. Falls back to browser detection otherwise.
 */
export function I18nSync() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("language")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.language && data.language !== i18n.language) {
          void i18n.changeLanguage(data.language);
        }
      });
  }, [user, i18n]);

  return null;
}
