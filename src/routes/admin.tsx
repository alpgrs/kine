import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  Building2, Users, Calendar as CalendarIcon, Receipt, TrendingUp, Search,
  ShieldCheck, ShieldOff, RefreshCw, AlertCircle, ExternalLink, CreditCard, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireSuperAdmin } from "@/components/RequireSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireAuth requireOrg={false}>
      <RequireSuperAdmin>
        <AppShell>
          <AdminPage />
        </AppShell>
      </RequireSuperAdmin>
    </RequireAuth>
  ),
});

interface Stats {
  organizations_count: number;
  users_count: number;
  appointments_total: number;
  appointments_30d: number;
  appointments_upcoming: number;
  invoices_count: number;
  revenue_total_cents: number;
  revenue_30d_cents: number;
  subs_active: number;
  subs_past_due: number;
  orgs_signups_30d: number;
}

interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  booking_slug: string | null;
  professional_title: string | null;
  inami_number: string | null;
  vat_exempt: boolean;
  created_at: string;
  member_count: number;
  appointments_count: number;
  invoices_count: number;
  revenue_cents: number;
  sub_status: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  language: string;
  is_super_admin: boolean;
  created_at: string;
  org_count: number;
}

const cents = (n: number) => `${(n / 100).toLocaleString("fr-BE", { maximumFractionDigits: 0 })} €`;

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgQuery, setOrgQuery] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoadError(false); setLoading(true);
    const [{ data: s, error: e1 }, { data: o, error: e2 }, { data: u, error: e3 }] = await Promise.all([
      supabase.rpc("admin_global_stats"),
      supabase.rpc("admin_list_organizations"),
      supabase.rpc("admin_list_users"),
    ]);
    setLoading(false);
    if (e1 || e2 || e3) { setLoadError(true); return; }
    setStats(s as Stats);
    setOrgs((o ?? []) as AdminOrg[]);
    setUsers((u ?? []) as AdminUser[]);
  };
  useEffect(() => { void load(); }, []);

  const filteredOrgs = useMemo(() => {
    const q = orgQuery.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      o.slug?.toLowerCase().includes(q) ||
      o.booking_slug?.toLowerCase().includes(q) ||
      o.inami_number?.toLowerCase().includes(q)
    );
  }, [orgs, orgQuery]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.email.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  const toggleSuperAdmin = async (u: AdminUser) => {
    if (u.id === user?.id && u.is_super_admin) {
      toast.error(t("admin:cannotDemoteSelf"));
      return;
    }
    const next = !u.is_super_admin;
    const { error } = await supabase.rpc("admin_set_super_admin", { _user_id: u.id, _value: next });
    if (error) { toast.error(error.message); return; }
    toast.success(next ? t("admin:promoted") : t("admin:demoted"));
    void load();
  };

  const deleteOrg = async (org: AdminOrg) => {
    if (!confirm(t("admin:deleteOrgConfirm", { name: org.name }))) return;
    const { error } = await supabase.from("organizations").delete().eq("id", org.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("admin:orgDeleted"));
    void load();
  };

  if (loadError) {
    return (
      <>
        <PageHeader title={t("admin:title")} />
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
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t("admin:title")}
          </span>
        }
        description={t("admin:subtitle")}
        actions={
          <Button size="sm" variant="outline" className="gap-1" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />{t("admin:refresh")}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard icon={Building2} label={t("admin:stats.orgs")} value={String(stats?.organizations_count ?? "—")}
          hint={stats ? t("admin:stats.orgsHint", { count: stats.orgs_signups_30d }) : ""} />
        <StatCard icon={Users} label={t("admin:stats.users")} value={String(stats?.users_count ?? "—")} />
        <StatCard icon={CalendarIcon} label={t("admin:stats.appointments")} value={String(stats?.appointments_total ?? "—")}
          hint={stats ? t("admin:stats.last30d", { count: stats.appointments_30d }) : ""} />
        <StatCard icon={CalendarIcon} label={t("admin:stats.upcoming")} value={String(stats?.appointments_upcoming ?? "—")} />
        <StatCard icon={Receipt} label={t("admin:stats.invoices")} value={String(stats?.invoices_count ?? "—")} />
        <StatCard icon={TrendingUp} label={t("admin:stats.revenue")} value={stats ? cents(stats.revenue_total_cents) : "—"}
          hint={stats ? `30j : ${cents(stats.revenue_30d_cents)}` : ""} />
        <StatCard icon={CreditCard} label={t("admin:stats.subsActive")} value={String(stats?.subs_active ?? "—")} />
        <StatCard icon={CreditCard} label={t("admin:stats.subsPastDue")} value={String(stats?.subs_past_due ?? "—")} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orgs" className="mt-6">
        <TabsList>
          <TabsTrigger value="orgs"><Building2 className="mr-1 h-4 w-4" />{t("admin:tabs.orgs")}</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-1 h-4 w-4" />{t("admin:tabs.users")}</TabsTrigger>
        </TabsList>

        {/* Organizations */}
        <TabsContent value="orgs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t("admin:orgs.title")} ({filteredOrgs.length})</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8 h-9" placeholder={t("admin:orgs.searchPh")}
                  value={orgQuery} onChange={(e) => setOrgQuery(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredOrgs.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("admin:orgs.empty")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin:orgs.name")}</TableHead>
                        <TableHead>{t("admin:orgs.specialty")}</TableHead>
                        <TableHead>INAMI</TableHead>
                        <TableHead>TVA</TableHead>
                        <TableHead className="text-right">{t("admin:orgs.members")}</TableHead>
                        <TableHead className="text-right">RDV</TableHead>
                        <TableHead className="text-right">{t("admin:orgs.invoices")}</TableHead>
                        <TableHead className="text-right">{t("admin:orgs.revenue")}</TableHead>
                        <TableHead>{t("admin:orgs.sub")}</TableHead>
                        <TableHead>{t("admin:orgs.created")}</TableHead>
                        <TableHead className="text-right">{t("admin:orgs.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrgs.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{o.name}</span>
                              {o.booking_slug && (
                                <span className="text-[11px] text-muted-foreground">/book/{o.booking_slug}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{o.professional_title ?? "—"}</TableCell>
                          <TableCell className="text-xs">{o.inami_number ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={o.vat_exempt ? "secondary" : "default"} className="text-[10px]">
                              {o.vat_exempt ? "Art. 44" : "21%"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{Number(o.member_count)}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(o.appointments_count)}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(o.invoices_count)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{cents(Number(o.revenue_cents))}</TableCell>
                          <TableCell>
                            {o.sub_status ? (
                              <Badge variant={o.sub_status === "active" || o.sub_status === "trialing" ? "default" : "destructive"} className="text-[10px]">
                                {o.sub_status}
                              </Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {o.booking_slug && (
                                <Link to="/book/$slug" params={{ slug: o.booking_slug }} target="_blank">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={t("admin:orgs.openBooking")}>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              )}
                              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => void deleteOrg(o)}>
                                {t("admin:orgs.delete")}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">{t("admin:users.title")} ({filteredUsers.length})</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8 h-9" placeholder={t("admin:users.searchPh")}
                  value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredUsers.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("admin:users.empty")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>{t("admin:users.name")}</TableHead>
                        <TableHead>{t("admin:users.lang")}</TableHead>
                        <TableHead className="text-right">{t("admin:users.orgCount")}</TableHead>
                        <TableHead>{t("admin:users.role")}</TableHead>
                        <TableHead>{t("admin:users.created")}</TableHead>
                        <TableHead className="text-right">{t("admin:users.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium text-sm">{u.email}</TableCell>
                          <TableCell className="text-sm">
                            {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                          </TableCell>
                          <TableCell className="text-xs uppercase">{u.language}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(u.org_count)}</TableCell>
                          <TableCell>
                            {u.is_super_admin
                              ? <Badge className="gap-1 bg-primary/10 text-primary"><ShieldCheck className="h-3 w-3" />Super admin</Badge>
                              : <Badge variant="secondary" className="text-[10px]">{t("admin:users.user")}</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(u.created_at), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              disabled={u.id === user?.id && u.is_super_admin}
                              onClick={() => void toggleSuperAdmin(u)}
                            >
                              {u.is_super_admin
                                ? <><ShieldOff className="h-3 w-3" />{t("admin:users.demote")}</>
                                : <><ShieldCheck className="h-3 w-3" />{t("admin:users.promote")}</>}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
