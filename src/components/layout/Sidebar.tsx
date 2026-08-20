import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, LayoutDashboard, Package, FileBarChart, Receipt, Menu, Moon, Sun, LogOut, NotebookPen, Film, HardHat, RefreshCw, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/assets/logo.png";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { lock } from "@/lib/gate";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_ID_KEY } from "@/lib/worker-auth";
import { currentWorkerId, enableMobileNotifications, listRecentNotifications, showMobileNotification, subscribeToActivityNotifications, type ActivityNotification } from "@/lib/notifications";
import { toast } from "sonner";

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
          M.B.S Centring Works
        </div>
      </div>
    </div>
  );
}

function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied",
  );
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    const seen = new Set<string>();
    const isRelevant = (notification: ActivityNotification, workerId: string | null) =>
      workerId ? notification.worker_id === workerId : notification.notify_admin;
    const handleNotification = (notification: ActivityNotification, workerId: string | null, announce: boolean) => {
      if (!mounted || seen.has(notification.id) || !isRelevant(notification, workerId)) return;
      seen.add(notification.id);
      if (!announce) return;
      setUnread((count) => count + 1);
      showMobileNotification(notification);
      toast.info(notification.title, { description: notification.body });
    };
    void currentWorkerId().then((workerId) => {
      if (!mounted) return;
      void listRecentNotifications()
        .then((notifications) => notifications.reverse().forEach((notification) => handleNotification(notification, workerId, false)))
        .catch(() => undefined);
      unsubscribe = subscribeToActivityNotifications(
        (notification) => handleNotification(notification, workerId, true),
        (status) => {
          if (status === "SUBSCRIBED") toast.success("Live notifications connected");
        },
      );
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const enable = async () => {
    const nextPermission = await enableMobileNotifications();
    setPermission(nextPermission);
    setUnread(0);
    if (nextPermission === "granted") toast.success("Mobile notifications enabled");
    else if (nextPermission === "denied") toast.error("Notifications are blocked in this browser");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => void enable()}
      title={permission === "granted" ? "Notifications enabled" : "Enable mobile notifications"}
      aria-label={permission === "granted" ? "Notifications enabled" : "Enable mobile notifications"}
      className="relative"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] leading-4 text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
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
              <p className="text-[11px] text-muted-foreground">Nereducherla</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationButton />
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
                  <span className="hidden max-w-[24rem] truncate sm:inline">Signed in as {workerName || "Worker"}</span>
                  <span className="max-w-[7rem] truncate sm:hidden">{workerName || "Worker"}</span>
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
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
