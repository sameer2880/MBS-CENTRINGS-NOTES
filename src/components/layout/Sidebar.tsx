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
  Compass,
  MoreHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
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

/**
 * `primary: true` marks the items that get a permanent slot in the
 * mobile bottom tab bar and are shown first (in order) on the tablet
 * icon rail. Everything else is still reachable — on mobile via the
 * "More" tab, on tablet by scrolling the rail — it's just not one of
 * the handful of items that get thumb-reach priority. Tune freely.
 *
 * `shortLabel`, where set, is what the bottom-nav tab shows instead
 * of the full `label` — the tab is only ~72px wide, so "Labour
 * Charges" has to become "Labour" there rather than truncate with an
 * ellipsis. The rail and every sheet/menu still use the full `label`.
 */
const nav = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    primary: true,
  },
  {
    to: "/rentals",
    label: "Rentals",
    icon: Package,
    primary: true,
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
    shortLabel: "Labour",
    icon: HardHat,
    adminOnly: true,
    primary: true,
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
    primary: true,
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

function useNavLinks() {
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
          shortLabel: "Attendance",
          icon: HardHat,
          primary: true,
        },
      ]
    : nav.filter((item) => !item.adminOnly || isMasterAdmin());

  return { links, worker };
}

function NavLinks({ onClick }: { onClick?: () => void }) {
  const path = useRouterState({
    select: (s) => s.location.pathname,
  });
  const { links } = useNavLinks();

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
              "touch-target flex items-center gap-3 text-sm font-semibold transition-all",
              active
                ? "rounded-xl bg-sidebar-accent px-4 py-3 text-primary"
                : "rounded-xl px-4 py-3 text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
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

/**
 * Explore more — same plain circle-icon + label tile used by the
 * secondary nav grid (Diary / Notes, Reports, etc.) rather than its own
 * bordered, tinted card style, so "Explore more" reads as one more row
 * of nav tiles instead of a visually distinct block.
 */
function ExploreLinks() {
  return (
    <div className="mx-4 mt-5 border-t border-sidebar-border pt-5">
      <div className="flex items-center gap-2 px-3 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/65">
        <Compass className="h-4 w-4" />
        Explore more
      </div>

      <div className="grid grid-cols-4 gap-1 px-1">
        {exploreLinks.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noreferrer" : undefined}
            className="touch-target flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition-colors hover:bg-sidebar-accent"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sidebar-accent/70 text-sidebar-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-sidebar-foreground">
              {label}
            </span>
          </a>
        ))}
      </div>
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
        {/* ===================================
          MOBILE/TABLET LOGO/TITLE
          Desktop shows the logo inside the full
          sidebar. Workers keep this header logo
          until the desktop sidebar is available.
              src={logo}
              alt="MBS"
        <div className="flex items-center gap-2 lg:hidden">
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
          <div className="flex-1 overflow-y-auto">
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

/**
 * DESKTOP SIDEBAR (>= 1024px)
 * The full labeled sidebar remains desktop-only. Phone and tablet use the
 * compact bottom navigation below.
 */
function NavRail({
  onOpenMore,
}: {
  onOpenMore: () => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { links } = useNavLinks();

  return (
    <aside
      className="hidden"
      aria-label="Primary"
    >
      <img
        src={logo}
        alt="MBS"
        className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white object-cover p-0.5"
      />

      <nav className="mt-4 flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2">
        {links.map(({ to, label, icon: Icon }) => {
          const active = path === to || path.startsWith(to + "/");

          return (
            <Link
              key={to}
              to={to}
              title={label}
              aria-label={label}
              className={cn(
                "touch-target flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center transition-colors",
                active
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="line-clamp-2 text-[10px] font-semibold leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <Button
        variant="ghost"
        size="icon"
        className="mt-2 h-11 w-11 shrink-0 flex-col gap-0.5 rounded-xl text-[10px] font-semibold"
        onClick={onOpenMore}
        aria-label="More options"
        title="More"
      >
        <MoreHorizontal className="h-5 w-5" />
      </Button>
    </aside>
  );
}

/**
 * MOBILE/TABLET "MORE" SHEET (< 1024px)
 * Opens from the bottom (matches the bottom-nav's "More" tab it's
 * triggered from) as an icon grid of the nav items that don't have a
 * permanent bottom-nav slot, followed by theme/account controls.
 * Deliberately NOT the same component as the desktop/tablet sidebar —
 * a full-height list sliding in from the left reads as a leftover
 * desktop pattern on a phone; a bottom sheet matches where the tap
 * that opened it came from.
 */
function MobileMoreSheet({
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
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { links } = useNavLinks();
  const isWorkerSidebar = workerName !== undefined;
  // Everything without a permanent bottom-nav slot — that's already
  // one tap away, so repeating it here would just be clutter.
  const secondary = links.filter((l) => !l.primary);

  return (
    <div className="flex max-h-[80vh] flex-col overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mx-auto mt-1 h-1.5 w-10 shrink-0 rounded-full bg-sidebar-foreground/20" />

      {secondary.length > 0 && (
        <div className="grid grid-cols-4 gap-1 px-3 pt-4">
          {secondary.map(({ to, label, icon: Icon }) => {
            const active = path === to || path.startsWith(to + "/");

            return (
              <Link
                key={to}
                to={to}
                onClick={onNav}
                className="touch-target flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-center transition-colors hover:bg-sidebar-accent"
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full",
                    active ? "bg-primary text-primary-foreground" : "bg-sidebar-accent/70 text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-sidebar-foreground">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-3 space-y-2.5 border-t border-sidebar-border p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleTheme}
          className="w-full justify-center gap-2 font-semibold"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? "Light mode" : "Dark mode"}
        </Button>

        {isWorkerSidebar ? (
          <WorkerLocationToggle workerId={workerId ?? null} />
        ) : (
          <ChangePasswordDialog />
        )}

        <ExploreLinks />

        {isWorkerSidebar ? (
          <div className="min-w-0 text-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">
              Signed in as
            </div>
            <div className="truncate font-semibold">{workerName || "Worker"}</div>
          </div>
        ) : (
          <SignedInLabel />
        )}

        <ConfirmDelete
          onConfirm={lock}
          title={isWorkerSidebar ? "Sign out of this worker account?" : "Sign out of this account?"}
          description={
            isWorkerSidebar
              ? "You will need to sign in again to view attendance and payment records."
              : "You will need to sign in again to access the dashboard."
          }
          confirmLabel="Sign out"
        >
          <Button
            variant={isWorkerSidebar ? "outline" : "default"}
            size="sm"
            className={cn(
              "w-full justify-center rounded-lg font-semibold",
              isWorkerSidebar
                ? "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                : "bg-primary",
            )}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </ConfirmDelete>
      </div>
    </div>
  );
}

/**
 * MOBILE/TABLET BOTTOM TAB BAR (< 1024px)
 * The first 4 `primary` nav items, plus a permanent "More" tab that
 * opens `MobileMoreSheet` (remaining nav items, explore links, theme,
 * account) as a bottom sheet. Fixed to the viewport bottom, safe-area
 * aware (see `.shell-bottomnav` in styles.css) so it clears the iOS
 * home indicator when installed as a standalone PWA.
 */
function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { links } = useNavLinks();

  const primary = links.filter((l) => l.primary).slice(0, 4);
  const tabs = primary.length > 0 ? primary : links.slice(0, 4);

  // More is just another equal-width column here, not a specially
  // pinned corner element — every column (tabs + More) is the same
  // width, which is what actually guarantees even spacing regardless
  // of how long each label is. (The "pin More to the corner" need was
  // for the worker's single-tab case, which no longer uses this bar
  // at all — workers get the classic sidebar now.)
  const items = [
    ...tabs.map((t) => ({ ...t, isMore: false as const })),
    { to: "__more__", label: "More", shortLabel: undefined, icon: MoreHorizontal, isMore: true as const },
  ];

  return (
    <nav className="shell-bottomnav flex items-stretch" aria-label="Primary">
      {items.map((item) => {
        if (item.isMore) {
          return (
            <button
              key="more"
              type="button"
              onClick={onOpenMore}
              aria-label="More"
              className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </button>
          );
        }

        const { to, label, shortLabel, icon: Icon } = item;
        const active = path === to || path.startsWith(to + "/");

        return (
          <Link
            key={to}
            to={to}
            title={label}
            aria-label={label}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden px-1 text-[10.5px] font-semibold",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "scale-110")} />
            <span className="w-full truncate text-center leading-tight">{shortLabel ?? label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  /*
   * IMPORTANT:
  * true = desktop sidebar OPEN after login/refresh.
   *
   * Clicking the desktop ☰ button opens it. This only governs the
   * >=1024px full labeled sidebar — independent from the two sheet
   * states below:
   *   railSheetOpen   -> tablet rail's "More" button (left sheet,
   *                       reuses the full SidebarContent — there's
   *                       room for it there)
   *   mobileMoreOpen  -> phone bottom-nav's "More" tab (bottom
   *                       sheet, MobileMoreSheet's icon grid)
   */
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Worker accounts don't get the bottom-nav / tablet-rail shell at
  // all — just the original single hamburger-button sidebar, at every
  // screen size (slide-in sheet below `lg`, persistent panel at `lg`+).
  // One state drives both, same as it always did.
  const [workerSidebarOpen, setWorkerSidebarOpen] = useState(false);

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

  const sharedSidebarProps = {
    workerName: worker ? workerName : undefined,
    workerId: worker ? workerId : undefined,
    dark,
    onToggleTheme: toggleTheme,
  };

  return (
    <div className="flex min-h-dvh bg-background">
      {worker ? (
        <>
          {/* ==========================================
              WORKER: CLASSIC SIDEBAR (all screen sizes)
              Persistent panel at >= lg, slide-in sheet
              below that — one hamburger button drives
              both. No bottom-nav, no tablet rail.
             ========================================== */}

          {workerSidebarOpen && (
            <aside className="sticky top-0 hidden h-screen w-[var(--shell-sidebar-w)] shrink-0 overflow-hidden border-r border-sidebar-border lg:flex">
              <SidebarContent {...sharedSidebarProps} />
            </aside>
          )}

          <Sheet open={workerSidebarOpen} onOpenChange={setWorkerSidebarOpen}>
            <SheetContent
              side="left"
              className="w-[min(78vw,340px)] max-w-none border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-2xl lg:hidden [&>button]:hidden"
            >
              <SidebarContent
                onNav={() => setWorkerSidebarOpen(false)}
                {...sharedSidebarProps}
              />
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <>
          {/* ==========================================
              DESKTOP SIDEBAR (>= 1024px)

              IMPORTANT:
              `desktopOpen` controls whether it exists.

              false -> hidden
              true  -> visible
             ========================================== */}

          {desktopOpen && (
            <aside className="sticky top-0 flex h-screen w-[var(--shell-sidebar-w)] shrink-0 overflow-hidden border-r border-sidebar-border max-lg:hidden">
              <SidebarContent {...sharedSidebarProps} />
            </aside>
          )}

          {/* ==========================================
              TABLET RAIL (768–1023px)
             ========================================== */}

          <NavRail onOpenMore={() => setRailSheetOpen(true)} />

          {/* ==========================================
              TABLET "MORE" SHEET
              Reuses the full SidebarContent — tablet has
              room for a left-side labeled list.
             ========================================== */}

          <Sheet open={railSheetOpen} onOpenChange={setRailSheetOpen}>
            <SheetContent
              side="left"
              className="w-[min(78vw,340px)] max-w-none border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-2xl [&>button]:hidden"
            >
              <SidebarContent
                onNav={() => setRailSheetOpen(false)}
                {...sharedSidebarProps}
              />
            </SheetContent>
          </Sheet>

          {/* ==========================================
              MOBILE/TABLET "MORE" SHEET
              Bottom sheet, matching the bottom-nav tab
              it's opened from — not the desktop sidebar.
             ========================================== */}

          <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
            <SheetContent
              side="bottom"
              className="shell-more-sheet max-h-[85vh] rounded-t-3xl border-t border-sidebar-border p-0 text-sidebar-foreground shadow-2xl [&>button]:hidden lg:hidden"
            >
              <MobileMoreSheet
                onNav={() => setMobileMoreOpen(false)}
                {...sharedSidebarProps}
              />
            </SheetContent>
          </Sheet>
        </>
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
              {worker ? (
                /* =================================
                   WORKER MENU BUTTON
                   Visible at every screen size —
                   the single entry point to the
                   classic sidebar (sheet below lg,
                   persistent panel at lg+).
                   ================================= */
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full border-white/40 bg-white/25 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05]"
                  onClick={() => setWorkerSidebarOpen((previous) => !previous)}
                  aria-label={workerSidebarOpen ? "Close sidebar" : "Open sidebar"}
                  title={workerSidebarOpen ? "Close sidebar" : "Open sidebar"}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              ) : (
                /* ===================================
                    DESKTOP MENU

                    This button opens
                    and closes the sidebar.
                    (Mobile has no header menu button —
                    the bottom-nav "More" tab is the one
                    entry point there. Tablet uses the
                    rail's "More" button.)
                   =================================== */
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden rounded-full border-white/40 bg-white/25 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] lg:flex"
                  onClick={() => {
                    setDesktopOpen((previous) => !previous);
                  }}
                  aria-label={desktopOpen ? "Close sidebar" : "Open sidebar"}
                  title={desktopOpen ? "Close sidebar" : "Open sidebar"}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}

              {/* ===================================
                  MOBILE LOGO/TITLE
                  Tablet already shows the logo atop
                  its rail (admin/manager only); desktop
                  inside the full sidebar — so this is
                  phone-only for admin/manager. For a
                  worker (no rail), show it up to lg too.
                 =================================== */}

              <div className={cn("flex items-center gap-2", worker ? "lg:hidden" : "lg:hidden")}>
                <img
                  src={logo}
                  alt="MBS"
                  className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white object-cover p-0.5"
                />

                <div>
                  <h1 className="text-fluid-sm font-bold leading-tight sm:text-base">
                    M.B.S CENTRING WORKS
                  </h1>

                  <p className="text-fluid-xs text-muted-foreground">Nereducherla</p>
                </div>
              </div>
            </div>

            {/* =====================================
                RIGHT SIDE
               ===================================== */}

            <div className="flex items-center gap-1">
            </div>
          </div>
        </header>

        {/* ========================================
            PAGE CONTENT
           ======================================== */}

        <main
          className={cn(
            "page-pad flex-1 overflow-x-hidden",
            !worker && "shell-content-offset",
            worker && "lg:h-[calc(100dvh-4rem)] lg:overflow-y-hidden",
          )}
        >
          {children}
        </main>

        {/* ========================================
            MOBILE/TABLET BOTTOM TAB BAR (< 1024px)
            Admin/manager only — workers use the
            classic sidebar at every screen size.
           ======================================== */}

        {!worker && <BottomNav onOpenMore={() => setMobileMoreOpen(true)} />}
      </div>
    </div>
  );
}