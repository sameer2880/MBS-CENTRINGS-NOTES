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
  const [mobileSplash, setMobileSplash] = useState(false);
  const [ok, setOk] = useState(false);
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [worker, setWorker] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    if (!mobile) return;
    setMobileSplash(true);
    const timer = window.setTimeout(() => setMobileSplash(false), 3500);
    return () => window.clearTimeout(timer);
  }, []);

  const disableWorkerSession = async () => {
    localStorage.removeItem(WORKER_ID_KEY);
    setWorker(false);
    setErr("Your account is disabled");
    await supabase.auth.signOut();
  };

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      try {
        if (isUnlocked()) {
          if (mounted) {
            setOk(true);
            setReady(true);
          }
          return;
        }
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null } }>((resolve) =>
            window.setTimeout(() => resolve({ data: { session: null } }), 8000),
          ),
        ]);
        if (!mounted) return;
        if (data.session?.user) {
          const workerId =
            data.session.user.user_metadata?.worker_id ?? localStorage.getItem(WORKER_ID_KEY);
          const { data: workerRecord } = workerId
            ? await supabase.from("workers").select("id, active").eq("id", workerId).maybeSingle()
            : { data: null };
          if (workerRecord?.active) {
            localStorage.setItem(WORKER_ID_KEY, workerRecord.id);
            setWorker(true);
          } else if (workerRecord) {
            await disableWorkerSession();
          } else {
            await supabase.auth.signOut();
          }
        } else {
          const workerId = localStorage.getItem(WORKER_ID_KEY);
          if (workerId) {
            const { data: workerRecord } = await supabase
              .from("workers")
              .select("id, active")
              .eq("id", workerId)
              .maybeSingle();
            if (workerRecord?.active) setWorker(true);
            else if (workerRecord) await disableWorkerSession();
            else localStorage.removeItem(WORKER_ID_KEY);
          }
        }
      } catch (error) {
        console.warn("Unable to restore the previous session", error);
      } finally {
        if (mounted) setReady(true);
      }
    };
    void loadSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!worker) return;

    let checking = false;
    const checkWorkerStatus = async () => {
      if (checking) return;
      const workerId = localStorage.getItem(WORKER_ID_KEY);
      if (!workerId) return;
      checking = true;
      try {
        const { data: workerRecord, error } = await supabase
          .from("workers")
          .select("id, active")
          .eq("id", workerId)
          .maybeSingle();
        if (!error && (!workerRecord || !workerRecord.active)) await disableWorkerSession();
      } finally {
        checking = false;
      }
    };

    const interval = window.setInterval(() => void checkWorkerStatus(), 10000);
    const onFocus = () => void checkWorkerStatus();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [worker]);

  useEffect(() => {
    if (worker && pathname !== "/worker") void navigate({ to: "/worker" });
  }, [navigate, pathname, worker]);

  if (mobileSplash) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-[#0873bd]">
        <img
          src="/splash-image.png"
          alt="M.B.S Centring Works"
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.src = logo;
          }}
        />
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }
  if (ok || worker) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (u.trim() === USER && p === PASS) {
      localStorage.setItem(KEY, "1");
      localStorage.removeItem(WORKER_ID_KEY);
      setWorker(false);
      setOk(true);
      void navigate({ to: "/dashboard", replace: true });
      return;
    }
    void (async () => {
      const { data: workerByName } = await supabase
        .from("workers")
        .select("id, name, phone, active")
        .ilike("name", u.trim())
        .maybeSingle();
      const { data: workerByPhone } = workerByName
        ? { data: null }
        : await supabase
            .from("workers")
            .select("id, name, phone, active")
            .eq("phone", u.trim())
            .maybeSingle();
      const workerRecord = workerByName ?? workerByPhone;
      if (!workerRecord?.phone) {
        setErr("Worker name or mobile number was not found");
        return;
      }
      if (!workerRecord.active) {
        setErr("This worker account is disabled");
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
            <img
              src={logo}
              alt="MBS"
              className="block h-16 w-16 overflow-hidden rounded-full bg-white object-cover p-1 shadow"
            />
            <h1 className="font-bold text-lg leading-tight">M.B.S CENTRING WORKS</h1>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Username</Label>
              <Input
                value={u}
                onChange={(e) => setU(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={p}
                onChange={(e) => setP(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
