import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCog, Shield, Crown, KeyRound } from "lucide-react";
import { ADMIN_ID_KEY } from "@/lib/worker-auth";
import { getRole } from "@/lib/user-role";

const ROLE_DISPLAY = {
  manager: { label: "Manager", icon: Shield, className: "bg-primary/10 text-primary" },
  admin: { label: "Admin", icon: Crown, className: "bg-amber-500/10 text-amber-600" },
} as const;

/**
 * Only renders for the currently logged-in user when they logged in as an
 * admin- or manager-role row (i.e. ADMIN_ID_KEY is set). The single shared
 * master login (mbscentringworks/mbs) has no row in the database, so
 * there's nothing here for it to update — that credential is fixed in the
 * app's code.
 */
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const qc = useQueryClient();

  const adminId = typeof window !== "undefined" ? localStorage.getItem(ADMIN_ID_KEY) : null;

  const { data: me } = useQuery({
    queryKey: ["workers", "me", adminId],
    queryFn: async () => {
      if (!adminId) return null;
      const { data, error } = await supabase.from("workers").select("name, notes").eq("id", adminId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!adminId,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!adminId) throw new Error("No admin account found for this session");
      const { data: record, error: fetchError } = await supabase
        .from("workers")
        .select("phone")
        .eq("id", adminId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!record?.phone || current !== record.phone) {
        throw new Error("Current password is incorrect");
      }
      if (next.length < 4) {
        throw new Error("New password must be at least 4 characters");
      }
      if (next !== confirm) {
        throw new Error("New passwords do not match");
      }
      const { error } = await supabase.from("workers").update({ phone: next.trim() }).eq("id", adminId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Password changed successfully");
      setOpen(false);
      setShowForm(false);
      setCurrent("");
      setNext("");
      setConfirm("");
      setErr("");
    },
    onError: (e: Error) => setErr(e.message),
  });

  // Master shared login — nothing to self-manage here.
  if (!adminId) return null;

  // Role comes from the live row (falls back to nothing while loading —
  // this component only ever renders for admin/manager sessions).
  const role = me ? getRole(me.notes) : null;
  const roleInfo = role === "admin" || role === "manager" ? ROLE_DISPLAY[role] : null;
  const RoleIcon = roleInfo?.icon;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center gap-2 font-semibold"
        onClick={() => setOpen(true)}
      >
        <UserCog className="h-4 w-4" />
        Manage my account
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setShowForm(false);
            setErr("");
            setCurrent("");
            setNext("");
            setConfirm("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage my account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{me?.name ?? "…"}</div>
                {roleInfo && RoleIcon && (
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${roleInfo.className}`}
                  >
                    <RoleIcon className="h-3 w-3" /> {roleInfo.label}
                  </span>
                )}
              </div>
            </div>

            {!showForm ? (
              <div className="border-t border-border pt-4">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2 font-semibold"
                  onClick={() => setShowForm(true)}
                >
                  <KeyRound className="h-4 w-4" />
                  Change password
                </Button>
              </div>
            ) : (
              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <p className="text-sm font-semibold">Change password</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Enter your current password and the new password you want to use.
                  </p>
                </div>
                <div>
                  <Label>Current password</Label>
                  <Input
                    type="password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <Label>New password</Label>
                  <Input
                    type="password"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label>Confirm new password</Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                {err && <p className="text-xs text-destructive">{err}</p>}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {!showForm ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setErr("");
                    setCurrent("");
                    setNext("");
                    setConfirm("");
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    setErr("");
                    save.mutate();
                  }}
                  disabled={save.isPending}
                >
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}