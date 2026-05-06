import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/providers/AuthProvider";
import { OrgProvider } from "@/providers/OrgProvider";
import { I18nSync } from "@/providers/I18nSync";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold gradient-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "SaaS Core — Plateforme SaaS belge multitenant" },
      { name: "description", content: "Socle SaaS multitenant : auth, équipes, facturation, notifications. Conçu pour le marché belge." },
      { name: "theme-color", content: "#1f5fa8" },
      { property: "og:title", content: "SaaS Core — Plateforme SaaS belge multitenant" },
      { property: "og:description", content: "Socle SaaS multitenant : auth, équipes, facturation, notifications. Conçu pour le marché belge." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "SaaS Core — Plateforme SaaS belge multitenant" },
      { name: "twitter:description", content: "Socle SaaS multitenant : auth, équipes, facturation, notifications. Conçu pour le marché belge." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a134979d-11f7-47bb-8a36-15624c0cccf7/id-preview-66669edf--70b7d008-d543-4ad0-bfd2-98f330408d4c.lovable.app-1778080901023.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a134979d-11f7-47bb-8a36-15624c0cccf7/id-preview-66669edf--70b7d008-d543-4ad0-bfd2-98f330408d4c.lovable.app-1778080901023.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <OrgProvider>
          <I18nSync />
          <Outlet />
          <Toaster position="top-right" richColors />
        </OrgProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
