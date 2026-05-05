import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
});

function ForgotPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) return toast.error(t("auth:invalidEmail"));
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success(t("auth:resetSent"));
  };

  return (
    <AuthShell title={t("auth:resetPassword")} subtitle={t("auth:loginSubtitle")}>
      {sent ? (
        <p className="text-sm text-muted-foreground">{t("auth:resetSent")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth:email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("loading") : t("auth:sendResetLink")}
          </Button>
          <p className="text-center text-xs">
            <Link to="/login" className="text-primary hover:underline">{t("auth:login")}</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
