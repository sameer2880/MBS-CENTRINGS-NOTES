import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#081020" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "M.B.S Centring Works" },
      { name: "description", content: "M.B.S Centring Works, Nereducherla." },
      { name: "google-site-verification", content: "google2ae77d07cfbf23ca.html" },
      { property: "og:title", content: "M.B.S Centring Works" },
      { property: "og:description", content: "M.B.S Centring Works, Nereducherla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
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

  useEffect(() => {
    const channel = supabase.channel("app-live-updates");

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rentals" },
      () => {
        void queryClient.invalidateQueries({ queryKey: ["rentals"] });
      },
    );

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "worker_attendance" },
      (payload) => {
        const workerId = (payload.new as { worker_id?: string } | null)?.worker_id ?? (payload.old as { worker_id?: string } | null)?.worker_id;
        void queryClient.invalidateQueries({ queryKey: ["worker_attendance"] });
        if (workerId) {
          void queryClient.invalidateQueries({ queryKey: ["worker_attendance", workerId] });
        }
      },
    );

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch((error) => {
          console.warn("Offline app support is unavailable", error);
        });
    }
  }, []);
  useEffect(() => {
    const recoveryKey = "mbs-dynamic-import-recovery";
    const isDynamicImportFailure = (message: string) =>
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed");
    const reloadOnce = (message: string) => {
      if (!isDynamicImportFailure(message)) return;
      try {
        if (sessionStorage.getItem(recoveryKey) === "1") {
          sessionStorage.removeItem(recoveryKey);
          return;
        }
        sessionStorage.setItem(recoveryKey, "1");
      } catch {
        return;
      }
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker?.getRegistrations();
          await Promise.all(registrations?.map((registration) => registration.unregister()) ?? []);
          const cacheNames = await caches?.keys();
          await Promise.all(cacheNames?.map((name) => caches.delete(name)) ?? []);
        } catch {
          // Continue with a cache-busting navigation if storage APIs are unavailable.
        }
        const url = new URL(window.location.href);
        url.searchParams.set("asset_refresh", String(Date.now()));
        window.location.replace(url.toString());
      })();
    };
    const onError = (event: ErrorEvent) => reloadOnce(event.message || event.error?.message || "");
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reloadOnce(typeof reason === "string" ? reason : (reason?.message ?? ""));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}