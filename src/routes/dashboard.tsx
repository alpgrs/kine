import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Receipt, TrendingUp, Users, Copy, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface Appt {
  id: string; patient_first_name: string; patient_last_name: string;
  start_time: string; end_time: string; service_id: string | null;
}

function DashboardPage() {
  const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const [today, setToday] = useState<Appt[]>([]);
  const [weekCount, setWeekCount] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [bookingSlug, setBookingSlug] = useState<string | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!activeOrg) return;
    void (async () => {
      const now = new Date();
      const wkStart = startOfWeek(now, { weekStartsOn: 1 });
      const wkEnd = endOfWeek(now, { weekStartsOn: 1 });

      const [{ data: tdy }, { data: wk }, { data: org }, { count: upcoming }] = await Promise.all([
        supabase.from("appointments").select("id,patient_first_name,patient_last_name,start_time,end_time,service_id")
          .eq("organization_id", activeOrg.id)
          .gte("start_time", startOfDay(now).toISOString())
          .lte("start_time", endOfDay(now).toISOString())
          .order("start_time"),
        supabase.from("appointments").select("id,service_id,status")
          .eq("organization_id", activeOrg.id)
          .gte("start_time", wkStart.toISOString())
          .lte("start_time", wkEnd.toISOString()),
        supabase.from("organizations").select("booking_slug").eq("id", activeOrg.id).maybeSingle(),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .eq("organization_id", activeOrg.id)
          .eq("status", "scheduled")
          .gte("start_time", now.toISOString()),
      ]);
      setToday((tdy ?? []) as Appt[]);
      setWeekCount(wk?.length ?? 0);
      setBookingSlug(org?.booking_slug ?? null);
      setUpcomingCount(upcoming ?? 0);

      // Compute revenue from week appointments (completed only)
      if (wk && wk.length) {
        const ids = wk.filter((a: any) => a.service_id && a.status === "completed").map((a: any) => a.service_id);
        if (ids.length) {
          const { data: svcs } = await supabase.from("services").select("id,price_cents").in("id", ids);
          const map = new Map((svcs ?? []).map((s: any) => [s.id, s.price_cents]));
          const total = wk.filter((a: any) => a.status === "completed").reduce((sum: number, a: any) => sum + (map.get(a.service_id) ?? 0), 0);
          setWeekRevenue(total);
        }
      }
    })();
  }, [activeOrg]);

  const bookingUrl = bookingSlug ? `${window.location.origin}/book/${bookingSlug}` : "";

  const copy = () => {
    if (!bookingUrl) return;
    void navigator.clipboard.writeText(bookingUrl);
    toast.success(t("dashboard:linkCopied"));
  };

  return (
    <>
      <PageHeader title={`${t("dashboard")} · ${activeOrg?.name ?? ""}`} description={format(new Date(), "EEEE d MMMM yyyy")} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard:todayAppointments")}</CardTitle><Calendar className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{today.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard:weekAppointments")}</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{weekCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard:weekRevenue")}</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-3xl font-bold">{(weekRevenue / 100).toFixed(0)} €</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("invoicing")}</CardTitle><Receipt className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><Link to="/invoicing"><Button variant="link" className="px-0">{t("open")}</Button></Link></CardContent></Card>
      </div>

      {upcomingCount === 0 ? (
        <div className="mt-6">
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center md:py-16">
              <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Calendar className="h-8 w-8" />
                <Sparkles className="absolute -right-2 -top-2 h-5 w-5 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold md:text-3xl">{t("dashboard:emptyTitle")}</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground md:text-base">{t("dashboard:emptyDesc")}</p>
              {bookingUrl ? (
                <div className="mt-6 w-full max-w-md">
                  <p className="break-all rounded-md border border-border bg-muted/50 p-3 text-xs">{bookingUrl}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button size="lg" className="h-11 gap-2" onClick={copy}>
                      <Copy className="h-4 w-4" />{t("dashboard:copyLink")}
                    </Button>
                    <a href={bookingUrl} target="_blank" rel="noreferrer" className="sm:w-auto">
                      <Button size="lg" variant="outline" className="h-11 w-full gap-2 sm:w-auto">
                        <ExternalLink className="h-4 w-4" />{t("dashboard:openLink")}
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <Link to="/settings" className="mt-6">
                  <Button size="lg" className="h-11">{t("dashboard:setupBookingLink")}</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>{t("dashboard:todayAppointments")}</CardTitle></CardHeader>
            <CardContent>
              {today.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("dashboard:noAppointmentsToday")}</p>
              ) : (
                <ul className="space-y-2">
                  {today.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="font-medium">{a.patient_first_name} {a.patient_last_name}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(a.start_time), "HH:mm")} – {format(new Date(a.end_time), "HH:mm")}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("dashboard:shareLink")}</CardTitle></CardHeader>
            <CardContent>
              {bookingUrl ? (
                <>
                  <p className="break-all rounded-md bg-muted p-2 text-xs">{bookingUrl}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={copy}><Copy className="h-3 w-3" />{t("dashboard:copyLink")}</Button>
                    <a href={bookingUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" className="gap-1"><ExternalLink className="h-3 w-3" />{t("dashboard:openLink")}</Button>
                    </a>
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
