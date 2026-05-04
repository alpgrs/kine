import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Sparkles, ShieldCheck, Globe, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SaaS Core — Plateforme SaaS multitenant pour la Belgique" },
      {
        name: "description",
        content:
          "Authentification multi-tenant, facturation TVA conforme, notifications email & SMS, multilingue FR/NL/EN.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link to="/login">
            <Button variant="ghost" size="sm">{t("auth:login")}</Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">{t("auth:signup")}</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 py-24 md:py-32">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-30"
            style={{
              background:
                "radial-gradient(60rem 40rem at 70% -10%, color-mix(in oklab, var(--primary) 35%, transparent), transparent), radial-gradient(40rem 30rem at -10% 30%, color-mix(in oklab, var(--accent) 25%, transparent), transparent)",
            }}
          />
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              Built for the Belgian market — FR · NL · EN
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">
              <span className="gradient-text">{t("appName")}</span>
              <br />
              {t("tagline")}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              Le socle technique pour vos applications verticales : prise de rendez-vous, gestion de chantier, simulateur de primes. Multi-tenant, sécurisé, conforme TVA belge.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="gap-2">
                  {t("auth:signup")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">{t("auth:login")}</Button>
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-20 grid max-w-5xl gap-4 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Auth multi-tenant", desc: "Magic link, rôles owner/editor/viewer, RLS strict." },
              { icon: CreditCard, title: "TVA belge BE0xxx", desc: "Facturation conforme, n° séquentiel F-YYYY-XXXX." },
              { icon: Globe, title: "FR · NL · EN", desc: "Détection auto, traductions emails et UI." },
            ].map((f) => (
              <div key={f.title} className="surface-card p-6">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("appName")}
      </footer>
    </div>
  );
}
