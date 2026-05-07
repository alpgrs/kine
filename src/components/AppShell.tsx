import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Settings,
  Users,
  Calendar,
  Receipt,
  LogOut,
  Stethoscope,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OrgSwitcher } from "./OrgSwitcher";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/providers/AuthProvider";
import { useAdmin } from "@/providers/AdminProvider";
import { NotificationsBell } from "./NotificationsBell";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { to: "/agenda", labelKey: "agenda", icon: Calendar },
  { to: "/patients", labelKey: "patients", icon: Users },
  { to: "/invoicing", labelKey: "invoicing", icon: Receipt },
  { to: "/settings", labelKey: "settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useAdmin();

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
            <Stethoscope className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold">{t("appName")}</span>
        </div>

        <div className="px-4 pb-4">
          <OrgSwitcher />
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}

          {isSuperAdmin && (
            <>
              <div className="my-3 border-t border-sidebar-border/60" />
              <Link
                to="/admin"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  location.pathname.startsWith("/admin")
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                <Sparkles className="h-4 w-4" />
                {t("admin:title")}
              </Link>
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/login" });
              }}
              aria-label={t("logout")}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="md:hidden flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md gradient-primary text-primary-foreground">
              <Stethoscope className="h-3.5 w-3.5" />
            </div>
            <span className="font-display text-sm font-bold">{t("appName")}</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>

        {/* Bottom nav (mobile) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur md:hidden"
          aria-label="Mobile"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
