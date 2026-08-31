import * as React from "react";

/**
 * The app's 3 device tiers. Kept in sync with Tailwind's default
 * breakpoints so JS-level branching (this hook) and CSS-level
 * branching (`md:`, `lg:` classes) always agree on where the lines are:
 *
 *   mobile  : < 768px   (Tailwind default, up to `md`)
 *   tablet  : 768–1023px (Tailwind `md` up to `lg`)
 *   desktop : >= 1024px  (Tailwind `lg`+)
 */
export type DeviceType = "mobile" | "tablet" | "desktop";

const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

function getDeviceType(width: number): DeviceType {
  if (width < TABLET_BREAKPOINT) return "mobile";
  if (width < DESKTOP_BREAKPOINT) return "tablet";
  return "desktop";
}

/**
 * Returns the current device tier and re-renders when it changes.
 * `undefined` briefly on first mount (server/client match), so most
 * call sites should treat `deviceType === undefined` the same as the
 * default (usually "desktop", to match server-rendered markup) and
 * only branch once it's defined.
 */
export function useDeviceType(): DeviceType {
  const [device, setDevice] = React.useState<DeviceType>(() => {
    if (typeof window === "undefined") return "desktop";
    return getDeviceType(window.innerWidth);
  });

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const onResize = () => setDevice(getDeviceType(window.innerWidth));
      window.addEventListener("resize", onResize);
      onResize();
      return () => window.removeEventListener("resize", onResize);
    }

    const tabletQuery = window.matchMedia(`(min-width: ${TABLET_BREAKPOINT}px)`);
    const desktopQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);

    const onChange = () => setDevice(getDeviceType(window.innerWidth));

    const subscribe = (mql: MediaQueryList) => {
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      }
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    };

    const unsubTablet = subscribe(tabletQuery);
    const unsubDesktop = subscribe(desktopQuery);
    onChange();

    return () => {
      unsubTablet();
      unsubDesktop();
    };
  }, []);

  return device;
}

/** True only for the mobile tier (< 768px). */
export function useIsMobileDevice() {
  return useDeviceType() === "mobile";
}

/** True for tablet or desktop (>= 768px) — i.e. "has room for a rail/sidebar". */
export function useHasSideNavSpace() {
  const device = useDeviceType();
  return device === "tablet" || device === "desktop";
}

/**
 * True when the primary input is touch (phones/tablets, and touch-laptops).
 * Distinct from screen size: a large touch tablet still wants bigger hit
 * targets even though it renders the "tablet" or "desktop" layout.
 */
export function useIsTouchDevice() {
  const [touch, setTouch] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(pointer: coarse)");
    const onChange = () => setTouch(mql.matches);
    onChange();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return touch;
}
