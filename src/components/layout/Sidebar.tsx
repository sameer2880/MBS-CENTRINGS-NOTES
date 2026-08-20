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
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import logo from "@/assets/logo.png";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { lock } from "@/lib/gate";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_ID_KEY } from "@/lib/worker-auth";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/rentals", label: "Rentals", icon: Package },

  { to: "/labour", label: "Labour Charges", icon: HardHat },
  { to: "/diary", label: "Diary / Notes", icon: NotebookPen },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/receipts", label: "Receipts", icon: Receipt },
  { to: "/reels", label: "Reel Management", icon: Film },
  { to: "/feedback", label: "Worker Feedback", icon: MessageSquare },
];

function NavLinks({ onClick, horizontal = false }: { onClick?: () => void; horizontal?: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [worker, setWorker] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return;
      const workerId =
        data.session.user.user_metadata?.worker_id ?? localStorage.getItem(WORKER_ID_KEY);
      const { data: workerRecord } = workerId
        ? await supabase.from("workers").select("id").eq("id", workerId).maybeSingle()
        : { data: null };
      setWorker(Boolean(workerRecord));
    })();
  }, []);
  const links = worker
    ? [{ to: "/worker", label: "My Attendance & Payments", icon: HardHat }]
    : nav;
  return (
    <nav
      className={cn(
        horizontal
          ? "hidden lg:flex items-center justify-center gap-1.5"
          : "flex flex-col gap-1 px-4 py-5",
      )}
    >
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
                ? horizontal
                  ? "h-16 px-2.5 border-b-2 border-primary text-primary"
                  : "rounded-xl bg-sidebar-accent px-4 py-3 text-primary"
                : horizontal
                  ? "h-16 px-2.5 border-b-2 border-transparent text-foreground hover:text-primary"
                  : "rounded-xl px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <Icon className={cn("h-4 w-4", horizontal && "hidden")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

const exploreLinks = [
  { href: "https://mbsndcl.vercel.app", label: "Official website", icon: Globe },
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
  { href: "https://wa.me/918688285959", label: "WhatsApp", icon: MessageCircle },
  { href: "https://maps.app.goo.gl/PWjFYqqZrZRqSC2E6", label: "Visit location", icon: MapPin },
  { href: "tel:+918688285959", label: "Call Now", icon: Phone },
];

function ExploreLinks() {
  return (
    <div className="mx-4 mt-5 border-t border-sidebar-border pt-5">
      <div className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/65">
        Explore
      </div>
      <div className="mt-2 space-y-1">
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
    </div>
  );
}

function SidebarContent({ onNav, workerName }: { onNav?: () => void; workerName?: string }) {
  const isWorkerSidebar = workerName !== undefined;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {!isWorkerSidebar && (
        <>
          <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4 lg:px-0 lg:py-0">
            <img
              src={logo}
              alt="MBS"
              className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white object-cover p-0.5"
            />
            <div className="min-w-0">
              <div className="font-bold text-sm leading-tight tracking-tight">
                M.B.S CENTRING WORKS
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
            <ConfirmDelete
              onConfirm={lock}
              title="Sign out of the admin account?"
              description="You will need to sign in again to access the admin dashboard."
              confirmLabel="Sign out"
            >
              <Button
                variant="default"
                size="sm"
                className="w-full justify-center rounded-lg bg-primary font-semibold"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </ConfirmDelete>
            <div className="text-[11px] leading-relaxed text-sidebar-foreground/60">
              M.B.S Centring Works
            </div>
          </div>
        </>
      )}
      {isWorkerSidebar && (
        <>
          <div className="flex-1 overflow-hidden">
            <div className="flex flex-col items-center px-6 pt-8 text-center">
              <img
                src={logo}
                alt="MBS Centring Works"
                className="h-28 w-28 rounded-full bg-white object-contain p-1 shadow-sm"
              />
              <div className="mt-4 font-bold text-base tracking-tight">MBS CENTRING WORKS</div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/65">
                NEREDUCHERLA
              </div>
            </div>
            <ExploreLinks />
          </div>
          <div className="space-y-3 border-t border-sidebar-border p-4">
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
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </ConfirmDelete>
          </div>
        </>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [worker, setWorker] = useState(false);
  const [workerName, setWorkerName] = useState("");
  useEffect(() => {
    const workerId = localStorage.getItem(WORKER_ID_KEY);
    setWorker(Boolean(workerId));
    if (workerId) {
      void supabase
        .from("workers")
        .select("name")
        .eq("id", workerId)
        .maybeSingle()
        .then(({ data }) => setWorkerName(data?.name ?? "Worker"));
    }
    const stored = localStorage.getItem("mbs-theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mbs-theme", next ? "dark" : "light");
  };

  // Mobile: swipe right from the left half of the screen opens the sidebar,
  // swipe left closes it. Tapping outside closes it (handled by Sheet overlay).
  useEffect(() => {
    if (typeof window === "undefined") return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      if (window.innerWidth >= 1024) return;
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = startX < window.innerWidth * 0.6;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > 60) return;
      if (dx > 60) setOpen(true);
      else if (dx < -60) setOpen(false);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {worker && (
        <aside className="sticky top-0 hidden h-screen w-48 shrink-0 overflow-hidden border-r border-sidebar-border lg:flex">
          <SidebarContent workerName={workerName} />
        </aside>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-sidebar px-4 lg:px-6 sticky top-0 z-40">
          <div className="flex h-full items-center justify-between gap-4 lg:grid lg:grid-cols-[minmax(250px,1fr)_auto_minmax(180px,1fr)]">
            <div className="flex items-center gap-3 shrink-0 lg:justify-self-start">
              {
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-[min(78vw,340px)] max-w-none border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-2xl [&>button]:hidden"
                  >
                    <SidebarContent
                      onNav={() => setOpen(false)}
                      workerName={worker ? workerName : undefined}
                    />
                  </SheetContent>
                </Sheet>
              }
              <div className="hidden lg:flex items-center gap-3">
                <img
                  src={logo}
                  alt="MBS"
                  className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white object-cover p-0.5"
                />
                <div>
                  <h1 className="font-bold text-sm leading-tight tracking-tight">
                    M.B.S CENTRING WORKS
                  </h1>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Nereducherla
                  </p>
                </div>
              </div>
              <div className="lg:hidden">
                <h1 className="font-bold text-sm sm:text-base leading-tight">
                  M.B.S CENTRING WORKS
                </h1>
                <p className="text-[11px] text-muted-foreground">Nereducherla</p>
              </div>
            </div>
            <div className="hidden lg:flex lg:justify-self-center">
              {!worker && <NavLinks horizontal />}
            </div>
            <div className="flex items-center gap-1 lg:justify-self-end">
              {!worker && (
                <ConfirmDelete
                  onConfirm={lock}
                  title="Sign out of the admin account?"
                  description="You will need to sign in again to access the admin dashboard."
                  confirmLabel="Sign out"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden items-center gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive lg:flex"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </ConfirmDelete>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.reload()}
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title={dark ? "Use light mode" : "Use dark mode"}
                aria-label={dark ? "Use light mode" : "Use dark mode"}
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
