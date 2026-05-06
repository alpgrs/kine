import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useOrg } from "@/providers/OrgProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { PROFESSIONS, getProfession, sanitizeInami, sanitizeVat, isValidInami, isValidBeVat } from "@/lib/be-helpers";

export const Route = createFileRoute("/onboarding")({
  component: () => (
    <RequireAuth requireOrg={false}>
      <OnboardingPage />
    </RequireAuth>
  ),
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "praticien";

const schema = z.object({
  fullName: z.string().trim().min(2).max(80),
  practiceName: z.string().trim().min(2).max(80),
  professionalTitle: z.string().min(1),
  inami: z.string().trim().max(40).optional().or(z.literal("")),
  vatExempt: z.boolean(),
  vatNumber: z.string().trim().optional().or(z.literal("")),
});

function OnboardingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refresh, setActiveOrgId } = useOrg();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [inami, setInami] = useState("");
  const [vatExempt, setVatExempt] = useState(true);
  const [vatNumber, setVatNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInami = sanitizeInami(inami);
    const cleanVat = sanitizeVat(vatNumber);
    const parsed = schema.safeParse({ fullName, practiceName, professionalTitle, inami: cleanInami, vatExempt, vatNumber: cleanVat });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid");
      return;
    }
    const profDef = getProfession(parsed.data.professionalTitle);
    if (profDef?.inamiRequired && !cleanInami) {
      toast.error(t("onboarding:inamiRequired"));
      return;
    }
    if (cleanInami && !isValidInami(cleanInami)) {
      toast.warning(t("onboarding:inamiWarn"));
    }
    if (!vatExempt) {
      if (!cleanVat || !isValidBeVat(cleanVat)) {
        toast.error(t("onboarding:vatInvalid"));
        return;
      }
    }
    setLoading(true);

    // Update profile
    const [first, ...rest] = parsed.data.fullName.split(" ");
    await supabase.from("profiles").update({
      first_name: first,
      last_name: rest.join(" ") || null,
    }).eq("id", user!.id);

    const baseSlug = slugify(parsed.data.practiceName);
    const slug = baseSlug + "-" + Math.random().toString(36).slice(2, 6);

    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: parsed.data.practiceName,
        slug,
        booking_slug: slug,
        professional_title: parsed.data.professionalTitle,
        inami_number: cleanInami || null,
        vat_exempt: parsed.data.vatExempt,
        vat_number: parsed.data.vatExempt ? null : (cleanVat || null),
        address_country: "BE",
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

    if (mErr) {
      setLoading(false);
      toast.error(mErr.message);
      return;
    }

    // Seed default working hours (Mon-Fri 9-17) and one default service
    const wh = [1, 2, 3, 4, 5].map((d) => ({
      organization_id: org.id, day_of_week: d, start_time: "09:00", end_time: "17:00", is_active: true,
    }));
    await supabase.from("working_hours").insert(wh);
    await supabase.from("services").insert({
      organization_id: org.id,
      name: "Consultation",
      duration_minutes: 30,
      price_cents: 5000,
    });

    await refresh();
    setActiveOrgId(org.id);
    setLoading(false);
    void navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-bold">{t("appName")}</span>
        </div>
        <div className="surface-card p-6 md:p-8">
          <h1 className="font-display text-2xl font-bold">{t("onboarding:title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboarding:subtitle")}</p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fn">{t("onboarding:fullName")}</Label>
              <Input id="fn" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("onboarding:fullNamePh")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pn">{t("onboarding:practiceName")}</Label>
              <Input id="pn" required value={practiceName} onChange={(e) => setPracticeName(e.target.value)} placeholder={t("onboarding:practiceNamePh")} />
            </div>
            <div className="space-y-2">
              <Label>{t("onboarding:professionalTitle")}</Label>
              <Select value={professionalTitle} onValueChange={setProfessionalTitle}>
                <SelectTrigger><SelectValue placeholder={t("onboarding:selectTitle")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kine">{t("onboarding:titleKine")}</SelectItem>
                  <SelectItem value="osteo">{t("onboarding:titleOsteo")}</SelectItem>
                  <SelectItem value="logo">{t("onboarding:titleLogo")}</SelectItem>
                  <SelectItem value="psy">{t("onboarding:titlePsy")}</SelectItem>
                  <SelectItem value="other">{t("onboarding:titleOther")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inami">{t("onboarding:inami")}</Label>
              <Input id="inami" value={inami} onChange={(e) => setInami(e.target.value)} placeholder={t("onboarding:inamiPh")} />
            </div>
            <div className="space-y-2">
              <Label>{t("onboarding:vatStatus")}</Label>
              <RadioGroup value={vatExempt ? "ex" : "no"} onValueChange={(v) => setVatExempt(v === "ex")}>
                <div className="flex items-start space-x-2 rounded-lg border border-border p-3">
                  <RadioGroupItem value="ex" id="ex" className="mt-0.5" />
                  <Label htmlFor="ex" className="font-normal cursor-pointer">{t("onboarding:vatExempt")}</Label>
                </div>
                <div className="flex items-start space-x-2 rounded-lg border border-border p-3">
                  <RadioGroupItem value="no" id="no" className="mt-0.5" />
                  <Label htmlFor="no" className="font-normal cursor-pointer">{t("onboarding:vatNormal")}</Label>
                </div>
              </RadioGroup>
            </div>
            {!vatExempt && (
              <div className="space-y-2">
                <Label htmlFor="vat">{t("onboarding:vatNumber")}</Label>
                <Input id="vat" value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder={t("onboarding:vatNumberPh")} />
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? t("loading") : t("onboarding:finish")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
