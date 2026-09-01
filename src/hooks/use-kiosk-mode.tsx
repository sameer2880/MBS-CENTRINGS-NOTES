import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { KIOSK_PASSWORD, KIOSK_STORAGE_KEY, isKioskActive } from "@/lib/kiosk";

type KioskContextValue = {
  /** Whether kiosk mode is currently on. */
  active: boolean;
  /** Attempt to turn kiosk mode on. Returns false on a wrong password. */
  enable: (password: string) => boolean;
  /** Attempt to turn kiosk mode off. Returns false on a wrong password. */
  disable: (password: string) => boolean;
};

const KioskContext = createContext<KioskContextValue | null>(null);

export function useKiosk() {
  const ctx = useContext(KioskContext);
  if (!ctx) throw new Error("useKiosk must be used within a KioskProvider");
  return ctx;
}

type FullscreenableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FullscreenableDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

async function tryRequestFullscreen() {
  const el = document.documentElement as FullscreenableElement;
  const doc = document as FullscreenableDocument;
  try {
    if (document.fullscreenElement || doc.webkitFullscreenElement) return;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  } catch {
    // Fullscreen requires a user gesture and isn't supported at all in
    // iPhone Safari — fail silently, the rest of kiosk mode still applies.
  }
}

async function tryExitFullscreen() {
  const doc = document as FullscreenableDocument;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
  } catch {
    // ignore
  }
}

export function KioskProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);

  // Restore persisted state after mount (localStorage isn't available
  // during SSR).
  useEffect(() => {
    setActive(isKioskActive());
  }, []);

  // Toggle a class on <html> so CSS can lock down scrolling/selection/zoom,
  // and enter/exit fullscreen to hide the browser's own chrome where
  // that's supported.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("kiosk-mode", active);
    if (active) void tryRequestFullscreen();
    else void tryExitFullscreen();
    return () => html.classList.remove("kiosk-mode");
  }, [active]);

  // Disable pinch-zoom while locked by tightening the viewport meta tag;
  // restore the normal zoomable viewport on exit.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.getAttribute("content");
    if (active) {
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      );
    } else if (original) {
      meta.setAttribute("content", original);
    }
    return () => {
      if (original) meta.setAttribute("content", original);
    };
  }, [active]);

  // Block the long-press / right-click context menu while locked.
  useEffect(() => {
    if (!active) return;
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [active]);

  // Block text selection and dragging (of images/links) while locked, so
  // there's nothing to select-and-share out of the app. Inputs/textareas
  // are re-enabled in CSS since people still need to select their own
  // typed text to edit it.
  useEffect(() => {
    if (!active) return;
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("selectstart", block);
    document.addEventListener("dragstart", block);
    return () => {
      document.removeEventListener("selectstart", block);
      document.removeEventListener("dragstart", block);
    };
  }, [active]);

  // Block pinch-zoom gestures at the event level too (belt-and-braces —
  // the viewport meta tag above doesn't reliably stop this on every iOS
  // version), and block other multi-touch gestures generally.
  useEffect(() => {
    if (!active) return;
    const blockGesture = (event: Event) => event.preventDefault();
    const blockMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("gesturestart", blockGesture);
    document.addEventListener("gesturechange", blockGesture);
    document.addEventListener("gestureend", blockGesture);
    document.addEventListener("touchstart", blockMultiTouch, { passive: false });
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
      document.removeEventListener("touchstart", blockMultiTouch);
      document.removeEventListener("touchmove", blockMultiTouch);
    };
  }, [active]);

  // If fullscreen gets exited behind our back (Esc key, a swipe, etc.),
  // or the page becomes visible again after switching apps, try to
  // re-enter it automatically.
  useEffect(() => {
    if (!active) return;
    const reassert = () => {
      if (!document.fullscreenElement) void tryRequestFullscreen();
    };
    document.addEventListener("fullscreenchange", reassert);
    document.addEventListener("visibilitychange", reassert);
    window.addEventListener("focus", reassert);
    return () => {
      document.removeEventListener("fullscreenchange", reassert);
      document.removeEventListener("visibilitychange", reassert);
      window.removeEventListener("focus", reassert);
    };
  }, [active]);

  // Trap browser/hardware back navigation so it can't leave the app —
  // every back action just gets pushed straight back to where we were.
  useEffect(() => {
    if (!active) return;
    const pushGuard = () => window.history.pushState({ kiosk: true }, "", window.location.href);
    pushGuard();
    const onPopState = () => pushGuard();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [active]);

  // Swallow keyboard shortcuts that could be used to leave/inspect the
  // page on a device that has a keyboard attached (Tab-out, dev tools,
  // save/print/view-source, Ctrl+W, etc.). Note: the browser/OS itself
  // reserves some combinations (Esc for fullscreen, Alt+Tab, the Home
  // button) and JavaScript can never intercept those — this only covers
  // shortcuts the page is actually allowed to see.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blockedWithCtrlOrMeta = ["w", "t", "n", "p", "s", "u", "r"];
      if ((event.ctrlKey || event.metaKey) && blockedWithCtrlOrMeta.includes(key)) {
        event.preventDefault();
      }
      if (key === "f12") event.preventDefault();
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && ["i", "j", "c"].includes(key)) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [active]);

  // Ask (browser-controlled prompt, wording can't be customized) before
  // the tab is closed or refreshed while locked.
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);

  const enable = useCallback((password: string) => {
    if (password !== KIOSK_PASSWORD) return false;
    window.localStorage.setItem(KIOSK_STORAGE_KEY, "1");
    setActive(true);
    return true;
  }, []);

  const disable = useCallback((password: string) => {
    if (password !== KIOSK_PASSWORD) return false;
    window.localStorage.removeItem(KIOSK_STORAGE_KEY);
    setActive(false);
    return true;
  }, []);

  return <KioskContext.Provider value={{ active, enable, disable }}>{children}</KioskContext.Provider>;
}