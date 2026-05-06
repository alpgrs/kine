import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/providers/OrgProvider";
import { supabase } from "@/integrations/supabase/client";
import { parsePriceToCents, sanitizePhone } from "@/lib/be-helpers";

export const Route = createFileRoute("/settings")({
  component: () => (
    <RequireAuth><AppShell><SettingsPage /></AppShell></RequireAuth>
  ),
});

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

function SettingsPage() {
  const { t } = useTranslation();
  const { activeOrg, refresh } = useOrg();
  const [org, setOrg] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [hours, setHours] = useState<any[]>([]);
  const [smsOn, setSmsOn] = useState(false);
  const [gcalOn, setGcalOn] = useState(false);
  const [newSvc, setNewSvc] = useState<{ name: string; duration: number; price: string }>({ name: "", duration: 30, price: "50" });

  const load = async () => {
    if (!activeOrg) return;
    const [{ data: o }, { data: s }, { data: h }] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", activeOrg.id).maybeSingle(),
      supabase.from("services").select("*").eq("organization_id", activeOrg.id).order("sort_order"),
      supabase.from("working_hours").select("*").eq("organization_id", activeOrg.id).order("day_of_week"),
    ]);
    setOrg(o); setServices(s ?? []); setHours(h ?? []);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [activeOrg]);

  const saveOrg = async (patch: any) => {
    if (!activeOrg) return;
    const { error } = await supabase.from("organizations").update(patch).eq("id", activeOrg.id);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); void load(); void refresh();
  };

  const addSvc = async () => {
    if (!activeOrg || !newSvc.name.trim()) return;
    const cents = parsePriceToCents(newSvc.price);
    const { error } = await supabase.from("services").insert({
      organization_id: activeOrg.id, name: newSvc.name.trim(),
      duration_minutes: newSvc.duration, price_cents: cents,
    });
    if (error) return toast.error(error.message);
    toast.success(t("settings:services.addedSuccess"));
    setNewSvc({ name: "", duration: 30, price: "50" });
    void load();
  };

  const delSvc = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    void load();
  };

  const toggleDay = async (day: number, on: boolean) => {
    if (!activeOrg) return;
    const existing = hours.find((h) => h.day_of_week === day);
    if (existing) {
      await supabase.from("working_hours").update({ is_active: on }).eq("id", existing.id);
    } else if (on) {
      await supabase.from("working_hours").insert({ organization_id: activeOrg.id, day_of_week: day, start_time: "09:00", end_time: "17:00" });
    }
    void load();
  };

  const updateDayTime = async (id: string, field: "start_time" | "end_time", val: string) => {
    const patch = field === "start_time" ? { start_time: val } : { end_time: val };
    await supabase.from("working_hours").update(patch).eq("id", id);
    void load();
  };

  return (
    <>
      <PageHeader title={t("settings:title")} />
      <Tabs defaultValue="practice">
        <TabsList className="flex-wrap">
          <TabsTrigger value="practice">{t("settings:tabs.practice")}</TabsTrigger>
          <TabsTrigger value="services">{t("settings:tabs.services")}</TabsTrigger>
          <TabsTrigger value="hours">{t("settings:tabs.hours")}</TabsTrigger>
          <TabsTrigger value="integrations">{t("settings:tabs.integrations")}</TabsTrigger>
        </TabsList>

        <TabsContent value="practice">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div><Label>{t("settings:practice.bookingSlug")}</Label>
                <Input value={org?.booking_slug ?? ""} onChange={(e) => setOrg({ ...org, booking_slug: e.target.value })} onBlur={(e) => saveOrg({ booking_slug: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">{t("settings:practice.bookingSlugDesc")}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>{t("settings:practice.publicEmail")}</Label>
                  <Input type="email" value={org?.public_email ?? ""} onChange={(e) => setOrg({ ...org, public_email: e.target.value })} onBlur={(e) => saveOrg({ public_email: e.target.value || null })} />
                </div>
                <div><Label>{t("settings:practice.publicPhone")}</Label>
                  <Input value={org?.public_phone ?? ""} onChange={(e) => setOrg({ ...org, public_phone: e.target.value })} onBlur={(e) => saveOrg({ public_phone: e.target.value || null })} />
                </div>
              </div>
              <div className="rounded-md bg-muted p-3 text-sm">
                {t("onboarding:vatStatus")}: <Badge>{org?.vat_exempt ? t("onboarding:vatExempt") : t("onboarding:vatNormal")}</Badge>
                {org?.inami_number && <span className="ml-2 text-xs text-muted-foreground">{t("invoicing:inami")}: {org.inami_number}</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader><CardTitle>{t("settings:services.title")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.duration_minutes} {t("minutes")} · {(s.price_cents / 100).toFixed(2)} €</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => delSvc(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              <div className="grid gap-2 rounded-lg border border-dashed border-border p-3 md:grid-cols-4">
                <Input placeholder={t("settings:services.name")} value={newSvc.name} onChange={(e) => setNewSvc({ ...newSvc, name: e.target.value })} />
                <Input type="number" placeholder={t("settings:services.duration")} value={newSvc.duration} onChange={(e) => setNewSvc({ ...newSvc, duration: parseInt(e.target.value) || 30 })} />
                <Input type="number" step="0.01" placeholder={t("settings:services.price")} value={newSvc.price} onChange={(e) => setNewSvc({ ...newSvc, price: parseFloat(e.target.value) || 0 })} />
                <Button onClick={addSvc} className="gap-1"><Plus className="h-4 w-4" />{t("settings:services.add")}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours">
          <Card>
            <CardHeader><CardTitle>{t("settings:hours.title")}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const h = hours.find((x) => x.day_of_week === d);
                const on = h?.is_active ?? false;
                return (
                  <div key={d} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="w-12 text-sm font-medium">{DAYS[d]}</div>
                    <Switch checked={on} onCheckedChange={(v) => toggleDay(d, v)} />
                    {on && h ? (
                      <>
                        <Input type="time" value={h.start_time?.slice(0, 5)} className="w-28" onChange={(e) => updateDayTime(h.id, "start_time", e.target.value)} />
                        <span className="text-muted-foreground">—</span>
                        <Input type="time" value={h.end_time?.slice(0, 5)} className="w-28" onChange={(e) => updateDayTime(h.id, "end_time", e.target.value)} />
                      </>
                    ) : <span className="text-sm text-muted-foreground">{t("settings:hours.closed")}</span>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">{t("settings:integrations.sms")} <Badge variant="secondary" className="ml-2">{t("settings:integrations.mock")}</Badge></p>
                  <p className="text-xs text-muted-foreground">{t("settings:integrations.smsDesc")}</p>
                </div>
                <Switch checked={smsOn} onCheckedChange={setSmsOn} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">{t("settings:integrations.google")} <Badge variant="secondary" className="ml-2">{t("settings:integrations.mock")}</Badge></p>
                  <p className="text-xs text-muted-foreground">{t("settings:integrations.googleDesc")}</p>
                </div>
                <Switch checked={gcalOn} onCheckedChange={setGcalOn} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
