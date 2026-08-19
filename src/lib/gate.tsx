import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_ID_KEY } from "@/lib/worker-auth";

const KEY = "mbs-gate";
const USER = "mbsnotes";
const PASS = "mbsnotes";

export function isUnlocked() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function lock() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(WORKER_ID_KEY);
  void supabase.auth.signOut().finally(() => window.location.reload());
}

export function Gate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [worker, setWorker] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      if (isUnlocked()) {
        if (mounted) {
          setOk(true);
          setReady(true);
        }
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        const workerId = data.session.user.user_metadata?.worker_id ?? localStorage.getItem(WORKER_ID_KEY);
        const { data: workerRecord } = workerId
          ? await supabase.from("workers").select("id").eq("id", workerId).maybeSingle()
          : { data: null };
        if (workerRecord) setWorker(true);
        else await supabase.auth.signOut();
      } else {
        const workerId = localStorage.getItem(WORKER_ID_KEY);
        if (workerId) {
          const { data: workerRecord } = await supabase.from("workers").select("id").eq("id", workerId).maybeSingle();
          if (workerRecord) setWorker(true);
          else localStorage.removeItem(WORKER_ID_KEY);
        }
      }
      setReady(true);
    };
    void loadSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (worker && pathname !== "/worker") void navigate({ to: "/worker" });
  }, [navigate, pathname, worker]);

  if (!ready) return null;
  if (ok || worker) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (u.trim() === USER && p === PASS) {
      localStorage.setItem(KEY, "1");
      setOk(true);
      return;
    }
    void (async () => {
      const { data: workerByName } = await supabase
        .from("workers")
        .select("id, name, phone")
        .ilike("name", u.trim())
        .maybeSingle();
      const { data: workerByPhone } = workerByName
        ? { data: null }
        : await supabase.from("workers").select("id, name, phone").eq("phone", u.trim()).maybeSingle();
      const workerRecord = workerByName ?? workerByPhone;
      if (!workerRecord?.phone) {
        setErr("Worker name or mobile number was not found");
        return;
      }
      const password = p.trim();
      if (password !== workerRecord.phone.trim()) {
        setErr("Incorrect mobile number");
        return;
      }
      localStorage.setItem(WORKER_ID_KEY, workerRecord.id);
      setWorker(true);
    })();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-col items-center text-center gap-2">
            <img src={logo} alt="MBS" className="h-16 w-16 rounded-full bg-white p-1 shadow" />
            <h1 className="font-bold text-lg leading-tight">M.B.S CENTRING WORKS</h1>
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
