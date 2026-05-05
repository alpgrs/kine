import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Stethoscope, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: (s.redirect as string) ?? "/dashboard" }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) void navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(t("auth:invalidEmail"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("auth:loginSuccess"));
  };

  return (
    <AuthShell title={t("auth:loginTitle")} subtitle={t("auth:loginSubtitle")}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth:email")}</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.be" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth:password")}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t("auth:forgotPassword")}</Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("loading") : t("auth:signInBtn")}
        </Button>
        <p className="pt-2 text-center text-xs text-muted-foreground">
          {t("auth:noAccount")}{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">{t("auth:signup")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-30"
        style={{
          background:
            "radial-gradient(60rem 40rem at 80% 0%, color-mix(in oklab, var(--primary) 35%, transparent), transparent)",
        }}
      />
      <header className="flex items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{t("back")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col items-center px-6 pb-24 pt-12">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-bold">{t("appName")}</span>
        </div>
        <div className="surface-card w-full p-6 md:p-8">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
