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
  HardHat,
  Shield,
} from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import type { Worker } from "./labour";
import { type UserRole, getRole, getVisibleNotes, encodeNotes } from "@/lib/user-role";

export const Route = createFileRoute("/_authenticated/manage-worker")({
  head: () => ({
    meta: [
      { title: "Manage Users — M.B.S Centring Works" },
      {
        name: "description",
        content:
          "Create, update or remove worker and admin users, and control their login access for M.B.S Centring Works.",
      },
      { property: "og:title", content: "Manage Users — M.B.S Centring Works" },
      { property: "og:description", content: "Create, update, remove and grant access to worker and admin users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageUsers,
});

// A "user" here is a workers-table row plus its role, derived from a hidden
// marker in `notes` (see @/lib/user-role) rather than a database column.
type ManagedUser = Worker & { role: UserRole };

const emptyForm = () => ({
  name: "",
  phone: "",
  daily_wage: "" as string | number,
  notes: "",
  role: "worker" as UserRole,
});

const MOBILE_REGEX = /^[6789]\d{9}$/;

const ROLE_FILTERS: { value: "all" | UserRole; label: string }[] = [
  { value: "all", label: "All" },
  { value: "worker", label: "Workers" },
  { value: "admin", label: "Admins" },
];

function ManageUsers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");

  // Manage Users is the single place that sees every row in the "workers"
  // table, whatever its role — Labour Charges only ever sees role="worker".
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return (data as Worker[]).map((w) => ({ ...w, role: getRole(w.notes) }) satisfies ManagedUser);
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        daily_wage: form.role === "worker" ? Number(form.daily_wage) || 0 : 0,
        notes: encodeNotes(form.role, form.notes),
      };
      if (!payload.name) throw new Error("Name is required");
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
      toast.success(editing ? "User updated" : "User added");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm());
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
      toast.success("User removed");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createAccount = useMutation({
    mutationFn: async (user: ManagedUser) => {
      if (!user.phone?.trim()) throw new Error("Add a mobile number before creating a login");
      if (!user.active) {
        const { error } = await supabase.from("workers").update({ active: true }).eq("id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, user) => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      setEditing((current) => (current?.id === user.id ? { ...current, active: true } : current));
      toast.success("Login enabled. Name is the username; mobile is the password.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disableAccount = useMutation({
    mutationFn: async (user: ManagedUser) => {
      const { error } = await supabase.from("workers").update({ active: false }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: (_, user) => {
      qc.invalidateQueries({ queryKey: ["workers"] });
      setEditing((current) => (current?.id === user.id ? { ...current, active: false } : current));
      toast.success("Account deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return users
      .filter((u) => roleFilter === "all" || u.role === roleFilter)
      .filter((u) => !ql || u.name.toLowerCase().includes(ql) || (u.phone ?? "").includes(ql));
  }, [users, q, roleFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> Manage Users
          </h2>
          <p className="text-sm text-muted-foreground">
            Create, edit or remove users, assign a Worker or Admin role, and turn login access on or off
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm());
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or mobile" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1.5">
              {ROLE_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  size="sm"
                  variant={roleFilter === f.value ? "default" : "outline"}
                  onClick={() => setRoleFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {isLoading && <p className="text-center py-10 text-muted-foreground">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-center py-10 text-muted-foreground">No users found. Add your first user.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((u) => (
              <div key={u.id} className="rounded-lg border border-border p-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold truncate">{u.name}</span>
                    {u.role === "admin" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Shield className="h-3 w-3" /> Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <HardHat className="h-3 w-3" /> Worker
                      </span>
                    )}
                    {u.active ? (
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
                    {u.phone ? `${u.phone} · ` : ""}
                    {u.role === "worker" ? `₹${Number(u.daily_wage).toLocaleString("en-IN")}/day` : "Management access"}
                  </div>
                  {getVisibleNotes(u.notes) && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{getVisibleNotes(u.notes)}</div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1 sm:shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditing(u);
                      setForm({
                        name: u.name,
                        phone: u.phone ?? "",
                        daily_wage: u.daily_wage,
                        notes: getVisibleNotes(u.notes),
                        role: u.role,
                      });
                      setOpen(true);
                    }}
                    aria-label={`Edit ${u.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDelete
                    onConfirm={() => del.mutate(u.id)}
                    title={`Delete ${u.name}?`}
                    description={
                      u.role === "worker"
                        ? "All attendance and payment records for this worker will also be removed."
                        : "This admin user will lose access immediately."
                    }
                  >
                    <Button variant="ghost" size="icon" className="text-destructive" aria-label="Delete user">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </ConfirmDelete>
                  {u.role === "worker" && (
                    <Link
                      to="/labour/$id"
                      params={{ id: u.id }}
                      aria-label={`Open ${u.name}'s attendance`}
                      title="View attendance & payments"
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Role</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={form.role === "worker" ? "default" : "outline"}
                  className="justify-center"
                  onClick={() => setForm({ ...form, role: "worker" })}
                >
                  <HardHat className="h-4 w-4 mr-1.5" /> Worker
                </Button>
                <Button
                  type="button"
                  variant={form.role === "admin" ? "default" : "outline"}
                  className="justify-center"
                  onClick={() => setForm({ ...form, role: "admin" })}
                >
                  <Shield className="h-4 w-4 mr-1.5" /> Admin
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {form.role === "worker"
                  ? "Shows up in Labour Charges for attendance and payments."
                  : "Management access only — won't appear in Labour Charges."}
              </p>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
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
              {form.role === "worker" && (
                <div>
                  <Label>Daily wage (₹)</Label>
                  <Input
                    type="number"
                    value={form.daily_wage}
                    onChange={(e) => setForm({ ...form, daily_wage: e.target.value })}
                    placeholder="0"
                  />
                </div>
              )}
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
                    description="This user will no longer be able to log in. Their records will remain available to staff."
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