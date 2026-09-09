import { createFileRoute } from "@tanstack/react-router";
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
import { NotebookPen, Plus, Pencil, Trash2, Search, Download } from "lucide-react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { downloadCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/diary")({
  head: () => ({
    meta: [
      { title: "Diary Notes — M.B.S Centring Works" },
      { name: "description", content: "Daily diary and notes for labour, expenses and reminders at M.B.S Centring Works." },
      { property: "og:title", content: "Diary Notes — M.B.S Centring Works" },
      { property: "og:description", content: "Daily diary and notes for labour, expenses and reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Diary,
});

type Note = {
  id: string;
  entry_date: string;
  title: string;
  content: string;
  category: string;
  amount: number | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = ["general", "labour", "expense", "payment", "reminder"];

const emptyNote = () => ({
  entry_date: new Date().toISOString().slice(0, 10),
  title: "",
  content: "",
  category: "general",
  amount: "" as string | number,
});

function Diary() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState(emptyNote());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["diary_notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diary_notes")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return notes.filter(
      (n) =>
        (cat === "all" || n.category === cat) &&
        (!t || n.title.toLowerCase().includes(t) || n.content.toLowerCase().includes(t)),
    );
  }, [notes, q, cat]);

  const grouped = useMemo(() => {
    const map = new Map<string, Note[]>();
    filtered.forEach((n) => map.set(n.entry_date, [...(map.get(n.entry_date) ?? []), n]));
    return [...map.entries()];
  }, [filtered]);

  const startNew = () => {
    setEditing(null);
    setForm(emptyNote());
    setOpen(true);
  };
  const startEdit = (n: Note) => {
    setEditing(n);
    setForm({
      entry_date: n.entry_date,
      title: n.title,
      content: n.content,
      category: n.category,
      amount: n.amount ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim() && !form.content.trim()) throw new Error("Write a title or a note");
      const payload = {
        entry_date: form.entry_date,
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        amount: form.amount === "" ? null : Number(form.amount),
      };
      if (editing) {
        const { error } = await supabase.from("diary_notes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("diary_notes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary_notes"] });
      toast.success(editing ? "Note updated" : "Note added");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("diary_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["diary_notes"] });
      toast.success("Note deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to delete"),
  });

  const monthTotal = filtered.reduce((s, n) => s + Number(n.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-primary" /> Diary / Notes
          </h2>
          <p className="text-sm text-muted-foreground">Daily work notes, labour, expenses and reminders.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (filtered.length === 0) return toast.error("Nothing to export");
              downloadCsv(
                `diary-notes-${new Date().toISOString().slice(0, 10)}`,
                filtered.map((n) => ({
                  Date: n.entry_date,
                  Title: n.title,
                  Category: n.category,
                  Amount: n.amount ?? "",
                  Note: n.content,
                  Created: new Date(n.created_at).toLocaleString("en-IN"),
                })),
              );
              toast.success("Exported CSV");
            }}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button onClick={startNew}>
            <Plus className="h-4 w-4 mr-1.5" /> New Note
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
        <div className="rounded-md border border-border px-3 h-10 flex items-center text-sm">
          <span className="text-muted-foreground mr-2">Total</span>
          <span className="font-semibold">₹{monthTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No notes yet — tap “New Note” to write your first entry.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((n) => (
                  <Card key={n.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{n.title || "Untitled"}</div>
                          <span className="inline-block mt-1 rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize">
                            {n.category}
                          </span>
                        </div>
                        {n.amount != null && (
                          <div className="text-sm font-bold whitespace-nowrap">
                            ₹{Number(n.amount).toLocaleString("en-IN")}
                          </div>
                        )}
                      </div>
                      {n.content && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{n.content}</p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("en-IN")}
                        </span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(n)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <ConfirmDelete
                            onConfirm={() => remove.mutate(n.id)}
                            title="Delete this note?"
                            description="This diary note will be permanently removed."
                            restricted
                          >
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Delete note">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </ConfirmDelete>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Note" : "New Note"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c[0].toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                placeholder="e.g. Labour payment, plates sent to site"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ₹ (optional)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editing ? "Update Note" : "Save Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}