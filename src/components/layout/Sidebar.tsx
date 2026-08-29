import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  FileBarChart,
  Receipt,
  Menu,
  Moon,
  Sun,
  LogOut,
  NotebookPen,
  Film,
  HardHat,
  RefreshCw,
  Globe,
  Instagram,
  Youtube,
  MessageCircle,
  Phone,
  MapPin,
  MapPinned,
  MessageSquare,
  UserCog,
  ChevronDown,
  Compass,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";

import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { WorkerLocationToggle } from "@/components/WorkerLocationToggle";
import logo from "@/assets/logo.png";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { lock } from "@/lib/gate";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_ID_KEY, ADMIN_ID_KEY } from "@/lib/worker-auth";
import { isMasterAdmin } from "@/lib/access";

const nav = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    to: "/rentals",
    label: "Rentals",
    icon: Package,
  },
  {
    to: "/manage-worker",
    label: "Manage Users",
    icon: UserCog,
    adminOnly: true,
  },
  {
    to: "/labour",
    label: "Labour Charges",
    icon: HardHat,
    adminOnly: true,
  },
  {
    to: "/worker-locations",
    label: "Worker Locations",
    icon: MapPinned,
    adminOnly: true,
  },
  {
    to: "/diary",
    label: "Diary / Notes",
    icon: NotebookPen,
  },
  {
    to: "/reports",
    label: "Reports",
    icon: FileBarChart,
  },
  {
    to: "/receipts",
    label: "Receipts",
    icon: Receipt,
  },
  {
    to: "/reels",
    label: "Reel Management",
    icon: Film,
    adminOnly: true,
  },
  {
    to: "/feedback",
    label: "Worker Feedback",
    icon: MessageSquare,
    adminOnly: true,
  },
];

function NavLinks({ onClick }: { onClick?: () => void }) {
  const path = useRouterState({
    select: (s) => s.location.pathname,
  });

  const [worker, setWorker] = useState(false);

  useEffect(() => {
    // Worker (and admin) logins here are tracked locally, not via a real
    // Supabase auth session — WORKER_ID_KEY is only ever set for role
    // "worker" accounts, so its presence is enough to restrict the nav.
    setWorker(Boolean(localStorage.getItem(WORKER_ID_KEY)));
  }, []);

  const links = worker
    ? [
        {
          to: "/worker",
          label: "My Attendance & Payments",
          icon: HardHat,
        },
      ]
    : nav.filter((item) => !item.adminOnly || isMasterAdmin());

  return (
    <nav className="flex flex-col gap-1 px-4 py-5">
      {links.map(({ to, label, icon: Icon }) => {
        const active = path === to || path.startsWith(to + "/");

        return (
          <Link
            key={to}
            to={to}
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 text-sm font-semibold transition-all",
              active
                ? "rounded-xl bg-sidebar-accent px-4 py-3 text-primary"
                : "rounded-xl px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

const exploreLinks = [
  {
    href: "https://mbsndcl.vercel.app",
    label: "Official website",
    icon: Globe,
  },
  {
    href: "https://www.instagram.com/mbs_centrings_nereducherla/",
    label: "Instagram",
    icon: Instagram,
  },
  {
    href: "https://www.youtube.com/@mbs_centring_works_ndcl/?themeRefresh=1",
    label: "YouTube",
    icon: Youtube,
  },
  {
    href: "https://wa.me/918688285959",
    label: "WhatsApp",
    icon: MessageCircle,
  },
  {
    href: "https://maps.app.goo.gl/PWjFYqqZrZRqSC2E6",
    label: "Visit location",
    icon: MapPin,
  },
  {
    href: "tel:+918688285959",
    label: "Call Now",
    icon: Phone,
  },
];

function ExploreLinks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-4 mt-5 border-t border-sidebar-border pt-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent",
              open && "bg-sidebar-accent text-sidebar-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <Compass className="h-4 w-4" />
              Explore
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-1 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2">
            {exploreLinks.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-sidebar-accent"
              >
                <Icon className="h-5 w-5" />
                {label}
              </a>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * "Signed in as" text block for the admin/manager sidebar — same plain
 * style as the worker sidebar's version, just above Sign out. Covers both
 * a workers-table row login (admin or manager role) and the single shared
 * master login, which has no row and is always full admin.
 */
function SignedInLabel() {
  const adminId = typeof window !== "undefined" ? localStorage.getItem(ADMIN_ID_KEY) : null;

  const { data: me } = useQuery({
    queryKey: ["workers", "me", adminId],
    queryFn: async () => {
      if (!adminId) return null;
      const { data, error } = await supabase
        .from("workers")
        .select("name")
        .eq("id", adminId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!adminId,
  });

  const name = adminId ? me?.name ?? "…" : "Master Admin";

  return (
    <div className="min-w-0 text-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">
        Signed in as
      </div>

      <div className="truncate font-semibold">{name}</div>
    </div>
  );
}

function SidebarContent({
  onNav,
  workerName,
  workerId,
  dark,
  onToggleTheme,
}: {
  onNav?: () => void;
  workerName?: string;
  workerId?: string | null;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const isWorkerSidebar = workerName !== undefined;

  const ThemeToggle = (
    <Button
      variant="outline"
      size="sm"
      onClick={onToggleTheme}
      className="w-full justify-center gap-2 font-semibold"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}

      {dark ? "Light mode" : "Dark mode"}
    </Button>
  );

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* ================================
          ADMIN SIDEBAR
         ================================ */}
      {!isWorkerSidebar && (
        <>
          <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
            <img
              src={logo}
              alt="MBS"
              className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white object-cover p-0.5"
            />

            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight tracking-tight">
                MBS CENTRING WORKS
              </div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/70">
                Nereducherla
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            <NavLinks onClick={onNav} />
            <ExploreLinks />
          </div>

          <div className="space-y-2 border-t border-sidebar-border p-4">
            {ThemeToggle}

            <ChangePasswordDialog />

            <SignedInLabel />

            <ConfirmDelete
              onConfirm={lock}
              title="Sign out of this account?"
              description="You will need to sign in again to access the dashboard."
              confirmLabel="Sign out"
            >
              <Button
                variant="default"
                size="sm"
                className="w-full justify-center rounded-lg bg-primary font-semibold"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </ConfirmDelete>

            <div className="text-[11px] leading-relaxed text-sidebar-foreground/60">
              MBS Centring Works
            </div>
          </div>
        </>
      )}

      {/* ================================
          WORKER SIDEBAR
         ================================ */}
      {isWorkerSidebar && (
        <>
          <div className="flex-1 overflow-hidden">
            <div className="flex flex-col items-center px-6 pt-8 text-center">
              <img
                src={logo}
                alt="MBS Centring Works"
                className="h-28 w-28 rounded-full bg-white object-contain p-1 shadow-sm"
              />

              <div className="mt-4 text-base font-bold tracking-tight">MBS CENTRING WORKS</div>

              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/65">
                NEREDUCHERLA
              </div>
            </div>

            <ExploreLinks />
          </div>

          <div className="space-y-3 border-t border-sidebar-border p-4">
            {ThemeToggle}

            <WorkerLocationToggle workerId={workerId ?? null} />

            <div className="min-w-0 text-sm">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">
                Signed in as
              </div>

              <div className="truncate font-semibold">{workerName || "Worker"}</div>
            </div>

            <ConfirmDelete
              onConfirm={lock}
              title="Sign out of this worker account?"
              description="You will need to sign in again to view attendance and payment records."
              confirmLabel="Sign out"
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </ConfirmDelete>
          </div>
        </>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  /*
   * IMPORTANT:
   * false = sidebar CLOSED after login/refresh.
   *
   * Clicking the desktop ☰ button opens it.
   */
  const [open, setOpen] = useState(false);

  const [dark, setDark] = useState(false);
  const [worker, setWorker] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [workerId, setWorkerId] = useState<string | null>(null);

  /* ================================
     LOAD WORKER + THEME
     ================================ */
  useEffect(() => {
    const workerId = localStorage.getItem(WORKER_ID_KEY);

    setWorker(Boolean(workerId));
    setWorkerId(workerId);

    if (workerId) {
      void supabase
        .from("workers")
        .select("name")
        .eq("id", workerId)
        .maybeSingle()
        .then(({ data }) => {
          setWorkerName(data?.name ?? "Worker");
        });
    }

    const stored = localStorage.getItem("mbs-theme");

    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  /* ================================
     THEME TOGGLE
     ================================ */
  const toggleTheme = () => {
    const next = !dark;

    setDark(next);

    document.documentElement.classList.toggle("dark", next);

    localStorage.setItem("mbs-theme", next ? "dark" : "light");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* ==========================================
          LAPTOP / DESKTOP SIDEBAR

          IMPORTANT:
          `open` controls whether it exists.

          false -> hidden
          true  -> visible
         ========================================== */}

      {open && (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-hidden border-r border-sidebar-border lg:flex">
          <SidebarContent
            workerName={worker ? workerName : undefined}
            workerId={worker ? workerId : undefined}
            dark={dark}
            onToggleTheme={toggleTheme}
          />
        </aside>
      )}

      {/* ==========================================
          MAIN CONTENT AREA
         ========================================== */}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="site-header sticky top-0 z-40 h-16 border-b border-border px-4 lg:px-6">
          <div className="flex h-full items-center justify-between gap-4">
            {/* =====================================
                LEFT SIDE
               ===================================== */}

            <div className="flex shrink-0 items-center gap-3">
              {/* ===================================
                  MOBILE MENU
                  Only visible below lg.
                 =================================== */}

              <div className="lg:hidden">
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full border-white/40 bg-white/25 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05]"
                      aria-label="Open sidebar"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>

                  <SheetContent
                    side="left"
                    className="w-[min(78vw,340px)] max-w-none border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-2xl [&>button]:hidden"
                  >
                    <SidebarContent
                      onNav={() => {
                        setOpen(false);
                      }}
                      workerName={worker ? workerName : undefined}
                      workerId={worker ? workerId : undefined}
                      dark={dark}
                      onToggleTheme={toggleTheme}
                    />
                  </SheetContent>
                </Sheet>
              </div>

              {/* ===================================
                  LAPTOP / DESKTOP MENU

                  This button opens
                  and closes the sidebar.
                 =================================== */}

              <Button
                variant="outline"
                size="icon"
                className="hidden rounded-full border-white/40 bg-white/25 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] lg:flex"
                onClick={() => {
                  setOpen((previous) => !previous);
                }}
                aria-label={open ? "Close sidebar" : "Open sidebar"}
                title={open ? "Close sidebar" : "Open sidebar"}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* ===================================
                  MOBILE LOGO + TITLE
                 =================================== */}

              <div className="flex items-center gap-2 lg:hidden">
                <img
                  src={logo}
                  alt="MBS"
                  className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white object-cover p-0.5"
                />

                <div>
                  <h1 className="text-sm font-bold leading-tight sm:text-base">
                    M.B.S CENTRING WORKS
                  </h1>

                  <p className="text-[11px] text-muted-foreground">Nereducherla</p>
                </div>
              </div>
            </div>

            {/* =====================================
                RIGHT SIDE
               ===================================== */}

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  window.location.reload();
                }}
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* ========================================
            PAGE CONTENT
           ======================================== */}

        <main
          className={cn(
            "flex-1 overflow-x-hidden p-4 lg:p-6",
            worker && "lg:h-[calc(100vh-4rem)] lg:overflow-y-hidden",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}