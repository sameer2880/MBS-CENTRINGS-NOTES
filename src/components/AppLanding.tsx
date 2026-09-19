import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  Home,
  MapPin,
  Moon,
  Receipt,
  ShieldCheck,
  Sun,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

// Keep in sync with the AndroidManifest `package` in the shipped APK.
const ANDROID_PACKAGE = "com.mbscentring.works";
const APK_URL = "/downloads/mbs-works.apk";
const APP_VERSION = "1.0";

type Device = "android" | "ios" | "desktop";

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mbs-theme", next ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next ? "#0e1911" : "#f3f6ee");
  };

  return { dark, toggleTheme };
}

/* ------------------------------------------------------------------ */
/* Platform symbols (Android robot, Apple logo, desktop monitor)       */
/* Android + Apple paths are from Simple Icons (CC0).                  */
/* ------------------------------------------------------------------ */
type IconProps = { className?: string };

function AndroidIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z" />
    </svg>
  );
}

function AppleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function DesktopIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2.5" />
      <rect x="8" y="19.5" width="8" height="2" rx="1" />
    </svg>
  );
}

/* "Your device" dot: pop-in, two ripple rings and a breathing glow,
   same feel as the animated brand logo. Uses the app's theme colours. */
const LIVE_DOT_CSS = `
.live-dot {
  display: inline-flex;
  width: 10px;
  height: 10px;
  align-items: center;
  justify-content: center;
  animation: live-dot-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
.live-dot-core {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background: radial-gradient(circle at 30% 30%, var(--accent), var(--primary) 70%);
  box-shadow: 0 0 8px 1px color-mix(in oklab, var(--primary) 70%, transparent);
  animation: live-dot-breathe 2.4s ease-in-out infinite;
}
.live-dot-ring {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: var(--primary);
  opacity: 0;
  animation: live-dot-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.live-dot-ring-2 { animation-delay: 1.2s; }

@keyframes live-dot-pop {
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes live-dot-ping {
  0%   { transform: scale(1); opacity: 0.55; }
  80%, 100% { transform: scale(3.4); opacity: 0; }
}
@keyframes live-dot-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}
@media (prefers-reduced-motion: reduce) {
  .live-dot, .live-dot-core, .live-dot-ring { animation: none !important; }
  .live-dot-ring { display: none; }
}
`;

export function AppLanding() {
  const [device, setDevice] = useState<Device>("desktop");
  const { dark, toggleTheme } = useTheme();

  useEffect(() => {
    setDevice(detectDevice());
  }, []);

  const scrollToDevices = () => {
    document.getElementById("pick-device")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{LIVE_DOT_CSS}</style>
      {/* Header — logo + name on the left, theme toggle on the right */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[1336px] items-center justify-between gap-3 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo className="h-9 w-9 shrink-0" alt="MBS Centring Works" />
            <span className="truncate text-lg font-bold tracking-tight">
              MBS <span className="text-primary">CENTRING WORKS</span>
            </span>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent/10"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center px-5 pb-20 pt-12 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-warning">
          <span className="size-1.5 rounded-full bg-warning" />
          SITE &amp; LABOUR MANAGEMENT · NEREDUCHERLA
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.1] sm:text-6xl">
          Labour, Rentals &amp; Receipts,
          <br />
          All In <span className="text-primary">One App</span>
        </h1>

        <p className="mt-5 max-w-xl text-balance text-muted-foreground sm:text-lg">
          Track workers, rentals and daily site records from your phone or computer — synced
          instantly for your whole team.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {[
            { icon: Users, label: "Labour tracking" },
            { icon: MapPin, label: "Worker locations" },
            { icon: Truck, label: "Rentals" },
            { icon: Receipt, label: "Receipts" },
            { icon: ShieldCheck, label: "Secure login" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
            >
              <Icon className="size-3.5 text-primary" />
              {label}
            </span>
          ))}
        </div>

        <Button asChild size="lg" className="mt-9 h-12 gap-2 px-8 text-base">
          <Link to="/dashboard">
            <Home className="size-5" />
            GO TO DASHBOARD
          </Link>
        </Button>

        <p className="mt-4 text-sm text-muted-foreground">
          You'll be asked to sign in with your MBS Works account.
        </p>

        <button
          onClick={scrollToDevices}
          className="mt-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          See install steps for every device
          <ArrowDown className="size-3.5" />
        </button>
      </section>

      {/* Device picker */}
      <section id="pick-device" className="px-5 pb-20 pt-4">
        <div className="mx-auto max-w-5xl text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            Get the app
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            Pick your device
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Android, iPhone or computer — choose yours and follow the steps below.
          </p>

          <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
            <DeviceCard
              icon={AndroidIcon}
              title="Android"
              subtitle="Phone & tablet"
              tag="FREE APK"
              isYourDevice={device === "android"}
              href={APK_URL}
              download
            />
            <DeviceCard
              icon={AppleIcon}
              title="iOS"
              subtitle="iPhone & iPad"
              tag="INSTALL GUIDE"
              isYourDevice={device === "ios"}
              to="/dashboard"
            />
            <DeviceCard
              icon={DesktopIcon}
              title="Computer"
              subtitle="Windows, Mac & Linux"
              tag="WEB — NO INSTALL"
              isYourDevice={device === "desktop"}
              to="/dashboard"
            />
          </div>
        </div>

        {/* Bottom CTA panel */}
        <Card className="mx-auto mt-14 grid max-w-4xl gap-8 p-6 sm:grid-cols-2 sm:items-center sm:p-10">
          <div>
            <h3 className="text-xl font-bold leading-snug sm:text-2xl">
              Already installed the app?
              <br />
              Keep using the browser any time.
            </h3>
            <p className="mt-2 text-sm text-warning">
              Use Chrome, Safari or Firefox for the best experience.
            </p>
            <Button asChild size="lg" className="mt-5 gap-2">
              <Link to="/dashboard">
                <Home className="size-4" />
                GO TO DASHBOARD
              </Link>
            </Button>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              Your login works the same on the app and the website.
            </div>
          </div>
          <DevicesIllustration />
        </Card>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          Android app version {APP_VERSION} · {ANDROID_PACKAGE}
        </p>
      </section>
    </div>
  );
}

function DeviceCard({
  icon: Icon,
  title,
  subtitle,
  tag,
  isYourDevice,
  href,
  to,
  download,
}: {
  icon: (props: IconProps) => React.ReactElement;
  title: string;
  subtitle: string;
  tag: string;
  isYourDevice: boolean;
  href?: string;
  to?: string;
  download?: boolean;
}) {
  const content = (
    <>
      {isYourDevice && (
        <>
          <span className="absolute -top-2.5 right-5 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
            Your device
          </span>
          <span className="live-dot absolute right-6 top-5" aria-hidden="true">
            <span className="live-dot-ring" />
            <span className="live-dot-ring live-dot-ring-2" />
            <span className="live-dot-core" />
          </span>
        </>
      )}

      <div className="flex items-center gap-3">
        <Icon
          className={cn(
            "size-6 shrink-0",
            isYourDevice ? "text-primary" : "text-secondary-foreground",
          )}
        />
        <span className="text-base font-semibold uppercase tracking-wide">{title}</span>
      </div>

      <span className="mt-2 text-xs text-muted-foreground">{subtitle}</span>

      <span
        className={cn(
          "mt-4 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide",
          isYourDevice
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border text-muted-foreground",
        )}
      >
        {tag}
      </span>
    </>
  );

  const className = cn(
    "relative flex flex-col items-start rounded-3xl px-5 pb-5 pt-7 transition-all duration-200 hover:-translate-y-0.5",
    isYourDevice
      ? "border-2 border-primary/60 bg-gradient-to-b from-primary/15 to-primary/5 shadow-[0_12px_40px_-14px] shadow-primary/40"
      : "border border-border bg-gradient-to-b from-card to-muted hover:shadow-lg",
  );

  if (href) {
    return (
      <a href={href} download={download} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={to ?? "/"} className={className}>
      {content}
    </Link>
  );
}

/**
 * Devices illustration: laptop + tablet + phone on a dark forest panel.
 * Colours are the app's own dark-theme palette (forest green + lime), so it
 * looks the same in light and dark mode, like a "media" panel.
 */
function DevicesIllustration() {
  const LIME = "#a8d977"; // --primary (dark theme)
  const LIME_SOFT = "#c8e896"; // --accent (dark theme)
  const MINT = "#7dcb92"; // --success (dark theme)
  const INK = "#0e1911"; // --background (dark theme)
  const line = "rgba(168, 217, 119, 0.3)";

  return (
    <svg
      viewBox="0 0 548 357"
      role="img"
      aria-label="MBS Works on laptop, tablet and phone"
      className="mx-auto h-auto w-full max-w-[440px] drop-shadow-xl"
    >
      <defs>
        <linearGradient id="dev-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12211a" />
          <stop offset="1" stopColor="#0a130d" />
        </linearGradient>
        <linearGradient id="dev-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={LIME} stopOpacity="0.24" />
          <stop offset="1" stopColor={LIME} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="dev-orb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={LIME_SOFT} />
          <stop offset="1" stopColor={MINT} />
        </linearGradient>
        <filter id="dev-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* Panel */}
      <rect
        x="0.75"
        y="0.75"
        width="546.5"
        height="355.5"
        rx="24"
        fill="url(#dev-panel)"
        stroke={line}
        strokeWidth="1.5"
      />

      {/* Soft background glow */}
      <ellipse cx="275" cy="168" rx="214" ry="108" fill={LIME} opacity="0.06" />

      {/* Laptop base */}
      <path
        d="M133 246 H373 L388 278 Q388 280 386 280 H140 Q134 280 134 274 Z"
        fill="#0f1c13"
        stroke={line}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Laptop lid */}
      <rect x="114" y="92" width="240" height="154" rx="14" fill="#0f1c13" stroke={line} strokeWidth="2.5" />
      <rect x="132" y="110" width="205" height="118" rx="6" fill="url(#dev-screen)" />

      {/* Glowing centre badge with shield-check */}
      <circle cx="234" cy="169" r="31" fill={LIME} opacity="0.55" filter="url(#dev-glow)" />
      <circle cx="234" cy="169" r="31" fill="url(#dev-orb)" />
      <g
        transform="translate(219 154) scale(1.25)"
        fill="none"
        stroke={INK}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </g>

      {/* Tablet (tilted) */}
      <g transform="rotate(-6 98 236)">
        <rect x="51" y="175" width="94" height="122" rx="13" fill="#0f1c13" stroke={line} strokeWidth="2.5" />
        <rect x="64" y="188" width="68" height="96" rx="5" fill="url(#dev-screen)" />
        <g
          transform="translate(74 214) scale(2)"
          fill="none"
          stroke={LIME}
          strokeOpacity="0.5"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </g>
      </g>

      {/* Phone */}
      <rect x="383" y="143" width="85" height="143" rx="15" fill="#0f1c13" stroke={line} strokeWidth="2.5" />
      <rect x="394" y="160" width="64" height="102" rx="5" fill="url(#dev-screen)" />
      <circle cx="425.5" cy="274" r="5" fill={line} />
      <g
        transform="translate(413 192) scale(1.05)"
        fill="none"
        stroke={LIME_SOFT}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </g>
    </svg>
  );
}