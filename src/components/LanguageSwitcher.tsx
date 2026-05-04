import { useTranslation } from "react-i18next";
import { Check, Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LANGS } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

const LABELS: Record<string, string> = { fr: "Français", nl: "Nederlands", en: "English" };

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const change = async (lng: string) => {
    await i18n.changeLanguage(lng);
    if (user) {
      await supabase
        .from("profiles")
        .update({ language: lng as "fr" | "nl" | "en" })
        .eq("id", user.id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Language">
          <Languages className="h-4 w-4" />
          <span className="ml-2 hidden uppercase sm:inline">{i18n.language?.slice(0, 2)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGS.map((l) => (
          <DropdownMenuItem key={l} onClick={() => void change(l)}>
            <span className="mr-2 inline-block w-4">
              {i18n.language?.startsWith(l) && <Check className="h-3 w-3" />}
            </span>
            {LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
