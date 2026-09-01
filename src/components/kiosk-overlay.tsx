import { useEffect, useRef, useState, type FormEvent } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useKiosk } from "@/hooks/use-kiosk-mode";
import { KIOSK_TAP_COUNT, KIOSK_TAP_WINDOW_MS } from "@/lib/kiosk";

/**
 * No visible lock icon anywhere — kiosk mode should not advertise itself
 * or hand anyone an obvious button to tap. Instead this mounts a silent,
 * invisible listener for the whole document: tap anywhere on the screen
 * KIOSK_TAP_COUNT times in a row (within KIOSK_TAP_WINDOW_MS of each
 * other) and the password-gated entry/exit dialog appears. This works
 * the same way whether kiosk mode is currently on or off, so it's how
 * you both turn it on for the first time and how you get back out.
 */
export function KioskOverlay() {
  const { active, enable, disable } = useKiosk();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const tapTimes = useRef<number[]>([]);

  useEffect(() => {
    const registerTap = () => {
      const now = Date.now();
      const recent = tapTimes.current.filter((t) => now - t < KIOSK_TAP_WINDOW_MS);
      recent.push(now);
      if (recent.length >= KIOSK_TAP_COUNT) {
        tapTimes.current = [];
        setOpen(true);
        return;
      }
      tapTimes.current = recent;
    };
    // "click" fires for both mouse clicks and touch taps in every
    // mobile/desktop browser, so one listener covers touch and mouse.
    document.addEventListener("click", registerTap, true);
    return () => document.removeEventListener("click", registerTap, true);
  }, []);

  const close = () => {
    setOpen(false);
    setPassword("");
    setError("");
    tapTimes.current = [];
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const ok = active ? disable(password) : enable(password);
    if (ok) close();
    else {
      setError("Incorrect password");
      setPassword("");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              {active ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}
            </div>
            <h2 className="text-lg font-bold">{active ? "Exit Kiosk Mode" : "Enter Kiosk Mode"}</h2>
            <p className="text-xs text-muted-foreground">
              {active
                ? "Enter the kiosk password to unlock this device."
                : "This locks the app to this device. Enter the password to turn it on."}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
                autoComplete="off"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                {active ? "Unlock" : "Lock"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}