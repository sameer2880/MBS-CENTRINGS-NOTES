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
import { HardHat, Plus, Pencil, Trash2, Search, ChevronRight, Download } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { downloadCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/labour/")({
  head: () => ({
    meta: [
      { title: "Labour Charges — M.B.S Centring Works" },
      { name: "description", content: "Day by day labour attendance and worker payment records for M.B.S Centring Works." },
      { property: "og:title", content: "Labour Charges — M.B.S Centring Works" },
      { property: "og:description", content: "Track worker attendance and daily payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LabourList,
});

export type Worker = {
  id: string;
  name: string;
  phone: string | null;
  daily_wage: number;
  active: boolean;
  notes: string | null;
  created_at: string;
};

const emptyWorker = () => ({ name: "", phone: "", daily_wage: "" as string | number, notes: "" });

function LabourList() {
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
    },
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
            <HardHat className="h-6 w-6 text-primary" /> Labour Charges
          </h2>
          <p className="text-sm text-muted-foreground">Workers list · open a worker for attendance and payments</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (workers.length === 0) return toast.error("No workers to export");
              downloadCsv(
                `workers-${new Date().toISOString().slice(0, 10)}`,
                workers.map((w) => ({
                  Name: w.name,
                  Mobile: w.phone ?? "",
                  "Daily wage": w.daily_wage,
                  Notes: w.notes ?? "",
                  Added: new Date(w.created_at).toLocaleString("en-IN"),
                })),
              );
              toast.success("Exported CSV");
            }}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
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
              <div key={w.id} className="rounded-lg border border-border p-3 flex items-center gap-3">
                <Link to="/labour/$id" params={{ id: w.id }} className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.phone ? `${w.phone} · ` : ""}₹{Number(w.daily_wage).toLocaleString("en-IN")}/day
                  </div>
                  {w.notes && <div className="text-xs text-muted-foreground truncate mt-0.5">{w.notes}</div>}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditing(w);
                    setForm({ name: w.name, phone: w.phone ?? "", daily_wage: w.daily_wage, notes: w.notes ?? "" });
                    setOpen(true);
                  }}
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
                <Link to="/labour/$id" params={{ id: w.id }}>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
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
                <Label>Mobile</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
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
          </div>
          <DialogFooter>
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
