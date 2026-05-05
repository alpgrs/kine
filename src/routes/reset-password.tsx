import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";

export const Route = createFileRoute("/reset-password")({
  component: ResetPage,
});

function ResetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error(t("auth:weakPassword"));
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth:passwordUpdated"));
    void navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell title={t("auth:resetPassword")} subtitle={t("auth:newPassword")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pw">{t("auth:newPassword")}</Label>
          <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("loading") : t("save")}
        </Button>
      </form>
    </AuthShell>
  );
}
