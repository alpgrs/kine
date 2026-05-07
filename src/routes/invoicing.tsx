import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Receipt, Download, FileDown, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrg } from "@/providers/OrgProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/invoicing")({
  component: () => (
    <RequireAuth><AppShell><InvoicingPage /></AppShell></RequireAuth>
  ),
});

interface ApptRow {
  id: string; patient_first_name: string; patient_last_name: string; patient_email: string;
  start_time: string; service: { name: string; price_cents: number } | null;
}
interface Inv {
  id: string; number: string; amount: number; status: string; issued_at: string;
  patient_name: string | null; vat_exempt: boolean; inami_number: string | null;
  line_items: any;
}

function InvoicingPage() {
  const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const [pending, setPending] = useState<ApptRow[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);

  const load = async () => {
    setLoadError(false);
    if (!activeOrg) return;
    const [{ data: orgData, error: orgErr }, { data: invs, error: invErr }] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", activeOrg.id).maybeSingle(),
      supabase.from("invoices").select("*").eq("organization_id", activeOrg.id).order("issued_at", { ascending: false }),
    ]);
    if (orgErr || invErr) { setLoadError(true); return; }
    setOrg(orgData);
    setInvoices((invs ?? []) as Inv[]);

    const billedAppts = new Set((invs ?? []).map((i: any) => i.line_items?.[0]?.appointment_id).filter(Boolean));
    const { data: appts, error: apptErr } = await supabase.from("appointments")
      .select("id,patient_first_name,patient_last_name,patient_email,start_time,service:services(name,price_cents)")
      .eq("organization_id", activeOrg.id).eq("status", "completed").order("start_time", { ascending: false });
    if (apptErr) { setLoadError(true); return; }
    setPending(((appts ?? []) as any).filter((a: ApptRow) => !billedAppts.has(a.id)));
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [activeOrg]);

  const generateInvoice = async (a: ApptRow) => {
    if (!activeOrg || !a.service) return;
    const amount = a.service.price_cents;
    const vatExempt = !!org?.vat_exempt;
    const vatRate = vatExempt ? 0 : 21;
    const amountExcl = vatExempt ? amount : Math.round(amount / 1.21);
    const vatAmount = amount - amountExcl;

    const { data: numData } = await supabase.rpc("generate_invoice_number", { _org_id: activeOrg.id });
    const number = numData as unknown as string;

    const { data: inv, error } = await supabase.from("invoices").insert({
      organization_id: activeOrg.id, number, amount, amount_excl_vat: amountExcl,
      vat_amount: vatAmount, vat_rate: vatRate, status: "open",
      patient_name: `${a.patient_first_name} ${a.patient_last_name}`,
      patient_email: a.patient_email, vat_exempt: vatExempt, inami_number: org?.inami_number ?? null,
      line_items: [{ appointment_id: a.id, description: a.service.name, qty: 1, unit_price_cents: amount }],
    }).select().single();
    if (error || !inv) return toast.error(error?.message ?? "Error");
    toast.success(t("invoicing:createdSuccess", { number }));
    void load();
    downloadPdf(inv as Inv);
  };

  const exportCsv = () => {
    const rows = [
      ["N° Facture", "Date", "Patient", "Prestation", "Montant HT (€)", "TVA (%)", "TVA (€)", "Total TTC (€)", "Statut"],
      ...invoices.map((i) => {
        const li = (i.line_items as any[])[0];
        const exclVat = (i.amount / (1 + (i as any).vat_rate / 100) / 100).toFixed(2);
        const vatAmt = (i.amount / 100 - parseFloat(exclVat)).toFixed(2);
        return [
          i.number,
          format(new Date(i.issued_at), "dd/MM/yyyy"),
          i.patient_name ?? "",
          li?.description ?? "",
          i.vat_exempt ? (i.amount / 100).toFixed(2) : exclVat,
          i.vat_exempt ? "0" : String((i as any).vat_rate ?? 21),
          i.vat_exempt ? "0.00" : vatAmt,
          (i.amount / 100).toFixed(2),
          i.status,
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `factures-${format(new Date(), "yyyy-MM")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const downloadPdf = async (inv: Inv) => {
    const doc = new jsPDF();
    const o = org;
    doc.setFontSize(20); doc.text(o?.name ?? "", 20, 25);
    doc.setFontSize(10); doc.setTextColor(120);
    if (o?.professional_title) doc.text(String(o.professional_title), 20, 32);
    if (o?.address_street) doc.text(`${o.address_street}, ${o.address_postal_code ?? ""} ${o.address_city ?? ""}`, 20, 38);
    if (inv.inami_number) doc.text(`${t("invoicing:inami")}: ${inv.inami_number}`, 20, 44);
    if (o?.vat_number && !inv.vat_exempt) doc.text(`TVA: ${o.vat_number}`, 20, 50);

    doc.setTextColor(0); doc.setFontSize(16);
    doc.text(`Facture ${inv.number}`, 140, 25);
    doc.setFontSize(10);
    doc.text(format(new Date(inv.issued_at), "dd/MM/yyyy"), 140, 32);

    doc.setFontSize(11); doc.text(t("invoicing:patient") + ":", 20, 70);
    doc.setFontSize(10); doc.text(inv.patient_name ?? "", 20, 76);

    // Table header
    doc.setFillColor(240, 240, 240); doc.rect(20, 90, 170, 8, "F");
    doc.setFontSize(10); doc.text(t("invoicing:service"), 22, 96); doc.text(t("invoicing:amount"), 170, 96);

    let y = 106;
    (inv.line_items as any[]).forEach((li) => {
      doc.text(String(li.description), 22, y);
      doc.text(`${(li.unit_price_cents / 100).toFixed(2)} €`, 170, y);
      y += 7;
    });

    y += 10;
    if (!inv.vat_exempt) {
      doc.text(`${t("invoicing:subtotal")}:`, 130, y); doc.text(`${(inv.amount / 1.21).toFixed(2)} €`, 170, y); y += 6;
      doc.text(`${t("invoicing:vat")} 21%:`, 130, y); doc.text(`${(inv.amount - inv.amount/1.21).toFixed(2)} €`, 170, y); y += 6;
    }
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`${t("invoicing:total")}: ${(inv.amount / 100).toFixed(2)} €`, 130, y + 4);
    doc.setFont("helvetica", "normal");

    if (inv.vat_exempt) {
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const noticeY = pageHeight - 18;
      doc.setDrawColor(220);
      doc.line(20, noticeY - 7, pageWidth - 20, noticeY - 7);
      doc.setFontSize(9);
      doc.setTextColor(130);
      doc.setFont("helvetica", "italic");
      const note = "Prestation de soins de santé dispensée de TVA conformément à l'Article 44 du Code de la TVA.";
      const split = doc.splitTextToSize(note, pageWidth - 40);
      doc.text(split, pageWidth / 2, noticeY, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
    }

    // Store PDF in Supabase storage (private invoices bucket) and update pdf_url
    if (org?.id) {
      try {
        const pdfBuffer = doc.output("arraybuffer");
        const path = `${org.id}/${inv.number}.pdf`;
        const { error: uploadErr } = await supabase.storage.from("invoices").upload(path, pdfBuffer, {
          contentType: "application/pdf", upsert: true,
        });
        if (!uploadErr) {
          await supabase.from("invoices").update({ pdf_url: path }).eq("id", inv.id);
          toast.success(t("invoicing:pdfSaved"));
        } else {
          toast.warning(t("invoicing:pdfSaveError"));
        }
      } catch {
        toast.warning(t("invoicing:pdfSaveError"));
      }
    }
    doc.save(`${inv.number}.pdf`);
  };

  if (loadError) {
    return (
      <>
        <PageHeader title={t("invoicing:title")} />
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
      <PageHeader title={t("invoicing:title")} />
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">{t("invoicing:pendingInvoicing")} ({pending.length})</TabsTrigger>
          <TabsTrigger value="issued">{t("invoicing:issued")} ({invoices.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
              {pending.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("invoicing:noPending")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {pending.map((a) => (
                    <li key={a.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">{a.patient_first_name} {a.patient_last_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.service?.name} · {format(new Date(a.start_time), "dd/MM/yyyy")} · {((a.service?.price_cents ?? 0) / 100).toFixed(2)} €
                        </p>
                      </div>
                      <Button size="sm" className="gap-1" onClick={() => generateInvoice(a)}>
                        <Receipt className="h-3 w-3" />{t("invoicing:generateInvoice")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="issued">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{t("invoicing:issued")} ({invoices.length})</CardTitle>
              {invoices.length > 0 && (
                <Button size="sm" variant="outline" className="gap-1" onClick={exportCsv}>
                  <FileDown className="h-3 w-3" />{t("invoicing:exportCsv")}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("invoicing:noInvoices")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {invoices.map((i) => (
                    <li key={i.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">{i.number}</p>
                        <p className="text-xs text-muted-foreground">{i.patient_name} · {format(new Date(i.issued_at), "dd/MM/yyyy")} · {(i.amount / 100).toFixed(2)} €</p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => void downloadPdf(i)}>
                        <Download className="h-3 w-3" />PDF
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
