import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listRentals,
  groupRentals,
  buildGroupConfirmMessage,
  buildGroupActiveMessage,
  buildGroupOverdueMessage,
  buildGroupNotReturnedMessage,
  buildGroupReturnMessage,
  whatsappUrl,
  getRentalRowTheme,
  type RentalGroup,
} from "@/lib/rentals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Pencil, Trash2, MessageCircle, CheckCircle2, Copy, Printer, Bell, IndianRupee, CircleDollarSign, SlidersHorizontal, X, ShieldAlert, Phone, Package } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentBadge } from "@/components/PaymentBadge";
import { RentalForm } from "@/components/RentalForm";
import { ReturnItemsDialog } from "@/components/ReturnItemsDialog";
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
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });
  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name])),
    [profiles],
  );
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | RentalGroup["status"]>("all");
  const [payment, setPayment] = useState<"all" | RentalGroup["payment_status"]>("all");
  const [takenDate, setTakenDate] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [placeFilter, setPlaceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RentalGroup | null>(null);
  const [delGroup, setDelGroup] = useState<RentalGroup | null>(null);
  const [returnGroup, setReturnGroup] = useState<RentalGroup | null>(null);

  const activeFilterCount = [takenDate, phoneFilter, nameFilter, placeFilter].filter(Boolean).length;

  const clearFilters = () => {
    setTakenDate("");
    setPhoneFilter("");
    setNameFilter("");
    setPlaceFilter("");
    setPage(1);
  };

  // Materials added together (same group_id) become a single card here.
  const groups = useMemo(() => groupRentals(rentals), [rentals]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    const nameQl = nameFilter.toLowerCase();
    const placeQl = placeFilter.toLowerCase();
    const phoneQl = phoneFilter.replace(/\D/g, "");
    return groups.filter((g) => {
      if (status !== "all" && g.status !== status) return false;
      if (payment !== "all" && g.payment_status !== payment) return false;
      if (takenDate && g.issue_date !== takenDate) return false;
      if (phoneQl && !g.customer_phone.includes(phoneQl)) return false;
      if (nameFilter && !g.customer_name.toLowerCase().includes(nameQl)) return false;
      if (placeFilter && !(g.customer_address ?? "").toLowerCase().includes(placeQl)) return false;
      if (!ql) return true;
      return (
        g.customer_name.toLowerCase().includes(ql) ||
        g.customer_phone.includes(ql) ||
        g.rows.some((r) => r.material_name.toLowerCase().includes(ql))
      );
    });
  }, [groups, q, status, payment, takenDate, phoneFilter, nameFilter, placeFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);

  const togglePayment = useMutation({
    mutationFn: async (g: RentalGroup) => {
      const next = g.payment_status === "paid" ? "unpaid" : "paid";
      const { error } = await supabase.from("rentals").update({ payment_status: next }).in("id", g.rows.map((r) => r.id));
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["rentals"] });
      toast.success(next === "paid" ? "Marked as paid" : "Marked as not paid");
    },
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("rentals").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ["rentals"] });
      toast.success("Rental deleted");
      setDelGroup(null);
    },
  });

  const counts = {
    all: groups.length,
    active: groups.filter((g) => g.status === "active").length,
    overdue: groups.filter((g) => g.status === "overdue").length,
    partial: groups.filter((g) => g.status === "partial").length,
    returned: groups.filter((g) => g.status === "returned").length,
  };

  const paymentCounts = {
    all: groups.length,
    paid: groups.filter((g) => g.payment_status === "paid").length,
    unpaid: groups.filter((g) => g.payment_status === "unpaid").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Rentals</h2>
          <p className="text-sm text-muted-foreground">Manage all material rental records</p>
        </div>
        <Button onClick={() => { setEditingGroup(null); setOpen(true); }} className="shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> New Rental
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, mobile or material"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                className="pl-9 pr-9"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Filters"
                    className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring ${activeFilterCount > 0 ? "text-primary" : "text-muted-foreground"}`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-muted-foreground">Filters</div>
                    {activeFilterCount > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-6 px-1.5 text-xs text-muted-foreground"
                      >
                        <X className="h-3 w-3 mr-1" /> Clear
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Date Taken (Issue Date)</label>
                    <Input
                      type="date"
                      value={takenDate}
                      onChange={(e) => { setTakenDate(e.target.value); setPage(1); }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                    <Input
                      placeholder="Search by phone"
                      value={phoneFilter}
                      onChange={(e) => { setPhoneFilter(e.target.value); setPage(1); }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Customer Name</label>
                    <Input
                      placeholder="Search by name"
                      value={nameFilter}
                      onChange={(e) => { setNameFilter(e.target.value); setPage(1); }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Place / Village</label>
                    <Input
                      placeholder="Search by place"
                      value={placeFilter}
                      onChange={(e) => { setPlaceFilter(e.target.value); setPage(1); }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "active", "overdue", "partial", "returned"] as const).map((s) => (
              <Button
                key={s}
                variant={status === s ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatus(s); setPage(1); }}
                className="capitalize"
              >
                {s === "partial" ? "Partial" : s} ({counts[s]})
              </Button>
            ))}
            <span className="mx-1 text-muted-foreground">·</span>
            {(["all", "paid", "unpaid"] as const).map((p) => (
              <Button
                key={p}
                variant={payment === p ? "default" : "outline"}
                size="sm"
                onClick={() => { setPayment(p); setPage(1); }}
                className="capitalize"
              >
                {p} ({paymentCounts[p]})
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full text-center text-muted-foreground py-8">Loading…</div>
            ) : pageRows.length === 0 ? (
              <div className="col-span-full text-center text-muted-foreground py-8">No rentals found</div>
            ) : (
              pageRows.map((g, idx) => {
                const theme = getRentalRowTheme(g);
                const single = g.rows.length === 1;
                const notReturnedRows = g.rows.filter((r) => r.status !== "returned");
                return (
                  <div
                    key={g.group_id}
                    className="relative rounded-lg border border-border p-3.5 flex flex-col gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className={`absolute left-0 top-0 h-1.5 w-10 rounded-tl-lg ${theme.dotClass}`} />
                    <div className="flex items-start justify-between gap-2 pt-1">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <span>#{(page - 1) * PAGE + idx + 1}</span>
                        </div>
                        <div className="font-semibold truncate">{g.customer_name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" /> {g.customer_phone}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex shrink-0 items-center rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          >
                            Actions
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingGroup(g); setOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {g.status !== "returned" && (
                            <DropdownMenuItem onClick={() => setReturnGroup(g)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Mark returned
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => togglePayment.mutate(g)}>
                            {g.payment_status === "paid" ? (
                              <><CircleDollarSign className="h-4 w-4 mr-2" /> Mark as not paid</>
                            ) : (
                              <><IndianRupee className="h-4 w-4 mr-2" /> Mark as paid</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => window.open(whatsappUrl(g.customer_phone, buildGroupConfirmMessage(g.rows)), "_blank")}>
                            <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp confirmation
                          </DropdownMenuItem>
                          {g.status === "active" && (
                            <DropdownMenuItem onClick={() => window.open(whatsappUrl(g.customer_phone, buildGroupActiveMessage(g.rows)), "_blank")}>
                              <Bell className="h-4 w-4 mr-2" /> WhatsApp active status
                            </DropdownMenuItem>
                          )}
                          {g.status === "overdue" && (
                            <DropdownMenuItem onClick={() => window.open(whatsappUrl(g.customer_phone, buildGroupOverdueMessage(g.rows)), "_blank")}>
                              <Bell className="h-4 w-4 mr-2" /> WhatsApp overdue notice
                            </DropdownMenuItem>
                          )}
                          {g.status !== "returned" && (
                            <DropdownMenuItem onClick={() => window.open(whatsappUrl(g.customer_phone, buildGroupNotReturnedMessage(notReturnedRows)), "_blank")}>
                              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp not returned
                            </DropdownMenuItem>
                          )}
                          {g.status === "returned" && (
                            <DropdownMenuItem onClick={() => window.open(whatsappUrl(g.customer_phone, buildGroupReturnMessage(g.rows)), "_blank")}>
                              <CheckCircle2 className="h-4 w-4 mr-2" /> WhatsApp return confirmation
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={async () => {
                              await navigator.clipboard.writeText(buildGroupConfirmMessage(g.rows));
                              toast.success("Message copied");
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" /> Copy message
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link to="/receipts/$id" params={{ id: g.rows[0].id }}>
                              <Printer className="h-4 w-4 mr-2" /> Print receipt
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDelGroup(g)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {single ? (
                      <div className="flex items-center gap-1.5 text-sm">
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{g.rows[0].material_name}</span>
                        <span className="text-muted-foreground">· {g.rows[0].quantity} {g.rows[0].unit}</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {g.rows.map((r) => (
                          <div key={r.id} className="flex items-center gap-1.5 text-sm">
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{r.material_name}</span>
                            <span className="text-muted-foreground">· {r.quantity} {r.unit}</span>
                            {r.status === "returned" && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div>
                        <div className="text-muted-foreground">Amount</div>
                        <div className="font-semibold text-sm">₹{Number(g.total_amount).toLocaleString("en-IN")}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Issue Date</div>
                        <div className="font-medium">{g.issue_date}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Return Date</div>
                        <div className="font-medium">{g.return_date}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={g.status} />
                      <PaymentBadge status={g.payment_status} />
                    </div>

                    <div className="text-[10px] text-muted-foreground border-t border-border pt-2 space-y-1">
                      <div>
                        Added {new Date(g.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        {g.updated_at && g.updated_at !== g.created_at && (
                          <> · Updated {new Date(g.updated_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</>
                        )}
                      </div>
                      {g.rows[0]?.created_by && (
                        <div>Added by {profileMap[g.rows[0].created_by] ?? "User"}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
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

      <RentalForm open={open} onOpenChange={setOpen} editingGroup={editingGroup} />

      <ReturnItemsDialog
        open={!!returnGroup}
        onOpenChange={(v) => !v && setReturnGroup(null)}
        group={returnGroup}
      />

      <AlertDialog open={!!delGroup} onOpenChange={(v) => !v && setDelGroup(null)}>
        <AlertDialogContent>
          {canDeleteRentals() ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete rental?</AlertDialogTitle>
                <AlertDialogDescription>
                  {delGroup && delGroup.rows.length > 1
                    ? `This will delete all ${delGroup.rows.length} materials in this rental. This action cannot be undone.`
                    : "This action cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => delGroup && del.mutate(delGroup.rows.map((r) => r.id))}
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