// Kiosk mode: locks the app so a shared/site device can't be used for
// anything else. The SAME password is used to turn kiosk mode on and to
// turn it off, per spec.
//
// IMPORTANT — read this before assuming kiosk mode "locks the phone":
// A website/PWA cannot hide or disable the Android/iOS status bar, the
// system navigation bar, or the Control Center / Notification Shade.
// Those are OS-level UI, and browsers deliberately keep them out of reach
// of JavaScript — otherwise any website could trap a visitor's device.
// The closest a web app can legitimately get is:
//   - Fullscreen API (hides the browser's own address bar/chrome, where
//     supported — not supported at all in iPhone Safari)
//   - Trapping in-app back navigation so the back button/gesture can't
//     leave the app
//   - Blocking the long-press/right-click context menu, text selection,
//     and pinch-zoom
//   - A "confirm before leaving" prompt on tab close/refresh (browsers
//     only allow a generic browser-controlled confirmation, not custom
//     text)
// True OS-level kiosk lockdown (swipe-down disabled, home/recents
// disabled) requires either the device's built-in Screen Pinning /
// Guided Access feature (turned on by whoever holds the device, the app
// can't flip it) or wrapping this app as a native app (e.g. with
// Capacitor) using a dedicated kiosk/MDM plugin. See the note at the
// bottom of this file.
export const KIOSK_STORAGE_KEY = "mbs-kiosk-active";
export const KIOSK_PASSWORD = "mbscentringworks";

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
     and blocks Home/Recents/notification pulldown until a PIN is
     entered. Free, no code, but must be enabled per-device by whoever
     hands it out.

  2. Wrap this app with Capacitor (capacitorjs.com) and add a kiosk
     plugin such as @ionic-enterprise/kiosk or an Android "device owner"
     MDM profile. That gets you app-controlled, code-driven lockdown of
     the status bar/nav bar — but it turns this from a website into a
     native app you build and install as an .apk/.ipa, which is a
     bigger project than a file swap. Ask me if you want help scoping
     that separately.
*/