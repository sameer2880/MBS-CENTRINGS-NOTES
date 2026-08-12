import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";

const KEY = "mbs-gate";
const USER = "mbsnotes";
const PASS = "mbsnotes";

export function isUnlocked() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function lock() {
  localStorage.removeItem(KEY);
  window.location.reload();
}

export function Gate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    setOk(isUnlocked());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (ok) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (u.trim() === USER && p === PASS) {
      localStorage.setItem(KEY, "1");
      setOk(true);
    } else {
      setErr("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-col items-center text-center gap-2">
            <img src={logo} alt="MBS" className="h-16 w-16 rounded-full bg-white p-1 shadow" />
            <h1 className="font-bold text-lg leading-tight">M.B.S CENTRING WORKS</h1>
            <p className="text-xs text-muted-foreground">Nereducherla · Rental Notebook</p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
