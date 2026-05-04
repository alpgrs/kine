import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/account/profile")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <ProfilePage />
      </AppShell>
    </RequireAuth>
  ),
});

function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState({ first_name: "", last_name: "", phone: "", language: "fr" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("first_name, last_name, phone, language")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data: p }) => {
        if (p) {
          setData({
            first_name: p.first_name ?? "",
            last_name: p.last_name ?? "",
            phone: p.phone ?? "",
            language: p.language ?? "fr",
          });
        }
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        language: data.language as "fr" | "nl" | "en",
      })
      .eq("id", user.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      void i18n.changeLanguage(data.language);
    }
  };

  return (
    <>
      <PageHeader title={t("profile")} description="Gérez vos informations personnelles" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fn">Prénom</Label>
              <Input id="fn" value={data.first_name} onChange={(e) => setData({ ...data, first_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ln">Nom</Label>
              <Input id="ln" value={data.last_name} onChange={(e) => setData({ ...data, last_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("auth:email")}</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ph">Téléphone</Label>
              <Input id="ph" type="tel" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t("language")}</Label>
              <Select value={data.language} onValueChange={(v) => setData({ ...data, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="nl">Nederlands</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={loading}>{loading ? t("loading") : t("save")}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
