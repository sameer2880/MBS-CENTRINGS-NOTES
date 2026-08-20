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
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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

function SidebarContent({ onNav }: { onNav?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4 lg:px-0 lg:py-0">
        <img
          src={logo}
          alt="MBS"
          className="block h-12 w-12 shrink-0 overflow-hidden rounded-full bg-white object-cover p-0.5"
        />
        <div className="min-w-0">
          <div className="font-bold text-sm leading-tight tracking-tight">M.B.S CENTRING WORKS</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/70">
            Nereducherla
          </div>
        </div>
      </div>
      <div className="flex-1 py-4 overflow-y-auto">
        <NavLinks onClick={onNav} />
      </div>
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <Button
          variant="default"
          size="sm"
          className="w-full justify-center rounded-lg bg-primary font-semibold"
          onClick={lock}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
        <div className="text-[11px] text-sidebar-foreground/60 leading-relaxed">
          M.B.S Centring Works
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [worker, setWorker] = useState(false);
  const [workerName, setWorkerName] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (!accountOpen) return;
    const closeOnOutsidePress = (event: MouseEvent | TouchEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsidePress);
    document.addEventListener("touchstart", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsidePress);
      document.removeEventListener("touchstart", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-sidebar px-4 lg:px-6 sticky top-0 z-40">
          <div className="flex h-full items-center justify-between gap-4 lg:grid lg:grid-cols-[minmax(250px,1fr)_auto_minmax(180px,1fr)]">
            <div className="flex items-center gap-3 shrink-0 lg:justify-self-start">
              {!worker && (
                <Sheet open={open} onOpenChange={setOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="lg:hidden">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-[min(86vw,400px)] max-w-none border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-2xl [&>button]:hidden"
                  >
                    <SidebarContent onNav={() => setOpen(false)} />
                  </SheetContent>
                </Sheet>
              )}
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
              {worker && (
                <div ref={accountRef} className="relative mr-1 max-w-[45vw]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAccountOpen((value) => !value)}
                    aria-expanded={accountOpen}
                    aria-label="Open account menu"
                  >
                    <UserCircle className="h-4 w-4 mr-1.5" />
                    <span className="hidden max-w-[24rem] truncate sm:inline">
                      Signed in as {workerName || "Worker"}
                    </span>
                    <span className="max-w-[7rem] truncate sm:hidden">
                      {workerName || "Worker"}
                    </span>
                  </Button>
                  {accountOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 min-w-44 rounded-md border border-border bg-card p-1 shadow-md">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-destructive hover:text-destructive"
                        onClick={lock}
                      >
                        <LogOut className="h-4 w-4 mr-2" /> Sign out
                      </Button>
                    </div>
                  )}
                </div>
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
