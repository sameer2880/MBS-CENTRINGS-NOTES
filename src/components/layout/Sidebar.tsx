import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, FileBarChart, Receipt, Menu, Moon, Sun, LogOut, NotebookPen, Film, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/logo.png";
import { useEffect, useState, type ReactNode } from "react";
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


function NavLinks({ onClick }: { onClick?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [worker, setWorker] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return;
      const workerId = data.session.user.user_metadata?.worker_id ?? localStorage.getItem(WORKER_ID_KEY);
      const { data: workerRecord } = workerId ? await supabase
        .from("workers")
        .select("id")
        .eq("id", workerId)
        .maybeSingle() : { data: null };
      setWorker(Boolean(workerRecord));
    })();
  }, []);
  const links = worker ? [{ to: "/worker", label: "My Attendance & Payments", icon: HardHat }] : nav;
  return (
    <nav className="flex flex-col gap-1 px-3">
      {links.map(({ to, label, icon: Icon }) => {
        const active = path === to || path.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
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

function SidebarContent({ onNav }: { onNav?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <img src={logo} alt="MBS" className="h-11 w-11 rounded-full bg-white p-0.5" />
        <div className="min-w-0">
          <div className="font-bold text-sm leading-tight">M.B.S CENTRING WORKS</div>
          <div className="text-[11px] text-sidebar-foreground/70">Nereducherla</div>
        </div>
      </div>
      <div className="flex-1 py-4 overflow-y-auto">
        <NavLinks onClick={onNav} />
      </div>
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <Button variant="default" size="sm" className="w-full justify-start" onClick={lock}>
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </Button>
        <div className="text-[11px] text-sidebar-foreground/60 leading-relaxed">
          Rental notebook
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [worker, setWorker] = useState(false);
  useEffect(() => {
    setWorker(Boolean(localStorage.getItem(WORKER_ID_KEY)));
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
      {!worker && (
        <aside className="hidden lg:flex w-64 flex-shrink-0 border-r border-sidebar-border">
          <SidebarContent />
        </aside>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {!worker && (
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                  <SidebarContent onNav={() => setOpen(false)} />
                </SheetContent>
              </Sheet>
            )}
            <img src={logo} alt="MBS" className="h-9 w-9 rounded-full lg:hidden" />
            <div>
              <h1 className="font-bold text-sm sm:text-base leading-tight">M.B.S CENTRING WORKS</h1>
              <p className="text-[11px] text-muted-foreground">Nereducherla · Rental Notebook</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
