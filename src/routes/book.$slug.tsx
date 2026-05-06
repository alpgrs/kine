import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format, addDays, startOfDay, addMinutes, isBefore } from "date-fns";
import { Stethoscope, Check, ChevronLeft, MessageSquare } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { sanitizePhone, isValidBePhone } from "@/lib/be-helpers";

export const Route = createFileRoute("/book/$slug")({
  component: BookPage,
});

interface Org { id: string; name: string; professional_title: string | null; bio: string | null; }
interface Svc { id: string; name: string; description: string | null; duration_minutes: number; price_cents: number; }
interface Hour { day_of_week: number; start_time: string; end_time: string; is_active: boolean; }

const patientSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(150),
  phone: z.string().refine((v) => isValidBePhone(v), "Invalid BE phone"),
});

function BookPage() {
  const { t } = useTranslation();
  const { slug } = useParams({ from: "/book/$slug" });
  const [org, setOrg] = useState<Org | null>(null);
  const [services, setServices] = useState<Svc[]>([]);
  const [hours, setHours] = useState<Hour[]>([]);
  const [busy, setBusy] = useState<{ start_time: string; end_time: string }[]>([]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [svc, setSvc] = useState<Svc | null>(null);
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [slot, setSlot] = useState<Date | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: o } = await supabase.from("organizations").select("id,name,professional_title,bio")
        .eq("booking_slug", slug).maybeSingle();
      if (!o) { setNotFound(true); return; }
      setOrg(o as Org);
      const [{ data: s }, { data: h }] = await Promise.all([
        supabase.from("services").select("*").eq("organization_id", o.id).eq("is_active", true).order("sort_order"),
        supabase.from("working_hours").select("*").eq("organization_id", o.id).eq("is_active", true),
      ]);
      setServices((s ?? []) as Svc[]);
      setHours((h ?? []) as Hour[]);
    })();
  }, [slug]);

  useEffect(() => {
    if (!org || !svc) return;
    void (async () => {
      const from = startOfDay(date).toISOString();
      const to = addDays(startOfDay(date), 1).toISOString();
      const { data } = await supabase.rpc("get_busy_slots", { _org_id: org.id, _from: from, _to: to });
      setBusy(((data ?? []) as any[]).map((b) => ({ start_time: b.start_time, end_time: b.end_time })));
    })();
  }, [org, svc, date]);

  const slots: Date[] = (() => {
    if (!svc) return [];
    const day = date.getDay();
    const dayHours = hours.filter((h) => h.day_of_week === day);
    const out: Date[] = [];
    dayHours.forEach((dh) => {
      const [sh, sm] = dh.start_time.split(":").map(Number);
      const [eh, em] = dh.end_time.split(":").map(Number);
      let cur = new Date(date); cur.setHours(sh, sm, 0, 0);
      const end = new Date(date); end.setHours(eh, em, 0, 0);
      while (addMinutes(cur, svc.duration_minutes) <= end) {
        const slotEnd = addMinutes(cur, svc.duration_minutes);
        const overlap = busy.some((b) => new Date(b.start_time) < slotEnd && new Date(b.end_time) > cur);
        if (!overlap && isBefore(new Date(), cur)) out.push(new Date(cur));
        cur = addMinutes(cur, svc.duration_minutes);
      }
    });
    return out;
  })();

  const confirm = async () => {
    if (!org || !svc || !slot) return;

    // Honeypot: bot detected — fake success without persisting.
    if (honeypot.trim() !== "") { setStep(4); return; }

    const parsed = patientSchema.safeParse(form);
    if (!parsed.success) { toast.error(t("booking:phoneInvalid")); return; }
    setLoading(true);

    const cleanPhone = sanitizePhone(parsed.data.phone);
    const { data: count } = await supabase.rpc("count_upcoming_bookings_for_contact", {
      _org_id: org.id, _email: parsed.data.email, _phone: cleanPhone,
    });
    if (typeof count === "number" && count >= 3) {
      setLoading(false);
      toast.warning(t("booking:tooManyBookings"));
      return;
    }

    const end = addMinutes(slot, svc.duration_minutes);
    const { error } = await supabase.from("appointments").insert({
      organization_id: org.id, service_id: svc.id,
      patient_first_name: parsed.data.first_name, patient_last_name: parsed.data.last_name,
      patient_email: parsed.data.email, patient_phone: cleanPhone,
      start_time: slot.toISOString(), end_time: end.toISOString(), status: "scheduled",
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setStep(4);
  };

  const calendarLink = () => {
    if (!slot || !svc || !org) return "#";
    const end = addMinutes(slot, svc.duration_minutes);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const url = new URL("https://calendar.google.com/calendar/render");
    url.searchParams.set("action", "TEMPLATE");
    url.searchParams.set("text", `${svc.name} — ${org.name}`);
    url.searchParams.set("dates", `${fmt(slot)}/${fmt(end)}`);
    return url.toString();
  };

  if (notFound) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">{t("booking:practitionerNotFound")}</p></div>;
  }
  if (!org) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-4 md:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-primary-foreground"><Stethoscope className="h-4 w-4" /></div>
          <span className="font-display text-lg font-bold">{t("appName")}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">{t("booking:with")}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">{org.name}</h1>
          {org.professional_title && <p className="text-sm text-muted-foreground">{org.professional_title}</p>}
        </div>

        {step === 1 && (
          <div>
            <h2 className="mb-4 font-display text-xl font-semibold">{t("booking:step1")}</h2>
            {services.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">{t("booking:noServices")}</p>
            ) : (
              <div className="space-y-3">
                {services.map((s) => (
                  <button key={s.id} onClick={() => { setSvc(s); setStep(2); }} className="surface-card flex min-h-[64px] w-full items-center p-4 text-left transition hover:border-primary hover:shadow-md">
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.duration_minutes} {t("minutes")}</p>
                      </div>
                      <p className="shrink-0 font-semibold text-primary">{(s.price_cents / 100).toFixed(2)} €</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && svc && (
          <div>
            <button className="mb-3 flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4" />{t("back")}</button>
            <h2 className="mb-4 font-display text-xl font-semibold">{t("booking:step2")}</h2>
            <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              {Array.from({ length: 14 }).map((_, i) => {
                const d = addDays(startOfDay(new Date()), i);
                const active = isSameDay2(d, date);
                return (
                  <button
                    key={i}
                    onClick={() => setDate(d)}
                    className={`flex min-h-[60px] min-w-[56px] shrink-0 flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs transition ${active ? "border-primary bg-primary/10" : "border-border"}`}
                    aria-pressed={active}
                  >
                    <span>{format(d, "EEE")}</span>
                    <span className="text-base font-bold">{format(d, "d")}</span>
                  </button>
                );
              })}
            </div>
            {slots.length === 0 ? (
              <p className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground">{t("booking:noSlots")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s.toISOString()}
                    onClick={() => { setSlot(s); setStep(3); }}
                    className="flex min-h-[44px] items-center justify-center rounded-lg border border-border px-2 py-2 text-sm font-medium transition hover:border-primary hover:bg-primary/10"
                  >
                    {format(s, "HH:mm")}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && svc && slot && (
          <div className="pb-24 md:pb-0">
            <button className="mb-3 flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4" />{t("back")}</button>
            <h2 className="mb-4 font-display text-xl font-semibold">{t("booking:step3")}</h2>
            <Card>
              <CardContent className="space-y-3 p-4 md:p-6">
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium">{svc.name}</p>
                  <p className="text-xs text-muted-foreground">{format(slot, "EEEE d MMMM yyyy · HH:mm")} · {(svc.price_cents / 100).toFixed(2)} €</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label>{t("booking:yourFirstName")}</Label><Input className="h-11" required autoComplete="given-name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                  <div><Label>{t("booking:yourLastName")}</Label><Input className="h-11" required autoComplete="family-name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                </div>
                <div><Label>{t("booking:yourEmail")}</Label><Input className="h-11" type="email" required autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div>
                  <Label>{t("booking:yourPhone")}</Label>
                  <Input className="h-11" required autoComplete="tel" inputMode="tel" placeholder="+32 4xx xx xx xx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                {/* Honeypot — must remain empty */}
                <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] -top-[9999px] h-0 w-0 overflow-hidden opacity-0">
                  <label htmlFor="bk_website">Website</label>
                  <input
                    id="bk_website"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>
                <Button className="hidden h-12 w-full md:inline-flex" size="lg" onClick={confirm} disabled={loading}>
                  {loading ? t("loading") : t("booking:confirmBooking")}
                </Button>
              </CardContent>
            </Card>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur md:hidden">
              <Button className="h-12 w-full text-base" size="lg" onClick={confirm} disabled={loading}>
                {loading ? t("loading") : t("booking:confirmBooking")}
              </Button>
            </div>
          </div>
        )}

        {step === 4 && svc && slot && (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="font-display text-2xl font-bold">{t("booking:confirmedTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("booking:confirmedDesc")}</p>
            <div className="mx-auto mt-6 max-w-sm rounded-lg border border-border bg-card p-4 text-left text-sm">
              <p className="font-medium">{svc.name} — {org.name}</p>
              <p className="text-xs text-muted-foreground">{format(slot, "EEEE d MMMM yyyy · HH:mm")}</p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary/5 p-3 text-xs text-primary">
              <MessageSquare className="h-4 w-4" />
              {t("booking:smsNotice")}
            </div>
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <a href={calendarLink()} target="_blank" rel="noreferrer" className="w-full sm:w-auto">
                <Button variant="outline" className="h-11 w-full sm:w-auto">{t("booking:addToCalendar")}</Button>
              </a>
              <Button
                className="h-11 w-full sm:w-auto"
                onClick={() => { setStep(1); setSvc(null); setSlot(null); setForm({ first_name: "", last_name: "", email: "", phone: "" }); setHoneypot(""); }}
              >
                {t("booking:newBooking")}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function isSameDay2(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
