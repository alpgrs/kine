import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { AuthShell } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

function SignupPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/onboarding" });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("auth:invalidEmail"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
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
    toast.success(t("auth:signupSuccess"));
  };

  return (
    <AuthShell title={t("auth:signupTitle")} subtitle={t("auth:signupSubtitle")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth:email")}</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.be" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth:password")}</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth:passwordPlaceholder")} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("loading") : t("auth:signUpBtn")}
        </Button>
        <p className="pt-2 text-center text-xs text-muted-foreground">
          {t("auth:alreadyAccount")}{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">{t("auth:login")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
