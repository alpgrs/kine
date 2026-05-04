import { type ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/providers/AuthProvider";
import { useOrg } from "@/providers/OrgProvider";

export function RequireAuth({ children, requireOrg = true }: { children: ReactNode; requireOrg?: boolean }) {
  const { loading, user } = useAuth();
  const { loading: orgLoading, orgs } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", search: { redirect: location.pathname } });
      return;
    }
    if (!orgLoading && requireOrg && orgs.length === 0 && location.pathname !== "/onboarding") {
      void navigate({ to: "/onboarding" });
    }
  }, [loading, user, orgLoading, orgs.length, requireOrg, location.pathname, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return <>{children}</>;
}
