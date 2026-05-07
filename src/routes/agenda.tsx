import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { Plus, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useOrg } from "@/providers/OrgProvider";
import { supabase } from "@/integrations/supabase/client";
import { sanitizePhone } from "@/lib/be-helpers";

export const Route = createFileRoute("/agenda")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <AgendaPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface Appt {
  id: string; patient_first_name: string; patient_last_name: string;
  patient_email: string; patient_phone: string | null;
  start_time: string; end_time: string; status: string;
  service_id: string | null;
}
interface Svc { id: string; name: string; duration_minutes: number; price_cents: number; }

function AgendaPage() {
  const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [appts, setAppts] = useState<Appt[]>([]);
  const [services, setServices] = useState<Svc[]>([]);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // form
  const [fn, setFn] = useState(""); const [ln, setLn] = useState("");
  const [em, setEm] = useState(""); const [ph, setPh] = useState("");
  const [svcId, setSvcId] = useState(""); const [dt, setDt] = useState("");

  const load = async () => {
    if (!activeOrg) return;
    setLoadError(false);
    const wkEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const [{ data: a, error: e1 }, { data: s, error: e2 }] = await Promise.all([
      supabase.from("appointments").select("*")
        .eq("organization_id", activeOrg.id)
        .gte("start_time", weekStart.toISOString())
        .lte("start_time", wkEnd.toISOString())
        .order("start_time"),
      supabase.from("services").select("id,name,duration_minutes,price_cents")
        .eq("organization_id", activeOrg.id).eq("is_active", true).order("sort_order"),
    ]);
    if (e1 || e2) { setLoadError(true); return; }
    setAppts((a ?? []) as Appt[]);
    setServices((s ?? []) as Svc[]);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [activeOrg, weekStart]);

  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg || !svcId || !dt) return;
    const svc = services.find((s) => s.id === svcId);
    if (!svc) return;
    const start = new Date(dt);
    const end = new Date(start.getTime() + svc.duration_minutes * 60000);
    const { error } = await supabase.from("appointments").insert({
      organization_id: activeOrg.id, service_id: svcId,
      patient_first_name: fn, patient_last_name: ln,
      patient_email: em, patient_phone: ph ? sanitizePhone(ph) : null,
      start_time: start.toISOString(), end_time: end.toISOString(),
      status: "scheduled",
    });
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setOpen(false);
    setFn(""); setLn(""); setEm(""); setPh(""); setSvcId(""); setDt("");
    void load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("appointments").update({ status: status as "scheduled" | "completed" | "cancelled" | "no_show" }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  if (loadError) {
    return (
      <>
        <PageHeader title={t("agenda:title")} />
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-muted-foreground">{t("errors:loadFailed")}</p>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => void load()}>
            <RefreshCw className="h-3 w-3" />{t("errors:retry")}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("agenda:title")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />{t("agenda:newAppointment")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("agenda:newAppointment")}</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("agenda:patientFirstName")}</Label><Input required value={fn} onChange={(e) => setFn(e.target.value)} /></div>
                  <div><Label>{t("agenda:patientLastName")}</Label><Input required value={ln} onChange={(e) => setLn(e.target.value)} /></div>
                </div>
                <div><Label>{t("agenda:patientEmail")}</Label><Input type="email" required value={em} onChange={(e) => setEm(e.target.value)} /></div>
                <div><Label>{t("agenda:patientPhone")}</Label><Input value={ph} onChange={(e) => setPh(e.target.value)} placeholder="+32 4xx xx xx xx" /></div>
                <div>
                  <Label>{t("agenda:service")}</Label>
                  <Select value={svcId} onValueChange={setSvcId}>
                    <SelectTrigger><SelectValue placeholder={t("agenda:selectService")} /></SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · {s.duration_minutes} {t("minutes")} · {(s.price_cents / 100).toFixed(2)} €
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("agenda:startTime")}</Label><Input type="datetime-local" required value={dt} onChange={(e) => setDt(e.target.value)} /></div>
                <Button type="submit" className="w-full">{t("create")}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>{t("today")}</Button>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
        <span className="ml-2 font-medium">
          {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => {
          const dayAppts = appts.filter((a) => isSameDay(new Date(a.start_time), d));
          return (
            <Card key={d.toISOString()} className="min-h-[200px]">
              <CardContent className="p-3">
                <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{format(d, "EEE d")}</div>
                {dayAppts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">—</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayAppts.map((a) => (
                      <li key={a.id} className={`rounded-md border p-2 text-xs ${a.status === "cancelled" ? "opacity-50 line-through" : a.status === "completed" ? "border-success/30 bg-success/5" : "border-primary/30 bg-primary/5"}`}>
                        <div className="font-semibold">{format(new Date(a.start_time), "HH:mm")}</div>
                        <div className="truncate">{a.patient_first_name} {a.patient_last_name}</div>
                        {a.status === "scheduled" && (
                          <div className="mt-1 flex gap-1">
                            <button className="text-[10px] text-success hover:underline" onClick={() => updateStatus(a.id, "completed")}>✓</button>
                            <button className="text-[10px] text-destructive hover:underline" onClick={() => updateStatus(a.id, "cancelled")}>✕</button>
                          </div>
                        )}
                        {a.status !== "scheduled" && <Badge variant="secondary" className="mt-1 text-[10px]">{t(`agenda:${a.status === "no_show" ? "noShow" : a.status}`)}</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
