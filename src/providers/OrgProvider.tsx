import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role: "owner" | "editor" | "viewer";
}

interface OrgContextValue {
  orgs: OrgSummary[];
  activeOrg: OrgSummary | null;
  setActiveOrgId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);
const ACTIVE_KEY = "saascore.activeOrgId";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null)
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("memberships")
      .select("role, organization:organizations(id, name, slug, logo_url)")
      .eq("user_id", user.id);

    if (!error && data) {
      const list: OrgSummary[] = data
        .filter((m) => m.organization)
        .map((m) => ({
          id: (m.organization as { id: string }).id,
          name: (m.organization as { name: string }).name,
          slug: (m.organization as { slug: string }).slug,
          logo_url: (m.organization as { logo_url: string | null }).logo_url,
          role: m.role as OrgSummary["role"],
        }));
      setOrgs(list);
      if (list.length && (!activeId || !list.find((o) => o.id === activeId))) {
        setActiveId(list[0].id);
        localStorage.setItem(ACTIVE_KEY, list[0].id);
      }
    }
    setLoading(false);
  }, [user, activeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveOrgId = useCallback((id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }, []);

  const value = useMemo<OrgContextValue>(
    () => ({
      orgs,
      activeOrg: orgs.find((o) => o.id === activeId) ?? null,
      setActiveOrgId,
      loading,
      refresh: load,
    }),
    [orgs, activeId, setActiveOrgId, loading, load]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
