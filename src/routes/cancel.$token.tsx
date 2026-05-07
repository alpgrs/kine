import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { CheckCircle, XCircle, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cancel/$token")({
  component: CancelPage,
});

interface ApptInfo {
  id: string;
  patient_first_name: string;
  start_time: string;
  end_time: string;
  service_name: string;
  org_name: string;
  status: string;
}

type PageState = "loading" | "ready" | "notFound" | "alreadyCancelled" | "past" | "cancelled" | "error";

function CancelPage() {
  const { t } = useTranslation();
  const { token } = Route.useParams();
  const [appt, setAppt] = useState<ApptInfo | null>(null);
  const [state, setState] = useState<PageState>("loading");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.rpc("get_appointment_by_token", { _token: token });
      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        setState("notFound");
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      setAppt(row as ApptInfo);
      if (row.status === "cancelled") { setState("alreadyCancelled"); return; }
      if (row.status !== "scheduled" || new Date(row.start_time) <= new Date()) {
        setState("past");
        return;
      }
      setState("ready");
    })();
  }, [token]);

  const doCancel = async () => {
    setCancelling(true);
    const { data } = await supabase.rpc("cancel_appointment_by_token", { _token: token });
    setCancelling(false);
    if (data === true) { setState("cancelled"); }
    else { setState("error"); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b border-border px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
          <Stethoscope className="h-4 w-4" />
        </div>
        <span className="font-display text-lg font-bold">{t("appName")}</span>
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
        {state === "loading" && (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}

        {state === "notFound" && (
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-4 font-semibold">{t("cancel:notFound")}</p>
          </div>
        )}

        {(state === "alreadyCancelled" || state === "past") && (
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 font-semibold">
              {state === "alreadyCancelled" ? t("cancel:alreadyCancelled") : t("cancel:pastOrCompleted")}
            </p>
          </div>
        )}

        {state === "ready" && appt && (
          <Card className="w-full">
            <CardContent className="space-y-4 p-6">
              <h1 className="font-display text-xl font-bold">{t("cancel:title")}</h1>
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{appt.service_name}</p>
                <p className="text-muted-foreground">
                  {t("cancel:with")} {appt.org_name} · {t("cancel:at")} {format(new Date(appt.start_time), "EEEE d MMMM yyyy · HH:mm")}
                </p>
                <p className="mt-1 text-muted-foreground">{t("booking:yourFirstName")} : {appt.patient_first_name}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Cette action est définitive. Le praticien sera notifié.
              </p>
              <Button variant="destructive" className="w-full h-11" onClick={doCancel} disabled={cancelling}>
                {cancelling ? t("cancel:cancelling") : t("cancel:confirm")}
              </Button>
            </CardContent>
          </Card>
        )}

        {state === "cancelled" && (
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-success" />
            <h2 className="mt-4 font-display text-xl font-bold">{t("cancel:cancelledTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("cancel:cancelledDesc")}</p>
          </div>
        )}

        {state === "error" && (
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-4 font-semibold">{t("errors:networkError")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
