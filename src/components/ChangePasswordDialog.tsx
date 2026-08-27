import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCog } from "lucide-react";
import { ADMIN_ID_KEY } from "@/lib/worker-auth";

const MOBILE_REGEX = /^[6789]\d{9}$/;

const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 10);

/**
 * Only renders for the currently logged-in user when they logged in as an
 * admin- or manager-role row (i.e. ADMIN_ID_KEY is set). The single shared
 * master login (mbscentringworks/mbs) has no row in the database, so
 * there's nothing here for it to update — that credential is fixed in the
 * app's code.
 */
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const qc = useQueryClient();

  const adminId = typeof window !== "undefined" ? localStorage.getItem(ADMIN_ID_KEY) : null;

  const save = useMutation({
    mutationFn: async () => {
      if (!adminId) throw new Error("No admin account found for this session");
      const { data: record, error: fetchError } = await supabase
        .from("workers")
        .select("phone")
        .eq("id", adminId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!record?.phone || current.trim() !== record.phone.trim()) {
        throw new Error("Current password is incorrect");
      }
      if (!MOBILE_REGEX.test(next.trim())) {
        throw new Error("New password must be a 10-digit mobile number starting with 6, 7, 8 or 9");
      }
      if (next.trim() !== confirm.trim()) {
        throw new Error("New passwords do not match");
      }
      const { error } = await supabase.from("workers").update({ phone: next.trim() }).eq("id", adminId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Password changed successfully");
      setOpen(false);
      setCurrent("");
      setNext("");
      setConfirm("");
      setErr("");
    },
    onError: (e: Error) => setErr(e.message),
  });

  // Master shared login — nothing to self-manage here.
  if (!adminId) return null;

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
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Your password is your mobile number. Enter your current mobile number and the new one you want to use.
            </p>
            <div>
              <Label>Current password</Label>
              <Input
                type="password"
                value={current}
                onChange={(e) => setCurrent(digitsOnly(e.target.value))}
                inputMode="numeric"
                maxLength={10}
                autoComplete="current-password"
              />
            </div>
            <div>
              <Label>New password</Label>
              <Input
                type="password"
                value={next}
                onChange={(e) => setNext(digitsOnly(e.target.value))}
                inputMode="numeric"
                maxLength={10}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(digitsOnly(e.target.value))}
                inputMode="numeric"
                maxLength={10}
                autoComplete="new-password"
              />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}