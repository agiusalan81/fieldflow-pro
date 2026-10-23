import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { OfflineStatus } from "@/components/offline-status";
import { registerOfflineApp } from "@/lib/pwa";
import { clearOfflineCache } from "@/lib/offline";
import { UserPreviewBoundary } from "@/components/user-preview";
import { clearUserPreview } from "@/lib/impersonation";
import { MemberAccessBoundary } from "@/components/member-access-boundary";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#ffffff" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "FieldBridge" },
      { name: "apple-mobile-web-app-title", content: "FieldBridge" },
      { name: "application-name", content: "FieldBridge" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "description", content: "Field service management" },
      { property: "og:title", content: "FieldBridge" },
      { property: "og:description", content: "Field service management" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..800;1,9..144,400..800&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Space+Grotesk:wght@400..700&family=Lora:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400&family=Archivo:ital,wght@0,400..800;1,400..800&display=swap" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/app-icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    // Stale chunk after an app update/dev re-optimisation: reload once instead of a blank screen.
    const onChunkError = (e: Event) => {
      const key = "chunk-reload-at";
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 10_000) return;
      e.preventDefault();
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(String(e.reason?.message ?? e.reason))) onChunkError(e);
    };
    window.addEventListener("vite:preloadError", onChunkError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("vite:preloadError", onChunkError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  useEffect(() => {
    void registerOfflineApp().catch(() => {});
    let accountId: string | undefined;
    void supabase.auth.getSession().then(({ data }) => { accountId = data.session?.user.id; });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") { clearUserPreview(); queryClient.clear(); if (accountId) void clearOfflineCache(accountId); accountId = undefined; }
      else { if (accountId && accountId !== session?.user.id) { clearUserPreview(); queryClient.clear(); } accountId = session?.user.id; queryClient.invalidateQueries(); }
      router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <OfflineStatus />
      <TooltipProvider><MemberAccessBoundary><UserPreviewBoundary><Outlet /></UserPreviewBoundary></MemberAccessBoundary></TooltipProvider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
