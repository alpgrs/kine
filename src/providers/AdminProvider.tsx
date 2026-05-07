import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";

interface AdminContextValue {
  isSuperAdmin: boolean;
  loading: boolean;
}

const AdminContext = createContext<AdminContextValue>({ isSuperAdmin: false, loading: true });

export function AdminProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsSuperAdmin(false); setLoading(false); return; }
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", user.id)
        .maybeSingle();
      setIsSuperAdmin(!!(data as any)?.is_super_admin);
      setLoading(false);
    })();
  }, [user, authLoading]);

  return (
    <AdminContext.Provider value={{ isSuperAdmin, loading }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
