import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/providers/OrgProvider";

export const Route = createFileRoute("/account/organization")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <OrgPage />
      </AppShell>
    </RequireAuth>
  ),
});

function OrgPage() {
  const { t } = useTranslation();
  const { activeOrg, refresh } = useOrg();
  const [data, setData] = useState({
    name: "",
    address_street: "",
    address_city: "",
    address_postal_code: "",
    address_country: "BE",
    vat_number: "",
    logo_url: "",
  });
  const [loading, setLoading] = useState(false);
  const isOwner = activeOrg?.role === "owner";

  useEffect(() => {
    if (!activeOrg) return;
    void supabase
      .from("organizations")
      .select("*")
      .eq("id", activeOrg.id)
      .single()
      .then(({ data: o }) => {
        if (o) setData({
          name: o.name ?? "",
          address_street: o.address_street ?? "",
          address_city: o.address_city ?? "",
          address_postal_code: o.address_postal_code ?? "",
          address_country: o.address_country ?? "BE",
          vat_number: o.vat_number ?? "",
          logo_url: o.logo_url ?? "",
        });
      });
  }, [activeOrg]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrg) return;
    setLoading(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: data.name,
        address_street: data.address_street || null,
        address_city: data.address_city || null,
        address_postal_code: data.address_postal_code || null,
        address_country: data.address_country || null,
        vat_number: data.vat_number || null,
        logo_url: data.logo_url || null,
      })
      .eq("id", activeOrg.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      void refresh();
    }
  };

  const upload = async (file: File) => {
    if (!activeOrg) return;
    const ext = file.name.split(".").pop();
    const path = `${activeOrg.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("org-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("org-assets").getPublicUrl(path);
    setData((d) => ({ ...d, logo_url: pub.publicUrl }));
    toast.success("Logo téléchargé");
  };

  return (
    <>
      <PageHeader title={t("organization")} description="Coordonnées et facturation" />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Détails de l'organisation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                {data.logo_url ? (
                  <img src={data.logo_url} alt="logo" className="h-16 w-16 rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                    Logo
                  </div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!isOwner}
                    onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
                  />
                  <span className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
                    <Upload className="h-4 w-4" /> Charger
                  </span>
                </label>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Nom</Label>
              <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} disabled={!isOwner} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Adresse</Label>
              <Input value={data.address_street} onChange={(e) => setData({ ...data, address_street: e.target.value })} disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <Label>Code postal</Label>
              <Input value={data.address_postal_code} onChange={(e) => setData({ ...data, address_postal_code: e.target.value })} disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input value={data.address_city} onChange={(e) => setData({ ...data, address_city: e.target.value })} disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <Label>Pays</Label>
              <Input value={data.address_country} onChange={(e) => setData({ ...data, address_country: e.target.value })} disabled={!isOwner} />
            </div>
            <div className="space-y-2">
              <Label>N° TVA (BE0xxx.xxx.xxx)</Label>
              <Input
                value={data.vat_number}
                onChange={(e) => setData({ ...data, vat_number: e.target.value })}
                placeholder="BE0123.456.789"
                disabled={!isOwner}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading || !isOwner}>{loading ? t("loading") : t("save")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
