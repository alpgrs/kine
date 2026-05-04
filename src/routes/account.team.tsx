import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trash2, UserPlus, Mail } from "lucide-react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/providers/OrgProvider";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/account/team")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <TeamPage />
      </AppShell>
    </RequireAuth>
  ),
});

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface Invite {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

function TeamPage() {
  const { t } = useTranslation();
  const { activeOrg } = useOrg();
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const isOwner = activeOrg?.role === "owner";

  const load = useCallback(async () => {
    if (!activeOrg) return;
    const { data: m } = await supabase
      .from("memberships")
      .select("id, user_id, role, profiles(email, first_name, last_name)")
      .eq("organization_id", activeOrg.id);
    if (m) {
      setMembers(
        m.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          role: row.role as Member["role"],
          email: (row.profiles as { email?: string })?.email ?? "—",
          first_name: (row.profiles as { first_name?: string })?.first_name ?? null,
          last_name: (row.profiles as { last_name?: string })?.last_name ?? null,
        }))
      );
    }
    if (isOwner) {
      const { data: inv } = await supabase
        .from("invitations")
        .select("id, email, role, status, created_at")
        .eq("organization_id", activeOrg.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (inv) setInvites(inv);
    }
  }, [activeOrg, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendInvite = async () => {
    if (!activeOrg) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteEmail)) {
      toast.error(t("auth:invalidEmail"));
      return;
    }
    const { error } = await supabase.from("invitations").insert({
      organization_id: activeOrg.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user!.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation créée. Le lien sera envoyé par email.");
    setInviteEmail("");
    setOpen(false);
    void load();
  };

  const updateRole = async (id: string, role: "owner" | "editor" | "viewer") => {
    const { error } = await supabase.from("memberships").update({ role }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      void load();
    }
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from("memberships").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(t("delete"));
      void load();
    }
  };

  const revokeInvite = async (id: string) => {
    await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    void load();
  };

  return (
    <>
      <PageHeader
        title={t("team")}
        description={`${members.length} membre${members.length > 1 ? "s" : ""}`}
        actions={
          isOwner ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="mr-2 h-4 w-4" /> Inviter</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Inviter un membre</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t("auth:email")}</Label>
                    <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "editor" | "viewer")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button onClick={() => void sendInvite()}>Envoyer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Membres</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>{t("auth:email")}</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="w-1" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {[m.first_name, m.last_name].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    {isOwner && m.user_id !== user?.id ? (
                      <Select value={m.role} onValueChange={(v) => void updateRole(m.id, v as "owner" | "editor" | "viewer")}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{m.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isOwner && m.user_id !== user?.id && (
                      <Button size="icon" variant="ghost" onClick={() => void removeMember(m.id)} aria-label="Remove">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isOwner && invites.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{i.email}</span>
                    <Badge variant="outline">{i.role}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void revokeInvite(i.id)}>
                    Révoquer
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
