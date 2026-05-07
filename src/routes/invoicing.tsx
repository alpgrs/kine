import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Receipt, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [pendingConfirm, setPendingConfirm] = useState<ApptRow | null>(null);
  const [previewInv, setPreviewInv] = useState<Inv | null>(null);

  const load = async () => {
    if (!activeOrg) return;
    const { data: orgData } = await supabase.from("organizations").select("*").eq("id", activeOrg.id).maybeSingle();
    setOrg(orgData);

    const { data: invs } = await supabase.from("invoices").select("*")
      .eq("organization_id", activeOrg.id).order("issued_at", { ascending: false });
    setInvoices((invs ?? []) as Inv[]);

    const billedAppts = new Set((invs ?? []).map((i: any) => i.line_items?.[0]?.appointment_id).filter(Boolean));
    const { data: appts } = await supabase.from("appointments")
      .select("id,patient_first_name,patient_last_name,patient_email,start_time,service:services(name,price_cents)")
      .eq("organization_id", activeOrg.id).eq("status", "completed").order("start_time", { ascending: false });
    setPending(((appts ?? []) as any).filter((a: ApptRow) => !billedAppts.has(a.id)));
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [activeOrg]);

  const buildDraftInvoice = (a: ApptRow): Inv => {
    const amount = a.service?.price_cents ?? 0;
    const vatExempt = !!org?.vat_exempt;
    return {
      id: "draft",
      number: "DRAFT",
      amount,
      status: "draft",
      issued_at: new Date().toISOString(),
      patient_name: `${a.patient_first_name} ${a.patient_last_name}`,
      vat_exempt: vatExempt,
      inami_number: org?.inami_number ?? null,
      line_items: [{ appointment_id: a.id, description: a.service?.name ?? "", qty: 1, unit_price_cents: amount }],
    };
  };

  const buildPdf = (inv: Inv): jsPDF => {
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
      doc.text(`${t("invoicing:vat")} 21%:`, 130, y); doc.text(`${(inv.amount - inv.amount / 1.21).toFixed(2)} €`, 170, y); y += 6;
    }
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text(`${t("invoicing:total")}: ${(inv.amount / 100).toFixed(2)} €`, 130, y + 4);
    doc.setFont("helvetica", "normal");

    if (inv.vat_exempt) {
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const noticeY = pageHeight - 20;
      doc.setDrawColor(200);
      doc.line(20, noticeY - 6, pageWidth - 20, noticeY - 6);
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.setFont("helvetica", "italic");
      const note = t("invoicing:vatExemptNotice");
      const split = doc.splitTextToSize(note, pageWidth - 40);
      doc.text(split, pageWidth / 2, noticeY, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
    }

    if (inv.number === "DRAFT") {
      doc.setTextColor(220, 220, 220);
      doc.setFontSize(60);
      doc.setFont("helvetica", "bold");
      // @ts-ignore
      doc.text("APERÇU", 105, 160, { align: "center", angle: 30 });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
    }

    return doc;
  };

  const openPreview = (inv: Inv, appt?: ApptRow) => {
    const doc = buildPdf(inv);
    const url = doc.output("bloburl") as unknown as string;
    setPreviewUrl(url.toString());
    setPreviewTitle(inv.number === "DRAFT" ? `${t("invoicing:preview")} — ${inv.patient_name}` : inv.number);
    setPendingConfirm(appt ?? null);
    setPreviewInv(inv);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPendingConfirm(null);
    setPreviewInv(null);
  };

  const downloadPdf = (inv: Inv) => {
    const doc = buildPdf(inv);
    doc.save(`${inv.number}.pdf`);
  };

  const generateInvoice = async (a: ApptRow) => {
    if (!activeOrg || !a.service) return;
    const amount = a.service.price_cents;
    const vatExempt = !!org?.vat_exempt;
    const vatRate = vatExempt ? 0 : 21;
    const amountExcl = vatExempt ? amount : Math.round(amount / 1.21);
    const vatAmount = amount - amountExcl;

    const { data: numData } = await supabase.rpc("generate_invoice_number");
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
    closePreview();
    void load();
    downloadPdf(inv as Inv);
  };

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
                    <li key={a.id} className="flex items-center justify-between gap-2 p-4">
                      <div>
                        <p className="font-medium">{a.patient_first_name} {a.patient_last_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.service?.name} · {format(new Date(a.start_time), "dd/MM/yyyy")} · {((a.service?.price_cents ?? 0) / 100).toFixed(2)} €
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openPreview(buildDraftInvoice(a), a)}>
                          <Eye className="h-3 w-3" />{t("invoicing:preview")}
                        </Button>
                        <Button size="sm" className="gap-1" onClick={() => generateInvoice(a)}>
                          <Receipt className="h-3 w-3" />{t("invoicing:generateInvoice")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="issued">
          <Card>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("invoicing:noInvoices")}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {invoices.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 p-4">
                      <div>
                        <p className="font-medium">{i.number}</p>
                        <p className="text-xs text-muted-foreground">{i.patient_name} · {format(new Date(i.issued_at), "dd/MM/yyyy")} · {(i.amount / 100).toFixed(2)} €</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => openPreview(i)}>
                          <Eye className="h-3 w-3" />{t("invoicing:preview")}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadPdf(i)}>
                          <Download className="h-3 w-3" />PDF
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && closePreview()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="h-[70vh] w-full rounded border" title="PDF preview" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closePreview}>{t("common:close")}</Button>
            {pendingConfirm && (
              <Button onClick={() => generateInvoice(pendingConfirm)} className="gap-1">
                <Receipt className="h-3 w-3" />{t("invoicing:confirmAndGenerate")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
