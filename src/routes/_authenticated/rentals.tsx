import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listRentals, buildConfirmMessage, buildReminderMessage, buildReturnMessage, whatsappUrl, type Rental,
} from "@/lib/rentals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, MessageCircle, CheckCircle2, Copy, Printer, Bell } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { RentalForm } from "@/components/RentalForm";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/rentals")({
  component: RentalsPage,
});

const PAGE = 10;

function RentalsPage() {
  const qc = useQueryClient();
  const { data: rentals = [], isLoading } = useQuery({ queryKey: ["rentals"], queryFn: listRentals });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Rental["status"]>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rental | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return rentals.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!ql) return true;
      return (
        r.customer_name.toLowerCase().includes(ql) ||
        r.customer_phone.includes(ql) ||
        r.material_name.toLowerCase().includes(ql)
      );
    });
  }, [rentals, q, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

  const markReturned = useMutation({
    mutationFn: async (r: Rental) => {
      const { error } = await supabase.from("rentals").update({ status: "returned" }).eq("id", r.id);
      if (error) throw error;
      return r;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["rentals"] });
      toast.success("Marked as returned", {
        action: { label: "Send WhatsApp", onClick: () => window.open(whatsappUrl(r.customer_phone, buildReturnMessage(r)), "_blank") },
      });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rentals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rentals"] }); toast.success("Rental deleted"); setDelId(null); },
  });

  const counts = {
    all: rentals.length,
    active: rentals.filter((r) => r.status === "active").length,
    overdue: rentals.filter((r) => r.status === "overdue").length,
    returned: rentals.filter((r) => r.status === "returned").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Rentals</h2>
          <p className="text-sm text-muted-foreground">Manage all material rental records</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> New Rental
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name, mobile or material" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "active", "overdue", "returned"] as const).map((s) => (
                <Button key={s} variant={status === s ? "default" : "outline"} size="sm" onClick={() => { setStatus(s); setPage(1); }} className="capitalize">
                  {s} <span className="ml-1.5 text-[10px] opacity-70">({counts[s]})</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto -mx-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Return</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-10">Loading…</TableCell></TableRow>}
                {!isLoading && pageRows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No rentals found</TableCell></TableRow>
                )}
                {pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <div>{r.customer_name}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        Added {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        {r.updated_at && r.updated_at !== r.created_at && (
                          <> · Updated {new Date(r.updated_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{r.customer_phone}</TableCell>
                    <TableCell>{r.material_name}</TableCell>
                    <TableCell className="text-right">{r.quantity} {r.unit}</TableCell>
                    <TableCell className="text-right font-semibold">₹{Number(r.total_amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.issue_date}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.return_date}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">Actions</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(r); setOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {r.status !== "returned" && (
                            <DropdownMenuItem onClick={() => markReturned.mutate(r)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Mark returned
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => window.open(whatsappUrl(r.customer_phone, buildConfirmMessage(r)), "_blank")}>
                            <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp confirmation
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(whatsappUrl(r.customer_phone, buildReminderMessage(r)), "_blank")}>
                            <Bell className="h-4 w-4 mr-2" /> WhatsApp reminder
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              await navigator.clipboard.writeText(buildConfirmMessage(r));
                              toast.success("Message copied");
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" /> Copy message
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link to="/receipts/$id" params={{ id: r.id }}>
                              <Printer className="h-4 w-4 mr-2" /> Print receipt
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDelId(r.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page} of {pages} · {filtered.length} records</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Button>
                <Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RentalForm open={open} onOpenChange={setOpen} editing={editing} />

      <AlertDialog open={!!delId} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rental?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && del.mutate(delId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
