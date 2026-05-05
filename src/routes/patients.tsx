import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrg } from "@/providers/OrgProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/patients")({
  component: () => (
    <RequireAuth><AppShell><PatientsPage /></AppShell></RequireAuth>
  ),
});

interface PatientRow {
  email: string; first_name: string; last_name: string; phone: string | null;
  visits: number; last_visit: string;
}

function PatientsPage() {
  const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const [rows, setRows] = useState<PatientRow[]>([]);

  useEffect(() => {
    if (!activeOrg) return;
    void (async () => {
      const { data } = await supabase.from("appointments")
        .select("patient_email,patient_first_name,patient_last_name,patient_phone,start_time")
        .eq("organization_id", activeOrg.id)
        .order("start_time", { ascending: false });
      const map = new Map<string, PatientRow>();
      (data ?? []).forEach((a: any) => {
        const key = a.patient_email.toLowerCase();
        const ex = map.get(key);
        if (ex) { ex.visits += 1; }
        else map.set(key, {
          email: a.patient_email, first_name: a.patient_first_name, last_name: a.patient_last_name,
          phone: a.patient_phone, visits: 1, last_visit: a.start_time,
        });
      });
      setRows(Array.from(map.values()));
    })();
  }, [activeOrg]);

  return (
    <>
      <PageHeader title={t("patients:title")} description={t("patients:totalCount", { count: rows.length })} />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t("patients:noPatients")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("phone")}</TableHead>
                  <TableHead>{t("patients:totalVisits")}</TableHead>
                  <TableHead>{t("patients:lastVisit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.email}>
                    <TableCell className="font-medium">{r.first_name} {r.last_name}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>{r.phone ?? "—"}</TableCell>
                    <TableCell>{r.visits}</TableCell>
                    <TableCell>{format(new Date(r.last_visit), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
