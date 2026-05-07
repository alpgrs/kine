import { type ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAdmin } from "@/providers/AdminProvider";
import { useAuth } from "@/providers/AuthProvider";

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { loading: authLoading, user } = useAuth();
  const { loading, isSuperAdmin } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || loading) return;
    if (!user) { void navigate({ to: "/login" }); return; }
    if (!isSuperAdmin) { void navigate({ to: "/dashboard" }); }
  }, [authLoading, loading, user, isSuperAdmin, navigate]);

  if (authLoading || loading || !user || !isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}
