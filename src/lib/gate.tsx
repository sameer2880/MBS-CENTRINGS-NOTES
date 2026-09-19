import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { LoginIllustration } from "@/components/LoginIllustration";
import { supabase } from "@/integrations/supabase/client";
import { WORKER_ID_KEY, ADMIN_ID_KEY, ADMIN_ROLE_KEY, workerSessionKey } from "@/lib/worker-auth";
import { getRole, type UserRole } from "@/lib/user-role";

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

  // Set right after a correct sign-in when the row's password is still the
  // mobile-number default (must_set_password). The session isn't granted
  // yet — the user has to choose their own password first.
  const [pendingUser, setPendingUser] = useState<{
    id: string;
    name: string;
    role: UserRole;
    sessionToken: string | null;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newPasswordErr, setNewPasswordErr] = useState("");
  const [savingNewPassword, setSavingNewPassword] = useState(false);

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
      const selectFields =
        "id, name, email, phone, password, active, notes, session_token, must_set_password";
      const { data: userByName } = await supabase
        .from("workers")
        .select(selectFields)
        .ilike("name", u.trim())
        .maybeSingle();
      const { data: userByPhone } = userByName
        ? { data: null }
        : await supabase
            .from("workers")
            .select(selectFields)
            .eq("phone", u.trim())
            .maybeSingle();
      const { data: userByEmail } = userByName || userByPhone
        ? { data: null }
        : await supabase
            .from("workers")
            .select(selectFields)
            .ilike("email", u.trim())
            .maybeSingle();
      const userRecord = userByName ?? userByPhone ?? userByEmail;
      if (!userRecord?.password) {
        setErr("Account or password is not configured");
        return;
      }
      if (!userRecord.active) {
        setErr("This account is deactivated");
        return;
      }
      const password = p.trim();
      if (password !== userRecord.password.trim()) {
        setErr("Invalid Credentials");
        return;
      }
      const role = getRole(userRecord.notes);
      if (userRecord.must_set_password && role !== "admin") {
        // Correct credentials, but this is still the mobile-number default
        // password — hold off on granting the session until they've chosen
        // their own password. Admins are never forced through this step —
        // they can change their password anytime from "Manage my account".
        setErr("");
        setPendingUser({
          id: userRecord.id,
          name: userRecord.name,
          role,
          sessionToken: userRecord.session_token,
        });
        return;
      }
      if (userRecord.must_set_password && role === "admin") {
        // Clear the stale flag quietly so this check is skipped on future
        // logins too — the admin is signed in normally below.
        void supabase.from("workers").update({ must_set_password: false }).eq("id", userRecord.id);
      }
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
        .select("id, email, phone, password, active, notes")
        .ilike("name", identity)
        .maybeSingle();
      if (nameError) throw nameError;
      const { data: byPhone, error: phoneError } = byName
        ? { data: null, error: null }
        : await supabase
            .from("workers")
            .select("id, email, phone, password, active, notes")
            .eq("phone", identity)
            .maybeSingle();
      if (phoneError) throw phoneError;
      const record = byName ?? byPhone;
      if (!record) throw new Error("Account not found");
      if (!record.active) throw new Error("This account is deactivated");
      const { error: updateError } = await supabase
        .from("workers")
        .update({ password: nextPassword, must_set_password: false })
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

  const submitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewPasswordErr("");
    if (!pendingUser) return;
    const password = newPassword.trim();
    if (password.length < 4) {
      setNewPasswordErr("Password must be at least 4 characters");
      return;
    }
    if (password !== newPasswordConfirm.trim()) {
      setNewPasswordErr("Passwords do not match");
      return;
    }
    setSavingNewPassword(true);
    try {
      const { error } = await supabase
        .from("workers")
        .update({ password, must_set_password: false })
        .eq("id", pendingUser.id);
      if (error) throw error;
      if (!(await claimDevice(pendingUser.id, pendingUser.sessionToken))) return;
      if (pendingUser.role === "admin" || pendingUser.role === "manager") {
        localStorage.setItem(KEY, "1");
        localStorage.setItem(ADMIN_ID_KEY, pendingUser.id);
        localStorage.setItem(ADMIN_ROLE_KEY, pendingUser.role);
        localStorage.removeItem(WORKER_ID_KEY);
        setWorker(false);
        setOk(true);
        setPendingUser(null);
        setNewPassword("");
        setNewPasswordConfirm("");
        void navigate({ to: "/dashboard", replace: true });
        return;
      }
      localStorage.setItem(WORKER_ID_KEY, pendingUser.id);
      setWorker(true);
      setPendingUser(null);
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (error) {
      setNewPasswordErr(error instanceof Error ? error.message : "Unable to set password");
    } finally {
      setSavingNewPassword(false);
    }
  };

  if (pendingUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#eef6e6] px-4 py-6 sm:px-6 dark:bg-background">
        <div className="w-full max-w-[420px] overflow-hidden rounded-[2rem] border border-border/60 bg-card p-7 shadow-[0_20px_60px_rgb(16_48_92/12%)] dark:shadow-[0_20px_60px_rgb(0_0_0/45%)] sm:p-9">
          <div className="mb-7 flex items-center gap-2">
            <BrandLogo className="h-9 w-9" />
            <span className="text-lg font-bold tracking-tight text-foreground">MBS Centring Works</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome, {pendingUser.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set a password for your account to continue. You won't need to use your mobile number as
            your password again.
          </p>
          <form onSubmit={submitNewPassword} className="mt-7 space-y-4">
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              placeholder="New password (min. 4 characters)"
              className="h-12 rounded-full border-border bg-background px-5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <Input
              id="new-password-confirm"
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Confirm new password"
              className="h-12 rounded-full border-border bg-background px-5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            {newPasswordErr && <p className="text-xs font-medium text-destructive">{newPasswordErr}</p>}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 rounded-full"
                onClick={() => {
                  setPendingUser(null);
                  setNewPassword("");
                  setNewPasswordConfirm("");
                  setNewPasswordErr("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-12 flex-1 rounded-full font-semibold" disabled={savingNewPassword}>
                {savingNewPassword ? "Saving…" : "Continue"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (forgotOpen) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#eef6e6] px-4 py-6 sm:px-6 dark:bg-background">
        <div className="w-full max-w-[420px] overflow-hidden rounded-[2rem] border border-border/60 bg-card p-7 shadow-[0_20px_60px_rgb(16_48_92/12%)] dark:shadow-[0_20px_60px_rgb(0_0_0/45%)] sm:p-9">
          <div className="mb-7 flex items-center gap-2">
            <BrandLogo className="h-9 w-9" />
            <span className="text-lg font-bold tracking-tight text-foreground">MBS Centring Works</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Reset password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your account name or mobile number to reset your password.
          </p>
          <form onSubmit={resetAdminPassword} className="mt-7 space-y-4">
            <Input
              id="forgot-user"
              value={forgotUser}
              onChange={(event) => setForgotUser(event.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="Name or mobile number"
              className="h-12 rounded-full border-border bg-background px-5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <Input
              id="forgot-password"
              type="password"
              value={forgotPassword}
              onChange={(event) => setForgotPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="New password (min. 4 characters)"
              className="h-12 rounded-full border-border bg-background px-5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <Input
              id="forgot-confirm"
              type="password"
              value={forgotConfirm}
              onChange={(event) => setForgotConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              className="h-12 rounded-full border-border bg-background px-5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            {forgotErr && <p className="text-xs font-medium text-destructive">{forgotErr}</p>}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-12 flex-1 rounded-full"
                onClick={() => {
                  setForgotOpen(false);
                  setForgotErr("");
                  setForgotUser("");
                  setForgotPassword("");
                  setForgotConfirm("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-12 flex-1 rounded-full font-semibold" disabled={forgotSaving}>
                {forgotSaving ? "Resetting…" : "Reset"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#eef6e6] px-4 py-6 sm:px-6 md:py-10 dark:bg-background">
      <div className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-[2rem] bg-card shadow-[0_24px_70px_-12px_rgb(16_48_92/18%)] ring-1 ring-black/5 dark:shadow-[0_24px_70px_-12px_rgb(0_0_0/55%)] dark:ring-white/10 md:max-w-[460px] lg:max-w-[1000px] lg:flex-row">
        {/* Illustration panel — only room for this once the desktop tier kicks in */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#7ab558] via-primary to-[#22331c] lg:flex lg:w-[46%] lg:items-center lg:justify-center">
          {/* soft blurred accent blobs — safer and cleaner than hand-drawn shapes */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-black/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-10 top-10 h-24 w-24 rounded-full bg-[#c8e896]/25 blur-2xl"
          />

          <div className="relative z-10 flex flex-col items-center gap-8">
            <div className="rounded-[2.5rem] bg-white/10 p-8 backdrop-blur-sm">
              <LoginIllustration className="h-56 w-56 drop-shadow-2xl" />
            </div>
            <div className="text-center text-white/90">
              <p className="text-lg font-semibold">Centring &amp; shuttering, tracked end to end</p>
              <p className="mt-1 text-sm text-white/60">
                Rentals, returns, payments and worker records — all in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Form panel — the only panel on mobile and tablet */}
        <div className="flex w-full flex-1 items-center justify-center px-6 py-10 sm:px-10 md:px-12 lg:px-14 lg:py-14">
          <div className="w-full max-w-[360px]">
            <div className="mb-8 flex items-center gap-2.5">
              <BrandLogo className="h-10 w-10" />
              <span className="text-lg font-bold tracking-tight text-foreground">
                MBS Centring Works
              </span>
            </div>

            <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-[#eaf3e2] to-[#dbe9cd] lg:hidden">
              <LoginIllustration className="h-24 w-24" />
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to manage your records</p>

            <form onSubmit={submit} className="mt-8 space-y-3.5">
              <Input
                id="gate-username"
                value={u}
                onChange={(e) => setU(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="Username or mobile number"
                className="h-12 rounded-full border-border bg-background px-5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />

              <div className="relative">
                <Input
                  id="gate-password"
                  type={showPassword ? "text" : "password"}
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Password"
                  className="h-12 rounded-full border-border bg-background px-5 pr-12 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center justify-end pt-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen(true);
                    setForgotErr("");
                  }}
                  className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {err && <p className="text-xs font-medium text-destructive">{err}</p>}

              <Button
                type="submit"
                className="h-12 w-full rounded-full text-sm font-semibold shadow-md shadow-primary/20 transition-transform active:scale-[0.99]"
              >
                Sign in
              </Button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Need access? <span className="font-semibold text-primary">Contact your admin</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}