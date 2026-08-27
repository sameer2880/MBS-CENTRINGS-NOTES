import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_ID_KEY, ADMIN_ID_KEY, ADMIN_ROLE_KEY } from "@/lib/worker-auth";
import { getRole } from "@/lib/user-role";

export const KEY = "mbs-gate";
const USER = "mbscentringworks";
const PASS = "mbs";

export function isUnlocked() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function lock() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(WORKER_ID_KEY);
  localStorage.removeItem(ADMIN_ID_KEY);
  localStorage.removeItem(ADMIN_ROLE_KEY);
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

  const disableWorkerSession = async () => {
    localStorage.removeItem(WORKER_ID_KEY);
    setWorker(false);
    setErr("Your account is deactivated");
    await supabase.auth.signOut();
  };

  const disableAdminSession = async () => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(ADMIN_ID_KEY);
    localStorage.removeItem(ADMIN_ROLE_KEY);
    setOk(false);
    setErr("Your account is deactivated");
    await supabase.auth.signOut();
  };

  useEffect(() => {
    let mounted = true;
    const loadSession = async () => {
      try {
        if (isUnlocked()) {
          const adminId = localStorage.getItem(ADMIN_ID_KEY);
          if (adminId) {
            // This full-access session came from an admin- or manager-role
            // row (not the master login) — re-check it's still active, and
            // refresh its role in case it changed since login, before
            // trusting it.
            const { data: adminRecord, error } = await supabase
              .from("workers")
              .select("id, active, notes")
              .eq("id", adminId)
              .maybeSingle();
            const role = adminRecord ? getRole(adminRecord.notes) : null;
            if (!error && adminRecord?.active && (role === "admin" || role === "manager")) {
              localStorage.setItem(ADMIN_ROLE_KEY, role);
              if (mounted) {
                setOk(true);
                setReady(true);
              }
              return;
            }
            await disableAdminSession();
            if (mounted) setReady(true);
            return;
          }
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
    if (!ok) return;
    const adminId = localStorage.getItem(ADMIN_ID_KEY);
    if (!adminId) return; // master login has no row to watch

    let checking = false;
    const checkAdminStatus = async () => {
      if (checking) return;
      const id = localStorage.getItem(ADMIN_ID_KEY);
      if (!id) return;
      checking = true;
      try {
        const { data: adminRecord, error } = await supabase
          .from("workers")
          .select("id, active, notes")
          .eq("id", id)
          .maybeSingle();
        const role = adminRecord ? getRole(adminRecord.notes) : null;
        if (!error && (!adminRecord || !adminRecord.active || role === "worker")) {
          await disableAdminSession();
        } else if (!error && role) {
          // Keep the locally-cached role in sync if it was changed
          // elsewhere (e.g. an admin promoted/demoted this account).
          localStorage.setItem(ADMIN_ROLE_KEY, role);
        }
      } finally {
        checking = false;
      }
    };

    const interval = window.setInterval(() => void checkAdminStatus(), 10000);
    const onFocus = () => void checkAdminStatus();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [ok]);

  useEffect(() => {
    if (worker && pathname !== "/worker") void navigate({ to: "/worker" });
  }, [navigate, pathname, worker]);

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
      localStorage.removeItem(ADMIN_ID_KEY);
      localStorage.removeItem(ADMIN_ROLE_KEY);
      setWorker(false);
      setOk(true);
      void navigate({ to: "/dashboard", replace: true });
      return;
    }
    void (async () => {
      const { data: userByName } = await supabase
        .from("workers")
        .select("id, name, phone, active, notes")
        .ilike("name", u.trim())
        .maybeSingle();
      const { data: userByPhone } = userByName
        ? { data: null }
        : await supabase
            .from("workers")
            .select("id, name, phone, active, notes")
            .eq("phone", u.trim())
            .maybeSingle();
      const userRecord = userByName ?? userByPhone;
      if (!userRecord?.phone) {
        setErr("Name or mobile number was not found");
        return;
      }
      if (!userRecord.active) {
        setErr("This account is deactivated");
        return;
      }
      const password = p.trim();
      if (password !== userRecord.phone.trim()) {
        setErr("Incorrect mobile number");
        return;
      }
      const role = getRole(userRecord.notes);
      if (role === "admin" || role === "manager") {
        // Admin- and manager-role users get full access to the management
        // screens, but we keep their row id (and role) so their status can
        // be re-checked, their permissions applied correctly, and so they
        // can change their own password later.
        localStorage.setItem(KEY, "1");
        localStorage.setItem(ADMIN_ID_KEY, userRecord.id);
        localStorage.setItem(ADMIN_ROLE_KEY, role);
        localStorage.removeItem(WORKER_ID_KEY);
        setWorker(false);
        setOk(true);
        void navigate({ to: "/dashboard", replace: true });
        return;
      }
      localStorage.setItem(WORKER_ID_KEY, userRecord.id);
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
          <p className="text-center text-xs font-medium text-red-600">
            Note: If you are a member of MBS CENTRINGS, contact admin to get your login credentials.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}