import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, KeyRound, LockKeyhole, UserRound } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_ID_KEY, ADMIN_ID_KEY, ADMIN_ROLE_KEY, workerSessionKey } from "@/lib/worker-auth";
import { getRole } from "@/lib/user-role";

export const KEY = "mbs-gate";
const USER = "mbscentringworks";
const PASS = "mbs";

export function isUnlocked() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function lock() {
  const workerId = localStorage.getItem(WORKER_ID_KEY);
  localStorage.removeItem(KEY);
  localStorage.removeItem(WORKER_ID_KEY);
  if (workerId) localStorage.removeItem(workerSessionKey(workerId));
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

  const disableWorkerSession = async (message = "Your account is deactivated") => {
    const workerId = localStorage.getItem(WORKER_ID_KEY);
    localStorage.removeItem(WORKER_ID_KEY);
    if (workerId) localStorage.removeItem(workerSessionKey(workerId));
    setWorker(false);
    setErr(message);
    await supabase.auth.signOut();
  };

  const disableAdminSession = async (message = "Your account is deactivated") => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(ADMIN_ID_KEY);
    localStorage.removeItem(ADMIN_ROLE_KEY);
    setOk(false);
    setErr(message);
    await supabase.auth.signOut();
  };

  const claimDevice = async (workerId: string, existingToken: string | null) => {
    const localToken = localStorage.getItem(workerSessionKey(workerId));
    if (existingToken && existingToken !== localToken) {
      const takeOver = window.confirm(
        "This account is already signed in on another device. Log out that device and continue here?",
      );
      if (!takeOver) return false;
    }
    const sessionToken = crypto.randomUUID();
    const { error } = await supabase
      .from("workers")
      .update({ session_token: sessionToken })
      .eq("id", workerId);
    if (error) {
      setErr("Unable to start your device session");
      return false;
    }
    localStorage.setItem(workerSessionKey(workerId), sessionToken);
    return true;
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
              .select("id, active, notes, session_token")
              .eq("id", adminId)
              .maybeSingle();
            const role = adminRecord ? getRole(adminRecord.notes) : null;
            const localToken = localStorage.getItem(workerSessionKey(adminId));
            if (
              !error &&
              adminRecord?.active &&
              adminRecord.session_token === localToken &&
              (role === "admin" || role === "manager")
            ) {
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
            ? await supabase
                .from("workers")
                .select("id, active, session_token")
                .eq("id", workerId)
                .maybeSingle()
            : { data: null };
          const localToken = workerId ? localStorage.getItem(workerSessionKey(workerId)) : null;
          if (workerRecord?.active && workerRecord.session_token === localToken) {
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
              .select("id, active, session_token")
              .eq("id", workerId)
              .maybeSingle();
            const localToken = localStorage.getItem(workerSessionKey(workerId));
            if (workerRecord?.active && workerRecord.session_token === localToken) setWorker(true);
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
          .select("id, active, session_token")
          .eq("id", workerId)
          .maybeSingle();
        const localToken = localStorage.getItem(workerSessionKey(workerId));
        if (!error && (!workerRecord || !workerRecord.active)) await disableWorkerSession();
        else if (!error && workerRecord && workerRecord.session_token !== localToken)
          await disableWorkerSession("Your account was signed in on another device");
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
          .select("id, active, notes, session_token")
          .eq("id", id)
          .maybeSingle();
        const role = adminRecord ? getRole(adminRecord.notes) : null;
        const localToken = localStorage.getItem(workerSessionKey(id));
        if (!error && (!adminRecord || !adminRecord.active || role === "worker")) {
          await disableAdminSession();
        } else if (!error && adminRecord && adminRecord.session_token !== localToken) {
          await disableAdminSession("Your account was signed in on another device");
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
      <div className="min-h-dvh flex items-center justify-center bg-background p-4 text-sm text-muted-foreground">
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
        .select("id, name, phone, active, notes, session_token")
        .ilike("name", u.trim())
        .maybeSingle();
      const { data: userByPhone } = userByName
        ? { data: null }
        : await supabase
            .from("workers")
            .select("id, name, phone, active, notes, session_token")
            .eq("phone", u.trim())
            .maybeSingle();
      const userRecord = userByName ?? userByPhone;
      if (!userRecord?.phone) {
        setErr("User name not found");
        return;
      }
      if (!userRecord.active) {
        setErr("This account is deactivated");
        return;
      }
      const password = p.trim();
      if (password !== userRecord.phone.trim()) {
        setErr("Invalid Credentials");
        return;
      }
      const role = getRole(userRecord.notes);
      if (role === "admin" || role === "manager") {
        // Admin- and manager-role users get full access to the management
        // screens, but we keep their row id (and role) so their status can
        // be re-checked, their permissions applied correctly, and so they
        // can change their own password later.
        if (!(await claimDevice(userRecord.id, userRecord.session_token))) return;
        localStorage.setItem(KEY, "1");
        localStorage.setItem(ADMIN_ID_KEY, userRecord.id);
        localStorage.setItem(ADMIN_ROLE_KEY, role);
        localStorage.removeItem(WORKER_ID_KEY);
        setWorker(false);
        setOk(true);
        void navigate({ to: "/dashboard", replace: true });
        return;
      }
      if (!(await claimDevice(userRecord.id, userRecord.session_token))) return;
      localStorage.setItem(WORKER_ID_KEY, userRecord.id);
      setWorker(true);
    })();
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-[12%] top-[18%] h-40 w-40 rounded-full border border-[#10305c]/10" />
        <div className="absolute bottom-[12%] right-[10%] h-56 w-56 rounded-full border border-[#dd7815]/15" />
      </div>

      <Card className="relative w-full max-w-md overflow-hidden border-white/70 bg-[#eaf0f8]/70 shadow-[0_24px_70px_-28px_rgb(16_48_92/55%)] ring-1 ring-white/50 backdrop-blur-2xl dark:border-white/10 dark:bg-[#0c1c33]/70 dark:ring-white/5">
        <div className="h-1 bg-[#dd7815] shadow-[0_1px_12px_rgb(221_120_21/55%)]" />
        <div className="relative flex items-center justify-between overflow-hidden border-b border-white/10 bg-[#10305c]/95 px-6 py-5 dark:border-white/10 sm:px-8">
          <div
            aria-hidden
            className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-[#5b9df0]/20 blur-3xl"
          />
          <div className="flex items-center gap-3">
            <div className="relative rounded-xl border border-white/30 bg-white p-1.5 shadow-[0_8px_18px_-10px_rgb(0_0_0/80%)]">
              <img
                src={logo}
                alt="MBS Centring Works"
                className="block h-11 w-11 rounded-lg object-cover"
              />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-tight text-white">
                M.B.S Centring Works
              </p>
            </div>
          </div>
          <div className="relative rounded-full border border-[#dd7815]/50 bg-[#dd7815]/15 p-2 text-[#ffad5c] shadow-sm">
            <LockKeyhole aria-hidden className="h-4 w-4" />
          </div>
        </div>

        <CardContent className="space-y-6 px-6 pb-7 pt-7 sm:px-8 sm:pb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#10305c] dark:text-white">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-[#5b6b84] dark:text-slate-400">
              Sign in to manage your records.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#10305c]/75 dark:text-slate-300">
                Username
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-[#10305c] text-[#ffad5c] shadow-[0_3px_8px_rgb(16_48_92/25%)]">
                  <UserRound aria-hidden strokeWidth={2.5} className="h-4 w-4" />
                </span>
                <Input
                  value={u}
                  onChange={(e) => setU(e.target.value)}
                  autoFocus
                  autoComplete="username"
                  className="h-12 border-[#10305c]/15 bg-white/85 pl-12 shadow-sm transition-shadow focus-visible:border-[#dd7815] focus-visible:shadow-[0_0_0_3px_rgb(221_120_21/18%)] dark:border-white/15 dark:bg-white/[0.08]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#10305c]/75 dark:text-slate-300">
                Password
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-[#10305c] text-[#ffad5c] shadow-[0_3px_8px_rgb(16_48_92/25%)]">
                  <KeyRound aria-hidden strokeWidth={2.5} className="h-4 w-4" />
                </span>
                <Input
                  type="password"
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  autoComplete="current-password"
                  className="h-12 border-[#10305c]/15 bg-white/85 pl-12 shadow-sm transition-shadow focus-visible:border-[#dd7815] focus-visible:shadow-[0_0_0_3px_rgb(221_120_21/18%)] dark:border-white/15 dark:bg-white/[0.08]"
                />
              </div>
            </div>
            {err && <p className="text-xs font-medium text-destructive">{err}</p>}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#10305c] text-sm font-semibold text-white shadow-lg shadow-[#10305c]/20 hover:bg-[#174579]"
            >
              Sign in
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex items-start gap-2.5 rounded-xl border border-[#dd7815]/25 bg-[#dd7815]/10 px-3.5 py-3">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#dd7815]" />
            <p className="text-xs leading-relaxed text-[#10305c]/80 dark:text-slate-300">
              <b>Need access?</b> Contact your admin for login credentials.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
