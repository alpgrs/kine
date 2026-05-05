import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Stethoscope, Calendar, MessageSquare, Receipt, Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SanoBook — Agenda & facturation pour praticiens belges" },
      { name: "description", content: "Agenda en ligne, rappels SMS, facturation TVA belge (Art. 44). Pour kinés, ostéos, logopèdes en Belgique." },
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-primary-foreground">
            <Stethoscope className="h-4 w-4" />
          </div>
          <span className="font-display text-xl font-bold">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link to="/login"><Button variant="ghost" size="sm">{t("auth:login")}</Button></Link>
          <Link to="/signup"><Button size="sm">{t("auth:signup")}</Button></Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-6 py-20 md:py-32">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-40"
            style={{
              background:
                "radial-gradient(60rem 40rem at 70% -10%, color-mix(in oklab, var(--primary) 35%, transparent), transparent), radial-gradient(40rem 30rem at -10% 30%, color-mix(in oklab, var(--accent) 25%, transparent), transparent)",
            }}
          />
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              {t("landing:hero.badge")}
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-tight md:text-6xl">
              {t("landing:hero.title")}{" "}
              <span className="gradient-text">{t("landing:hero.titleAccent")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
              {t("landing:hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="gap-2">
                  {t("landing:hero.ctaPrimary")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login"><Button size="lg" variant="outline">{t("landing:hero.ctaSecondary")}</Button></Link>
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold md:text-4xl">{t("landing:features.title")}</h2>
              <p className="mt-2 text-muted-foreground">{t("landing:features.subtitle")}</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Calendar, key: "calendar" },
                { icon: MessageSquare, key: "sms" },
                { icon: Receipt, key: "invoice" },
                { icon: Globe, key: "bilingual" },
              ].map((f) => (
                <div key={f.key} className="surface-card p-6">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{t(`landing:features.${f.key}.title`)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`landing:features.${f.key}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold md:text-4xl">{t("landing:pricing.title")}</h2>
              <p className="mt-2 text-muted-foreground">{t("landing:pricing.subtitle")}</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {(["solo", "full"] as const).map((p) => {
                const featuresRaw = t(`landing:pricing.${p}.features`, { returnObjects: true });
                const features = Array.isArray(featuresRaw) ? (featuresRaw as string[]) : [];
                const popular = p === "full";
                return (
                  <div key={p} className={`surface-card relative p-8 ${popular ? "ring-2 ring-primary" : ""}`}>
                    {popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        {t("landing:pricing.popular")}
                      </span>
                    )}
                    <h3 className="font-display text-xl font-bold">{t(`landing:pricing.${p}.name`)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(`landing:pricing.${p}.desc`)}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-5xl font-bold">{t(`landing:pricing.${p}.price`)}</span>
                      <span className="text-sm text-muted-foreground">{t("landing:pricing.perMonth")}</span>
                    </div>
                    <ul className="mt-6 space-y-2">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/signup" className="mt-6 block">
                      <Button className="w-full" variant={popular ? "default" : "outline"}>
                        {t(`landing:pricing.${p}.cta`)}
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("appName")} · {t("landing:footer.madeIn")}
      </footer>
    </div>
  );
}
