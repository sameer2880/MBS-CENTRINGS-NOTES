import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  Download,
  Home,
  MapPin,
  Monitor,
  Moon,
  Receipt,
  ShieldCheck,
  Smartphone,
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
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="h-9 w-9" />
          <span className="text-lg font-bold tracking-tight">
            MBS <span className="text-primary">CENTRING WORKS</span>
          </span>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent/10"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center px-5 pb-20 pt-8 text-center sm:pt-14">
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
      <section id="pick-device" className="px-5 pb-20 pt-4 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="text-xs font-semibold tracking-wide text-primary">GET THE APP</span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Pick your device</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Android, iPhone or computer — choose yours and follow the steps below.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <DeviceCard
              icon={Smartphone}
              title="Android"
              subtitle="Phone & tablet"
              tag="FREE APK"
              isYourDevice={device === "android"}
              href={APK_URL}
              download
            />
            <DeviceCard
              icon={Smartphone}
              title="iPhone & iPad"
              subtitle="Add to Home Screen"
              tag="INSTALL GUIDE"
              isYourDevice={device === "ios"}
              to="/dashboard"
            />
            <DeviceCard
              icon={Monitor}
              title="Computer"
              subtitle="Windows, Mac & Linux"
              tag="WEB — NO INSTALL"
              isYourDevice={device === "desktop"}
              to="/dashboard"
            />
          </div>
        </div>

        {/* Bottom CTA panel */}
        <Card className="mx-auto mt-10 grid max-w-4xl gap-8 p-6 sm:grid-cols-2 sm:items-center sm:p-10">
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
  icon: typeof Smartphone;
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
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-bold tracking-wide text-primary-foreground">
          YOUR DEVICE
        </span>
      )}
      <Icon className="size-6 text-primary" />
      <span className="mt-3 text-base font-semibold">{title}</span>
      <span className="mt-0.5 text-xs text-muted-foreground">{subtitle}</span>
      <span className="mt-3 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {tag}
      </span>
    </>
  );

  const className = cn(
    "relative flex flex-col items-center rounded-2xl border bg-card p-5 text-center transition-colors",
    isYourDevice ? "border-primary shadow-[0_0_0_1px_var(--color-primary)]" : "border-border",
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

function DevicesIllustration() {
  return (
    <div className="relative mx-auto flex h-40 w-full max-w-[220px] items-center justify-center sm:h-48">
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex h-24 w-36 items-center justify-center rounded-xl border-2 border-primary/40 bg-card shadow-sm sm:h-28 sm:w-44">
        <ShieldCheck className="size-8 text-primary" />
      </div>
      <div className="absolute -left-2 bottom-0 flex h-16 w-9 items-center justify-center rounded-md border-2 border-primary/40 bg-card shadow-sm">
        <MapPin className="size-3.5 text-primary" />
      </div>
      <div className="absolute -right-2 bottom-2 flex h-20 w-11 items-center justify-center rounded-lg border-2 border-primary/40 bg-card shadow-sm">
        <Smartphone className="size-4 text-primary" />
      </div>
    </div>
  );
}