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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  ShieldAlert,
  Crown,
} from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import type { Worker } from "./labour";
import { type UserRole, getRole, getVisibleNotes, encodeNotes } from "@/lib/user-role";
import { isMasterAdmin, isManager } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/manage-worker")({
  head: () => ({
    meta: [
      { title: "Manage Users — M.B.S Centring Works" },
      {
        name: "description",
        content:
          "Create, update or remove worker, manager and admin users, and control their login access for M.B.S Centring Works.",
      },
      { property: "og:title", content: "Manage Users — M.B.S Centring Works" },
      {
        property: "og:description",
        content: "Create, update, remove and grant access to worker, manager and admin users.",
      },
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

const ALL_ROLE_FILTERS: { value: "all" | UserRole; label: string }[] = [
  { value: "all", label: "All" },
  { value: "worker", label: "Workers" },
  { value: "manager", label: "Managers" },
  { value: "admin", label: "Admins" },
];

const ROLE_BADGE: Record<UserRole, { label: string; icon: typeof Shield; className: string }> = {
  worker: {
    label: "Worker",
    icon: HardHat,
    className: "bg-muted text-muted-foreground",
  },
  manager: {
    label: "Manager",
    icon: Shield,
    className: "bg-primary/10 text-primary",
  },
  admin: {
    label: "Admin",
    icon: Crown,
    className: "bg-amber-500/10 text-amber-600",
  },
};

function ManageUsers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [delUser, setDelUser] = useState<ManagedUser | null>(null);

  // A manager only ever gets to see (and add) Workers here — Admins and
  // other Managers are hidden from them entirely. The full admin (master
  // login or an "admin"-role row) sees everyone.
  const managerView = isManager();

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
      // A manager can only ever create/edit Workers, no matter what the
      // form state says — enforced here as well as in the UI.
      const role: UserRole = managerView ? "worker" : form.role;
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        daily_wage: role === "worker" ? Number(form.daily_wage) || 0 : 0,
        notes: encodeNotes(role, form.notes),
      };
      if (!payload.name) throw new Error("Name is required");
      if (payload.phone && !MOBILE_REGEX.test(payload.phone)) {
        throw new Error("Mobile number must be 10 digits and start with 6, 7, 8 or 9");
      }
      if (editing) {
        if (managerView && editing.role !== "worker") {
          throw new Error("You can only manage worker accounts. Ask the admin for this change.");
        }
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
      setDelUser(null);
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
      // Managers only ever see Workers here, regardless of the filter UI.
      .filter((u) => (managerView ? u.role === "worker" : roleFilter === "all" || u.role === roleFilter))
      .filter((u) => !ql || u.name.toLowerCase().includes(ql) || (u.phone ?? "").includes(ql));
  }, [users, q, roleFilter, managerView]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" /> Manage Users
          </h2>
          <p className="text-sm text-muted-foreground">
            {managerView
              ? "Add workers and turn their login access on or off. Ask the admin to add or remove a manager or admin, or to delete any user."
              : "Create, edit or remove users, assign a Worker, Manager or Admin role, and turn login access on or off"}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm());
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" /> {managerView ? "Add Worker" : "Add User"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or mobile" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            {!managerView && (
              <div className="flex gap-1.5">
                {ALL_ROLE_FILTERS.map((f) => (
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
            )}
          </div>

          <div className="overflow-x-auto -mx-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S.No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Wage / Access</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-10">Loading…</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No users found. Add your first user.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u, idx) => {
                  const badge = ROLE_BADGE[u.role];
                  const BadgeIcon = badge.icon;
                  return (
                  <TableRow key={u.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{u.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                        <BadgeIcon className="h-3 w-3" /> {badge.label}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{u.phone || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {u.role === "worker" ? `₹${Number(u.daily_wage).toLocaleString("en-IN")}/day` : "Management access"}
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <ShieldCheck className="h-3 w-3" /> Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          <ShieldOff className="h-3 w-3" /> No login
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {getVisibleNotes(u.notes) || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          >
                            Actions
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
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
                          >
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {u.role === "worker" && (
                            <DropdownMenuItem asChild>
                              <Link to="/labour/$id" params={{ id: u.id }}>
                                <ChevronRight className="h-4 w-4 mr-2" /> View attendance
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDelUser(u)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!delUser} onOpenChange={(v) => !v && setDelUser(null)}>
        <AlertDialogContent>
          {isMasterAdmin() ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {delUser?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {delUser?.role === "worker"
                    ? "All attendance and payment records for this worker will also be removed."
                    : "This user will lose access immediately."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => delUser && del.mutate(delUser.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-muted-foreground" /> Ask the admin
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Managers can't delete users. To delete this, please ask the admin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction>Got it</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {managerView ? (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Managers can only add or edit Workers. Ask the admin to create a Manager or Admin account.
              </p>
            ) : (
              <div>
                <Label>Role</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
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
                    variant={form.role === "manager" ? "default" : "outline"}
                    className="justify-center"
                    onClick={() => setForm({ ...form, role: "manager" })}
                  >
                    <Shield className="h-4 w-4 mr-1.5" /> Manager
                  </Button>
                  <Button
                    type="button"
                    variant={form.role === "admin" ? "default" : "outline"}
                    className="justify-center"
                    onClick={() => setForm({ ...form, role: "admin" })}
                  >
                    <Crown className="h-4 w-4 mr-1.5" /> Admin
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {form.role === "worker"
                    ? "Shows up in Labour Charges for attendance and payments."
                    : form.role === "manager"
                      ? "Full management access, but deletions (other than Rentals) need the admin."
                      : "Full management access, including deleting anything — same rights as the admin."}
                </p>
              </div>
            )}
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
              {(managerView || form.role === "worker") && (
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