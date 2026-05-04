import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useOrg } from "@/providers/OrgProvider";

export const Route = createFileRoute("/invite")({
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
  component: InvitePage,
});

function InvitePage() {
  const { t } = useTranslation();
  const { token } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const { refresh, setActiveOrgId } = useOrg();
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ org_name: string; organization_id: string; email: string; role: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    void supabase
      .from("invitations")
      .select("organization_id, email, role, organizations(name)")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInfo({
            organization_id: data.organization_id,
            email: data.email,
            role: data.role,
            org_name: (data.organizations as { name: string } | null)?.name ?? "",
          });
        }
      });
  }, [token]);

  const accept = async () => {
    if (!info || !user) return;
    setLoading(true);
    const { error } = await supabase.from("memberships").insert({
      user_id: user.id,
      organization_id: info.organization_id,
      role: info.role as "owner" | "editor" | "viewer",
    });
    if (!error) {
      await supabase
        .from("invitations")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("token", token);
      await refresh();
      setActiveOrgId(info.organization_id);
      toast.success("Invitation acceptée");
      void navigate({ to: "/dashboard" });
    } else {
      toast.error(error.message);
    }
    setLoading(false);
  };

  if (!token || (!authLoading && !info)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Invitation invalide ou expirée.</div>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="surface-card w-full max-w-md p-8 text-center">
          <h1 className="font-display text-xl font-bold">{t("auth:invitedToJoin", { org: info?.org_name ?? "" })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Connectez-vous pour accepter.</p>
          <Button className="mt-6 w-full" onClick={() => void navigate({ to: "/login", search: { redirect: `/invite?token=${token}` } })}>
            {t("auth:login")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="surface-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full gradient-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="font-display text-xl font-bold">{t("auth:invitedToJoin", { org: info?.org_name })}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Rôle : {info?.role}</p>
        <Button className="mt-6 w-full" onClick={() => void accept()} disabled={loading}>
          {loading ? t("loading") : t("auth:acceptInvitation")}
        </Button>
      </div>
    </div>
  );
}
