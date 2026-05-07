import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Stethoscope, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [{ title: "SanoBook — Politique de confidentialité" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useTranslation();

  const sections = [
    { title: t("landing:privacy.s1t"), content: t("landing:privacy.s1") },
    { title: t("landing:privacy.s2t"), content: t("landing:privacy.s2") },
    { title: t("landing:privacy.s3t"), content: t("landing:privacy.s3") },
    { title: t("landing:privacy.s4t"), content: t("landing:privacy.s4") },
    { title: t("landing:privacy.s5t"), content: t("landing:privacy.s5") },
    { title: t("landing:privacy.s6t"), content: t("landing:privacy.s6") },
    { title: t("landing:privacy.s7t"), content: t("landing:privacy.s7") },
    { title: t("landing:privacy.s8t"), content: t("landing:privacy.s8") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-primary-foreground">
            <Stethoscope className="h-4 w-4" />
          </div>
          <span className="font-display text-xl font-bold">{t("appName")}</span>
        </div>
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold">{t("landing:privacy.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("landing:privacy.lastUpdated")}</p>

        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.content}</p>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {t("appName")}
      </footer>
    </div>
  );
}
