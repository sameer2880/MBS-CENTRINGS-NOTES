// Kiosk mode: locks the app so a shared/site device can't be used for
// anything else. The SAME password is used to turn kiosk mode on and to
// turn it off, per spec.
//
// IMPORTANT — read this before assuming kiosk mode "locks the phone":
// A website/PWA cannot hide or disable the Android/iOS status bar, the
// system navigation bar, or the Control Center / Notification Shade.
// Those are OS-level UI, and browsers deliberately keep them out of reach
// of JavaScript — otherwise any website could trap a visitor's device.
// The closest a web app can legitimately get is everything implemented
// in use-kiosk-mode.tsx:
//   - Fullscreen API (hides the browser's own address bar/chrome, where
//     supported — not supported at all in iPhone Safari)
//   - Trapping in-app back navigation so the back button/gesture can't
//     leave the app
//   - Blocking the long-press/right-click context menu, text selection,
//     drag, pinch-zoom, and multi-touch gestures
//   - A "confirm before leaving" prompt on tab close/refresh (browsers
//     only allow a generic browser-controlled confirmation, not custom
//     text)
//   - Re-asserting fullscreen the instant it's exited or the tab regains
//     focus/visibility
//   - No visible lock/unlock icon on screen at all — the entry/exit
//     dialog only appears after 5 taps anywhere on the screen within ~2
//     seconds (see kiosk-overlay.tsx), then still requires the password
// For a REAL, OS-level lock (status bar and Control Center genuinely
// unreachable, Home/Recents disabled), see the note at the bottom of
// this file — that part is outside what any website can do.
export const KIOSK_STORAGE_KEY = "mbs-kiosk-active";
export const KIOSK_PASSWORD = "mbscentringworks";

// How many taps, and within what window (ms), reveal the hidden kiosk
// entry/exit dialog. Kept in one place so both the tap counter and any
// on-screen hint text (if you ever add one) stay in sync.
export const KIOSK_TAP_COUNT = 5;
export const KIOSK_TAP_WINDOW_MS = 2000;

export function isKioskActive(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KIOSK_STORAGE_KEY) === "1";
}

/*
  To get a REAL, device-level kiosk lock (status bar, nav bar and
  Control Center genuinely unreachable) you have two options outside
  what a web app can do:

  1. Screen Pinning (Android) / Guided Access (iPhone) — built into the
     OS, turned on manually on the device itself, pins the current app
     (including a browser tab, or this app installed to the home screen
     as a PWA) and blocks Home/Recents/notification pulldown until a PIN
     is entered. Free, no code, but must be enabled per-device by
     whoever hands it out:
       Android: Settings > Security > More security settings > Screen
       pinning > On. Then open the app, tap Recents, tap the app icon at
       the top, tap "Pin". To unpin: hold Back + Recents (or Back +
       Home, depending on Android version).
       iPhone: Settings > Accessibility > Guided Access > On. Then
       triple-click the side/home button inside the app to start it,
       triple-click again + Face ID/passcode to stop.
     Combined with this app's own password-gated lock, that's the
     strongest result achievable without building a native app: the OS
     blocks the status bar/nav bar, and this code blocks in-app
     navigation and requires a password to reveal/operate the toggle.

  2. Wrap this app with Capacitor (capacitorjs.com) and add a kiosk
     plugin, or enroll the Android device as a "Device Owner" via
     Android Enterprise (a free Google program used by real kiosk/POS
     apps) with this app set as the locked task. That gets you
     app-controlled, code-driven lockdown of the status bar/nav bar with
     no per-device manual toggle needed — but it turns this from a
     website into a native app you build and install as an .apk, which
     is a bigger project than a file swap. Ask me if you want help
     scoping that separately.
*/