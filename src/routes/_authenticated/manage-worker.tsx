import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronRight,
  UserPlus,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import type { Worker } from "./labour";

export const Route = createFileRoute("/_authenticated/manage-worker")({
  head: () => ({
    meta: [
      { title: "Manage Workers — M.B.S Centring Works" },
      {
        name: "description",
        content: "Add, edit, remove workers and manage their login access for M.B.S Centring Works.",
      },
      { property: "og:title", content: "Manage Workers — M.B.S Centring Works" },
      { property: "og:description", content: "Add, edit, remove workers and manage login access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageWorkers,
});

const emptyWorker = () => ({ name: "", phone: "", daily_wage: "" as string | number, notes: "" });

const MOBILE_REGEX = /^[6789]\d{9}$/;

function ManageWorkers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState(emptyWorker());
  const [q, setQ] = useState("");

  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return data as Worker[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        daily_wage: Number(form.daily_wage) || 0,
        notes: form.notes.trim() || null,
      };
      if (!payload.name) throw new Error("Worker name is required");
      if (payload.phone && !MOBILE_REGEX.test(payload.phone)) {
        throw new Error("Mobile number must be 10 digits and start with 6, 7, 8 or 9");
      }
      if (editing) {
        const { error } = await supabase.from("workers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      toast.success(editing ? "Worker updated" : "Worker added");
      setOpen(false);
      setEditing(null);
      setForm(emptyWorker());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      toast.success("Worker removed");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAccount = useMutation({
    mutationFn: async (worker: Worker) => {
      if (!worker.phone?.trim()) throw new Error("Add a mobile number before creating a login");
      if (!worker.active) {
        const { error } = await supabase.from("workers").update({ active: true }).eq("id", worker.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, worker) => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      setEditing((current) => (current?.id === worker.id ? { ...current, active: true } : current));
      toast.success("Worker login enabled. Name is the username; mobile is the password.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disableAccount = useMutation({
    mutationFn: async (worker: Worker) => {
      const { error } = await supabase.from("workers").update({ active: false }).eq("id", worker.id);
      if (error) throw error;
    },
    onSuccess: (_, worker) => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      setEditing((current) => (current?.id === worker.id ? { ...current, active: false } : current));
      toast.success("Worker account deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    if (!ql) return workers;
    return workers.filter((w) => w.name.toLowerCase().includes(ql) || (w.phone ?? "").includes(ql));
  }, [workers, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> Manage Workers
          </h2>
          <p className="text-sm text-muted-foreground">
            Add, edit or remove workers, and turn their login access on or off
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyWorker());
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Worker
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search worker by name or mobile" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>

          {isLoading && <p className="text-center py-10 text-muted-foreground">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-center py-10 text-muted-foreground">No workers yet. Add your first worker.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((w) => (
              <div key={w.id} className="rounded-lg border border-border p-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{w.name}</span>
                    {w.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <ShieldCheck className="h-3 w-3" /> Login enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <ShieldOff className="h-3 w-3" /> No login
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {w.phone ? `${w.phone} · ` : ""}₹{Number(w.daily_wage).toLocaleString("en-IN")}/day
                  </div>
                  {w.notes && <div className="text-xs text-muted-foreground truncate mt-0.5">{w.notes}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-1 sm:shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(w);
                      setForm({ name: w.name, phone: w.phone ?? "", daily_wage: w.daily_wage, notes: w.notes ?? "" });
                      setOpen(true);
                    }}
                    aria-label={`Edit ${w.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDelete
                    onConfirm={() => del.mutate(w.id)}
                    title={`Delete ${w.name}?`}
                    description="All attendance and payment records for this worker will also be removed."
                  >
                    <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete worker">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ConfirmDelete>
                  <Link
                    to="/labour/$id"
                    params={{ id: w.id }}
                    aria-label={`Open ${w.name}'s attendance`}
                    title="View attendance & payments"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit worker" : "Add worker"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Worker name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mobile (used as password)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
                  }
                  placeholder="10-digit mobile, e.g. 9876543210"
                  inputMode="numeric"
                  maxLength={10}
                />
                {form.phone.length > 0 && !MOBILE_REGEX.test(form.phone) && (
                  <p className="mt-1 text-xs text-destructive">
                    Must be 10 digits, starting with 6, 7, 8 or 9
                  </p>
                )}
              </div>
              <div>
                <Label>Daily wage (₹)</Label>
                <Input
                  type="number"
                  value={form.daily_wage}
                  onChange={(e) => setForm({ ...form, daily_wage: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            {editing && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {!editing.active && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => createAccount.mutate(editing)}
                    disabled={createAccount.isPending}
                  >
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Enable login
                  </Button>
                )}
                {editing.active && (
                  <ConfirmDelete
                    onConfirm={() => disableAccount.mutate(editing)}
                    title={`Deactivate ${editing.name}'s account?`}
                    description="This worker will no longer be able to log in. Their attendance and payment records will remain available to staff."
                    confirmLabel="Deactivate account"
                  >
                    <Button type="button" variant="destructive">
                      Deactivate account
                    </Button>
                  </ConfirmDelete>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}