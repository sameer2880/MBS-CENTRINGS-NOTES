import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listRentals,
  buildConfirmMessage,
  buildActiveMessage,
  buildOverdueMessage,
  buildNotReturnedMessage,
  buildReturnMessage,
  whatsappUrl,
  getRentalRowTheme,
  type Rental,
} from "@/lib/rentals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, MessageCircle, CheckCircle2, Copy, Printer, Bell, IndianRupee, CircleDollarSign, SlidersHorizontal, X, ShieldAlert } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentBadge } from "@/components/PaymentBadge";
import { RentalForm } from "@/components/RentalForm";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { canDeleteRentals } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/rentals")({
  component: RentalsPage,
});

const PAGE = 10;

function RentalsPage() {
  const qc = useQueryClient();
  const { data: rentals = [], isLoading } = useQuery({ queryKey: ["rentals"], queryFn: listRentals });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Rental["status"]>("all");
  const [payment, setPayment] = useState<"all" | Rental["payment_status"]>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [takenDate, setTakenDate] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [placeFilter, setPlaceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rental | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const activeFilterCount = [takenDate, phoneFilter, nameFilter, placeFilter].filter(Boolean).length;

  const clearFilters = () => {
    setTakenDate("");
    setPhoneFilter("");
    setNameFilter("");
    setPlaceFilter("");
    setPage(1);
  };

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    const nameQl = nameFilter.toLowerCase();
    const placeQl = placeFilter.toLowerCase();
    const phoneQl = phoneFilter.replace(/\D/g, "");
    return rentals.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (payment !== "all" && r.payment_status !== payment) return false;
      if (takenDate && r.issue_date !== takenDate) return false;
      if (phoneQl && !r.customer_phone.includes(phoneQl)) return false;
      if (nameFilter && !r.customer_name.toLowerCase().includes(nameQl)) return false;
      if (placeFilter && !(r.customer_address ?? "").toLowerCase().includes(placeQl)) return false;
      if (!ql) return true;
      return (
        r.customer_name.toLowerCase().includes(ql) ||
        r.customer_phone.includes(ql) ||
        r.material_name.toLowerCase().includes(ql)
      );
    });
  }, [rentals, q, status, payment, takenDate, phoneFilter, nameFilter, placeFilter]);

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

  const togglePayment = useMutation({
    mutationFn: async (r: Rental) => {
      const next = r.payment_status === "paid" ? "unpaid" : "paid";
      const { error } = await supabase.from("rentals").update({ payment_status: next }).eq("id", r.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["rentals"] });
      toast.success(next === "paid" ? "Marked as paid" : "Marked as not paid");
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

  const paymentCounts = {
    all: rentals.length,
    paid: rentals.filter((r) => r.payment_status === "paid").length,
    unpaid: rentals.filter((r) => r.payment_status === "unpaid").length,
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

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Payment:</span>
            {(["all", "paid", "unpaid"] as const).map((p) => (
              <Button
                key={p}
                variant={payment === p ? "default" : "outline"}
                size="sm"
                onClick={() => { setPayment(p); setPage(1); }}
                className="capitalize"
              >
                {p === "unpaid" ? "Not Paid" : p} <span className="ml-1.5 text-[10px] opacity-70">({paymentCounts[p]})</span>
              </Button>
            ))}
            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="ml-auto"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">({activeFilterCount})</span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Date Taken (Issue Date)</label>
                  <Input type="date" value={takenDate} onChange={(e) => { setTakenDate(e.target.value); setPage(1); }} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                  <Input
                    inputMode="numeric"
                    placeholder="e.g. 9876543210"
                    value={phoneFilter}
                    onChange={(e) => { setPhoneFilter(e.target.value); setPage(1); }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Customer Name</label>
                  <Input
                    placeholder="e.g. Salman"
                    value={nameFilter}
                    onChange={(e) => { setNameFilter(e.target.value); setPage(1); }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Place</label>
                  <Input
                    placeholder="e.g. Nereducherla"
                    value={placeFilter}
                    onChange={(e) => { setPlaceFilter(e.target.value); setPage(1); }}
                  />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2 h-7 text-xs text-muted-foreground">
                  <X className="h-3 w-3 mr-1" /> Clear filters
                </Button>
              )}
            </div>
          )}

          <div className="overflow-x-auto -mx-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">S.No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Return</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={11} className="text-center py-10">Loading…</TableCell></TableRow>}
                {!isLoading && pageRows.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">No rentals found</TableCell></TableRow>
                )}
                {pageRows.map((r, idx) => {
                  const theme = getRentalRowTheme(r);
                  return (
                  <TableRow key={r.id}>
                    <TableCell className="relative text-muted-foreground">
                      <span
                        aria-hidden="true"
                        title={`${theme.key} status marker`}
                        className={`absolute left-0 top-0 h-0 w-0 border-t-[14px] border-r-[14px] border-r-transparent ${theme.cornerClass}`}
                      />
                      {(page - 1) * PAGE + idx + 1}
                    </TableCell>
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
                    <TableCell><PaymentBadge status={r.payment_status} /></TableCell>
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
                          <DropdownMenuItem onClick={() => { setEditing(r); setOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {r.status !== "returned" && (
                            <DropdownMenuItem onClick={() => markReturned.mutate(r)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Mark returned
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => togglePayment.mutate(r)}>
                            {r.payment_status === "paid" ? (
                              <><CircleDollarSign className="h-4 w-4 mr-2" /> Mark as not paid</>
                            ) : (
                              <><IndianRupee className="h-4 w-4 mr-2" /> Mark as paid</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => window.open(whatsappUrl(r.customer_phone, buildConfirmMessage(r)), "_blank")}>
                            <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp confirmation
                          </DropdownMenuItem>
                          {r.status === "active" && (
                            <DropdownMenuItem onClick={() => window.open(whatsappUrl(r.customer_phone, buildActiveMessage(r)), "_blank")}>
                              <Bell className="h-4 w-4 mr-2" /> WhatsApp active status
                            </DropdownMenuItem>
                          )}
                          {r.status === "overdue" && (
                            <DropdownMenuItem onClick={() => window.open(whatsappUrl(r.customer_phone, buildOverdueMessage(r)), "_blank")}>
                              <Bell className="h-4 w-4 mr-2" /> WhatsApp overdue notice
                            </DropdownMenuItem>
                          )}
                          {r.status !== "returned" && (
                            <DropdownMenuItem onClick={() => window.open(whatsappUrl(r.customer_phone, buildNotReturnedMessage(r)), "_blank")}>
                              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp not returned
                            </DropdownMenuItem>
                          )}
                          {r.status === "returned" && (
                            <DropdownMenuItem onClick={() => window.open(whatsappUrl(r.customer_phone, buildReturnMessage(r)), "_blank")}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> WhatsApp return confirmation
                            </DropdownMenuItem>
                          )}
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
                  );
                })}
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
          {canDeleteRentals() ? (
            <>
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
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-muted-foreground" /> Ask the admin
                </AlertDialogTitle>
                <AlertDialogDescription>
                  You don't have permission to delete rentals. Please ask the admin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction>Got it</AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}