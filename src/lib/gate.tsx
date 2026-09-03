import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUser, setForgotUser] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");
  const [forgotErr, setForgotErr] = useState("");
  const [forgotSaving, setForgotSaving] = useState(false);

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

  const resetAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErr("");
    const identity = forgotUser.trim();
    const nextPassword = forgotPassword.trim();
    if (!identity) {
      setForgotErr("Enter your name or mobile number");
      return;
    }
    if (nextPassword.length < 4) {
      setForgotErr("New password must be at least 4 characters");
      return;
    }
    if (nextPassword !== forgotConfirm.trim()) {
      setForgotErr("Passwords do not match");
      return;
    }

    setForgotSaving(true);
    try {
      const { data: byName, error: nameError } = await supabase
        .from("workers")
        .select("id, phone, active, notes")
        .ilike("name", identity)
        .maybeSingle();
      if (nameError) throw nameError;
      const { data: byPhone, error: phoneError } = byName
        ? { data: null, error: null }
        : await supabase
            .from("workers")
            .select("id, phone, active, notes")
            .eq("phone", identity)
            .maybeSingle();
      if (phoneError) throw phoneError;
      const record = byName ?? byPhone;
      if (!record) throw new Error("Account not found");
      if (!record.active) throw new Error("This account is deactivated");
      const { error: updateError } = await supabase
        .from("workers")
        .update({ phone: nextPassword })
        .eq("id", record.id);
      if (updateError) throw updateError;
      setForgotOpen(false);
      setForgotUser("");
      setForgotPassword("");
      setForgotConfirm("");
      setErr("Password reset successfully. Sign in with your new password.");
    } catch (error) {
      setForgotErr(error instanceof Error ? error.message : "Unable to reset password");
    } finally {
      setForgotSaving(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7fafb] px-4 py-4 text-[#164f67] sm:px-6 lg:py-6">
      <div className="flex min-h-[min(700px,calc(100dvh-2rem))] w-full max-w-[1080px] overflow-hidden rounded-xl border border-[#4d5558] bg-white shadow-[0_12px_35px_rgb(15_42_49/10%)] dark:border-white/15 dark:bg-[#102038] lg:min-h-[700px]">
        <div
          className="hidden w-1/2 bg-cover bg-center lg:block"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgb(209 230 237 / 12%), rgb(209 230 237 / 12%)), url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=85')",
          }}
          aria-label="Modern glass building"
          role="img"
        />

        <div className="flex w-full items-center justify-center bg-white px-5 py-10 dark:bg-[#102038] sm:px-10 lg:w-1/2 lg:px-14">
          <Card className="w-full max-w-[410px] border-0 bg-transparent shadow-none dark:bg-transparent">
            <CardContent className="space-y-6 p-0">
              <div className="text-center lg:text-left">
                <img
                  src={logo}
                  alt="MBS Centring Works"
                  className="mx-auto mb-3 h-20 w-20 object-contain"
                />
                <div className="mb-2 flex items-center justify-center gap-1 text-lg font-bold">
                  <span className="text-[#164f67]">MBS</span>
                  <span className="text-[#f56b52]">CENTRING WORKS</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-[#252a2c] dark:text-white">
                  Login
                </h1>
                <p className="mt-2 text-sm text-[#8a9498] dark:text-slate-400">
                  Sign in to manage your records
                </p>
              </div>

              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="gate-username" className="text-sm font-medium text-[#252a2c] dark:text-slate-200">
                    Email or username
                  </label>
                  <div className="relative">
                    <Mail aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="gate-username"
                      value={u}
                      onChange={(e) => setU(e.target.value)}
                      autoFocus
                      autoComplete="username"
                      placeholder="username or mobile"
                      className="h-11 rounded-md border-0 border-b border-[#d8dfe1] bg-transparent pl-10 text-sm shadow-none placeholder:text-[#b5bdc0] focus-visible:border-[#f56b52] focus-visible:ring-0 dark:border-white/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="gate-password" className="text-sm font-medium text-[#252a2c] dark:text-slate-200">
                    Password
                  </label>
                  <div className="relative">
                    <LockKeyhole aria-hidden className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="gate-password"
                      type={showPassword ? "text" : "password"}
                      value={p}
                      onChange={(e) => setP(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Password"
                      className="h-11 rounded-md border-0 border-b border-[#d8dfe1] bg-transparent pl-10 pr-10 text-sm shadow-none placeholder:text-[#b5bdc0] focus-visible:border-[#f56b52] focus-visible:ring-0 dark:border-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-slate-400 hover:text-[#164f67]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotOpen(true);
                      setForgotErr("");
                    }}
                    className="font-medium text-[#a94b23] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                {err && <p className="text-xs font-medium text-destructive">{err}</p>}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-md bg-[#f4511e] text-sm font-semibold text-white shadow-sm hover:bg-[#df4315]"
                >
                  Sign in
                </Button>
              </form>

              <div className="text-center text-sm text-[#252a2c] dark:text-slate-300">
                Need access? <span className="font-semibold text-[#a94b23]">Contact your admin</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={forgotOpen}
        onOpenChange={(open) => {
          setForgotOpen(open);
          if (!open) {
            setForgotErr("");
            setForgotUser("");
            setForgotPassword("");
            setForgotConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
          </DialogHeader>
          <form onSubmit={resetAdminPassword} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the account name or mobile number to reset your account password.
            </p>
            <div className="space-y-2">
              <label htmlFor="forgot-user" className="text-sm font-medium">Name or mobile number</label>
              <Input
                id="forgot-user"
                value={forgotUser}
                onChange={(event) => setForgotUser(event.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="forgot-password" className="text-sm font-medium">New password</label>
              <Input
                id="forgot-password"
                type="password"
                value={forgotPassword}
                onChange={(event) => setForgotPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="forgot-confirm" className="text-sm font-medium">Confirm new password</label>
              <Input
                id="forgot-confirm"
                type="password"
                value={forgotConfirm}
                onChange={(event) => setForgotConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            {forgotErr && <p className="text-xs font-medium text-destructive">{forgotErr}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={forgotSaving}>
                {forgotSaving ? "Resetting..." : "Reset password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
