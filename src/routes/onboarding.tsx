import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useOrg } from "@/providers/OrgProvider";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/onboarding")({
  component: () => (
    <RequireAuth requireOrg={false}>
      <OnboardingPage />
    </RequireAuth>
  ),
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "org";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  vat_number: z
    .string()
    .trim()
    .regex(/^BE0[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}$/)
    .optional()
    .or(z.literal("")),
});

function OnboardingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refresh, setActiveOrgId } = useOrg();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [vat, setVat] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, vat_number: vat });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }
    setLoading(true);
    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: parsed.data.name,
        slug,
        vat_number: parsed.data.vat_number || null,
        created_by: user!.id,
      })
      .select()
      .single();
    if (error || !org) {
      setLoading(false);
      toast.error(error?.message ?? "Error");
      return;
    }
    const { error: mErr } = await supabase
      .from("memberships")
      .insert({ user_id: user!.id, organization_id: org.id, role: "owner" });
    setLoading(false);
    if (mErr) {
      toast.error(mErr.message);
      return;
    }
    await refresh();
    setActiveOrgId(org.id);
    void navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-display text-xl font-bold">{t("appName")}</span>
        </div>
        <div className="surface-card p-8">
          <h1 className="font-display text-2xl font-bold">{t("createOrg")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configurez votre organisation pour commencer.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'organisation</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat">N° TVA (optionnel)</Label>
              <Input
                id="vat"
                placeholder="BE0123.456.789"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("loading") : t("create")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
