import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { AuthShell } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const schema = z.object({ email: z.string().trim().email() });

function SignupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(t("auth:invalidEmail"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: window.location.origin + "/onboarding",
        data: { language: i18n.language?.slice(0, 2) ?? "fr" },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell title={t("auth:signupTitle")} subtitle={t("auth:signupSubtitle")}>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="font-display text-xl font-bold">{t("auth:checkEmail")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth:checkEmailDesc")}</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth:email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.be"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("loading") : t("auth:sendMagicLink")}
          </Button>
          <p className="pt-2 text-center text-xs text-muted-foreground">
            {t("auth:alreadyAccount")}{" "}
            <a href="/login" className="font-medium text-primary hover:underline">
              {t("auth:login")}
            </a>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
