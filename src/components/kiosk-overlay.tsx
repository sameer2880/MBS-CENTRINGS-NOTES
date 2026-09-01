import { useState, type FormEvent } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useKiosk } from "@/hooks/use-kiosk-mode";

/**
 * Always-mounted small lock toggle (bottom-right) plus its password
 * prompt. Tap it to turn kiosk mode on; tap it again to turn kiosk mode
 * off — both require the kiosk password.
 */
export function KioskOverlay() {
  const { active, enable, disable } = useKiosk();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setPassword("");
    setError("");
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={active ? "Exit kiosk mode" : "Enter kiosk mode"}
        title={active ? "Exit kiosk mode" : "Enter kiosk mode"}
        className={cn(
          "fixed bottom-4 right-4 z-[999] flex h-11 w-11 items-center justify-center rounded-full border shadow-md backdrop-blur transition",
          active
            ? "border-primary/40 bg-primary text-primary-foreground"
            : "border-border bg-background/70 text-muted-foreground hover:bg-background",
        )}
      >
        {active ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1 text-center">
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
      )}
    </>
  );
}