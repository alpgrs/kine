import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Stethoscope, Calendar, MessageSquare, Receipt, Globe, Check, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SanoBook — Agenda & facturation pour praticiens belges" },
      { name: "description", content: "Agenda en ligne, rappels SMS, facturation TVA belge (Art. 44). Pour kinés, ostéos, logopèdes. Aucune donnée médicale stockée." },
    ],
  }),
  component: Index,
});

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

function Index() {
  const { t } = useTranslation();
  const [annual, setAnnual] = useState(false);

  const soloPrice = annual ? t("landing:pricing.solo.priceAnnual") : t("landing:pricing.solo.priceMonthly");
  const fullPrice = annual ? t("landing:pricing.full.priceAnnual") : t("landing:pricing.full.priceMonthly");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/50 bg-background/90 px-6 py-4 backdrop-blur">
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
        {/* ── Hero ── */}
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
                <Button size="lg" className="h-12 gap-2 px-6">
                  {t("landing:hero.ctaPrimary")} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="h-12">
                  {t("landing:hero.ctaSecondary")}
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="px-6 py-20">
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

        {/* ── Testimonials ── */}
        <section className="bg-muted/30 px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("landing:testimonials.title")}
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {(["t1", "t2"] as const).map((key) => (
                <div key={key} className="surface-card flex flex-col gap-3 p-6">
                  <StarRating />
                  <p className="text-sm leading-relaxed text-foreground">
                    "{t(`landing:testimonials.${key}.text`)}"
                  </p>
                  <div>
                    <p className="text-sm font-semibold">{t(`landing:testimonials.${key}.name`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`landing:testimonials.${key}.role`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust / RGPD band ── */}
        <section className="border-y border-border px-6 py-14">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:gap-10">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Shield className="h-7 w-7" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-display text-xl font-bold">{t("landing:trust.title")}</h3>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                  {(t("landing:trust.items", { returnObjects: true }) as string[]).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold md:text-4xl">{t("landing:pricing.title")}</h2>
              <p className="mt-2 text-muted-foreground">{t("landing:pricing.subtitle")}</p>

              {/* Annual/Monthly toggle */}
              <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-border bg-muted/50 p-1">
                <button
                  onClick={() => setAnnual(false)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${!annual ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
                >
                  {t("landing:pricing.monthly")}
                </button>
                <button
                  onClick={() => setAnnual(true)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${annual ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
                >
                  {t("landing:pricing.annual")}
                  <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                    {t("landing:pricing.annualBadge")}
                  </span>
                </button>
              </div>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {(["solo", "full"] as const).map((p) => {
                const featuresRaw = t(`landing:pricing.${p}.features`, { returnObjects: true });
                const features = Array.isArray(featuresRaw) ? (featuresRaw as string[]) : [];
                const popular = p === "full";
                const price = p === "solo" ? soloPrice : fullPrice;
                const perMonthLabel = annual ? t("landing:pricing.perMonthBilled") : t("landing:pricing.perMonth");
                const anchor = annual
                  ? t("landing:pricing.valueAnchor", { price: p === "solo" ? "0.80" : "1.63" })
                  : t("landing:pricing.valueAnchor", { price: p === "solo" ? "0.95" : "1.93" });

                return (
                  <div key={p} className={`surface-card relative flex flex-col p-8 ${popular ? "ring-2 ring-primary" : ""}`}>
                    {popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        {t("landing:pricing.popular")}
                      </span>
                    )}
                    <h3 className="font-display text-xl font-bold">{t(`landing:pricing.${p}.name`)}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t(`landing:pricing.${p}.desc`)}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-5xl font-bold">{price}</span>
                      <span className="text-sm text-muted-foreground">{perMonthLabel}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{anchor}</p>
                    <ul className="mt-6 flex-1 space-y-2">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/signup" className="mt-6 block">
                      <Button className="w-full h-11" variant={popular ? "default" : "outline"}>
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

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-8">
        <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground md:flex-row md:justify-between">
          <span>© {new Date().getFullYear()} {t("appName")} · {t("landing:footer.madeIn")}</span>
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            {t("landing:footer.privacy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}
