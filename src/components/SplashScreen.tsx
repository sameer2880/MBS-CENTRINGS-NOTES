import { useEffect, useState } from "react";

const SPLASH_SESSION_KEY = "mbs-splash-shown";
const MOBILE_QUERY = "(max-width: 768px)";
const MIN_VISIBLE_MS = 1200;
const FADE_MS = 400;

export function SplashScreen() {
  const [isMobile, setIsMobile] = useState(false);
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Only show once per browser session, and only on mobile widths.
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SPLASH_SESSION_KEY) === "1";
    } catch {
      alreadyShown = false;
    }

    const mql = window.matchMedia(MOBILE_QUERY);
    const mobile = mql.matches;
    setIsMobile(mobile);

    if (!mobile || alreadyShown) {
      return;
    }

    setVisible(true);

    try {
      sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    } catch {
      // ignore storage errors (private mode, etc.)
    }

    const fadeTimer = setTimeout(() => setFadingOut(true), MIN_VISIBLE_MS);
    const removeTimer = setTimeout(() => setVisible(false), MIN_VISIBLE_MS + FADE_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isMobile || !visible) return null;

  return (
    <div
      role="status"
      aria-label="Loading M.B.S Centring Works"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <img
        src="/splash.png"
        alt="M.B.S Centring Works"
        style={{
          width: "70vw",
          maxWidth: 320,
          height: "auto",
        }}
      />
    </div>
  );
}