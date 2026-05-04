import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Receipt } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/providers/OrgProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/billing")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <BillingPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface Plan {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: string;
  features: string[];
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  pdf_url: string | null;
  created_at: string;
}

function BillingPage() {
  const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<{ status: string; plan_id: string | null } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    void supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => data && setPlans(data as unknown as Plan[]));
  }, []);

  useEffect(() => {
    if (!activeOrg) return;
    void supabase
      .from("subscriptions")
      .select("status, plan_id")
      .eq("organization_id", activeOrg.id)
      .in("status", ["active", "trialing", "past_due"])
      .maybeSingle()
      .then(({ data }) => setSub(data));
    void supabase
      .from("invoices")
      .select("id, number, amount, currency, status, pdf_url, created_at")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => data && setInvoices(data as Invoice[]));
  }, [activeOrg]);

  const subscribe = (planName: string) => {
    toast.info(`Activation Stripe à venir pour ${planName}`, {
      description: "Connectez Stripe via Lovable Payments pour finaliser.",
    });
  };

  const fmt = (cents: number, currency: string) =>
    new Intl.NumberFormat("fr-BE", { style: "currency", currency }).format(cents / 100);

  return (
    <>
      <PageHeader title={t("billing")} description="Plans, abonnement et factures" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t("billing:currentPlan")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sub ? (
            <Badge variant="default">{t(`billing:status.${sub.status}`)}</Badge>
          ) : (
            <p className="text-sm text-muted-foreground">{t("billing:noPlan")}</p>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 font-display text-xl font-bold">{t("billing:choosePlan")}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <div className="mb-4">
                <span className="text-3xl font-bold">{fmt(p.amount, p.currency)}</span>
                <span className="text-sm text-muted-foreground">
                  {p.interval === "month" ? t("billing:perMonth") : t("billing:perYear")}
                </span>
              </div>
              <ul className="mb-6 flex-1 space-y-2 text-sm">
                {(p.features || []).map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button onClick={() => subscribe(p.name)} className="w-full">
                {t("billing:subscribe")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-10 font-display text-xl font-bold">{t("billing:invoices")}</h2>
      <Card>
        <CardContent className="pt-6">
          {invoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("billing:noInvoices")}</p>
          ) : (
            <ul className="divide-y">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{inv.number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{fmt(inv.amount, inv.currency)}</span>
                    <Badge variant="outline">{inv.status}</Badge>
                    {inv.pdf_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={inv.pdf_url} target="_blank" rel="noreferrer">PDF</a>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
