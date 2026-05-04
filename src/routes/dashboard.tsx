import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, CreditCard, Receipt, TrendingUp } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/providers/OrgProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <DashboardPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface Stats {
  members: number;
  invoices: number;
  subStatus: string | null;
}

function DashboardPage() {
  const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const [stats, setStats] = useState<Stats>({ members: 0, invoices: 0, subStatus: null });

  useEffect(() => {
    if (!activeOrg) return;
    void (async () => {
      const [{ count: members }, { count: invoices }, { data: sub }] = await Promise.all([
        supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", activeOrg.id),
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", activeOrg.id),
        supabase
          .from("subscriptions")
          .select("status")
          .eq("organization_id", activeOrg.id)
          .in("status", ["active", "trialing", "past_due"])
          .maybeSingle(),
      ]);
      setStats({
        members: members ?? 0,
        invoices: invoices ?? 0,
        subStatus: sub?.status ?? null,
      });
    })();
  }, [activeOrg]);

  const cards = [
    { icon: Users, label: t("team"), value: stats.members },
    { icon: Receipt, label: t("billing:invoices"), value: stats.invoices },
    {
      icon: CreditCard,
      label: t("billing:currentPlan"),
      value: stats.subStatus ? t(`billing:status.${stats.subStatus}`) : t("billing:noPlan"),
    },
    { icon: TrendingUp, label: "Activité", value: "—" },
  ];

  return (
    <>
      <PageHeader
        title={`${t("dashboard")} · ${activeOrg?.name ?? ""}`}
        description="Vue d'ensemble de votre organisation"
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Bienvenue sur {t("appName")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Votre socle est prêt. Configurez votre <strong>profil</strong>, invitez votre <strong>équipe</strong>, puis choisissez un <strong>plan</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Multi-tenant</Badge>
            <Badge variant="secondary">RLS</Badge>
            <Badge variant="secondary">FR · NL · EN</Badge>
            <Badge variant="secondary">PWA</Badge>
            <Badge variant="secondary">TVA BE</Badge>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
