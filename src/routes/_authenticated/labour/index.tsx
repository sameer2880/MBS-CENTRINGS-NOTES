import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HardHat, Search, ChevronRight, Download, UserCog } from "lucide-react";
import { downloadCsv } from "@/lib/export";
import { toast } from "sonner";
import { getRole, getVisibleNotes } from "@/lib/user-role";
import { AdminOnly } from "@/components/AdminOnly";
import { isMasterAdmin } from "@/lib/access";

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

function LabourList() {
  const [q, setQ] = useState("");

  // Labour Charges only ever shows "worker" role users. There's no role
  // column — admins are marked with a hidden marker inside `notes` (see
  // @/lib/user-role) — so the split happens client-side after the fetch.
  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return (data as Worker[]).filter((w) => getRole(w.notes) === "worker");
    },
    enabled: isMasterAdmin(),
  });

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    if (!ql) return workers;
    return workers.filter((w) => w.name.toLowerCase().includes(ql) || (w.phone ?? "").includes(ql));
  }, [workers, q]);

  return (
    <AdminOnly label="Labour Charges">
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
                  Notes: getVisibleNotes(w.notes),
                  Added: new Date(w.created_at).toLocaleString("en-IN"),
                })),
              );
              toast.success("Exported CSV");
            }}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button asChild>
            <Link to="/manage-worker">
              <UserCog className="h-4 w-4 mr-1.5" /> Manage Users
            </Link>
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
            <p className="text-center py-10 text-muted-foreground">
              No workers yet.{" "}
              <Link to="/manage-worker" className="text-primary underline underline-offset-2">
                Add your first worker
              </Link>
              .
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((w) => (
              <Link
                key={w.id}
                to="/labour/$id"
                params={{ id: w.id }}
                className="rounded-lg border border-border p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.phone ? `${w.phone} · ` : ""}₹{Number(w.daily_wage).toLocaleString("en-IN")}/day
                    {!w.active && " · Login disabled"}
                  </div>
                  {w.notes && <div className="text-xs text-muted-foreground truncate mt-0.5">{getVisibleNotes(w.notes)}</div>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </AdminOnly>
  );
}