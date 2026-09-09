import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Rental } from "@/lib/rentals";
import { computeStatus, groupRentals } from "@/lib/rentals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Printer, ArrowLeft, SlidersHorizontal } from "lucide-react";
import { isMasterAdmin, isManager } from "@/lib/access";
import { ADMIN_ID_KEY } from "@/lib/worker-auth";
import logo from "@/assets/logo.png";
import stamp from "@/assets/stamp.png";
import signatureMbs from "@/assets/signature-mbs.png";
import signatureHafiza from "@/assets/signature-hafiza.png";
import signatureSalman from "@/assets/signature-salman.png";
import signatureSameer from "@/assets/signature-sameer.png";

/** Picks the signature image whose name appears in the signed-in user's name. */
function signatureForName(name: string | null | undefined): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("salman")) return signatureSalman;
  if (n.includes("hafiza")) return signatureHafiza;
  if (n.includes("sameer")) return signatureSameer;
  return signatureMbs;
}

export const Route = createFileRoute("/_authenticated/receipts/$id")({
  head: () => ({
    meta: [
      { title: "Rental Receipt | M.B.S Centring Works" },
      {
        name: "description",
        content: "View and print a construction material rental receipt from M.B.S Centring Works.",
      },
      { property: "og:title", content: "Rental Receipt | M.B.S Centring Works" },
      { property: "og:description", content: "A printable construction material rental receipt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { id } = Route.useParams();
  const canUseSignature = isMasterAdmin() || isManager();
  const [showStamp, setShowStamp] = useState(true);
  const [showSignature, setShowSignature] = useState(isMasterAdmin());

  const adminId = typeof window !== "undefined" ? localStorage.getItem(ADMIN_ID_KEY) : null;
  const { data: me } = useQuery({
    queryKey: ["workers", "me", adminId],
    queryFn: async () => {
      if (!adminId) return null;
      const { data, error } = await supabase.from("workers").select("name").eq("id", adminId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!adminId && canUseSignature,
  });
  const signature = signatureForName(me?.name);

  const { data: r, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("rentals").select("*").eq("id", id).single();
      if (error) throw error;
      return { ...(data as any), status: computeStatus(data as any) } as Rental;
    },
  });

  // Every other material added together with this one (same group_id) — lets us
  // print all materials for the customer on a single combined receipt.
  const { data: groupRows } = useQuery({
    queryKey: ["rental-group", r?.group_id ?? id],
    queryFn: async () => {
      const gid = r!.group_id;
      if (!gid) return [r as Rental];
      const { data, error } = await supabase.from("rentals").select("*").eq("group_id", gid);
      if (error) throw error;
      return (data as any[]).map((row) => ({ ...row, status: computeStatus(row) })) as Rental[];
    },
    enabled: !!r,
  });

  const hasMultipleMaterials = (groupRows?.length ?? 0) > 1;

  // Which materials (by id) are ticked in the checklist below. null = not yet
  // initialized — defaults to "everything" once the group finishes loading.
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (groupRows && selectedIds === null) {
      setSelectedIds(groupRows.map((row) => row.id));
    }
  }, [groupRows, selectedIds]);


  if (isLoading) return <div className="text-muted-foreground">Loading receipt…</div>;
  if (!r) return <div>Not found</div>;

  const effectiveSelectedIds = selectedIds ?? (groupRows ?? []).map((row) => row.id);
  const checkedRows = hasMultipleMaterials
    ? (groupRows as Rental[]).filter((row) => effectiveSelectedIds.includes(row.id))
    : [r];
  // Never render an empty receipt — fall back to the material that was opened.
  const rowsForReceipt = checkedRows.length > 0 ? checkedRows : [r];
  const isCombined = rowsForReceipt.length > 1;
  const allSelected = hasMultipleMaterials && effectiveSelectedIds.length === (groupRows?.length ?? 0);

  const toggleMaterial = (materialId: string, checked: boolean) => {
    const base = selectedIds ?? (groupRows ?? []).map((row) => row.id);
    const next = checked
      ? Array.from(new Set([...base, materialId]))
      : base.filter((rowId) => rowId !== materialId);
    // Keep at least one material selected so the receipt is never empty.
    setSelectedIds(next.length > 0 ? next : base);
  };

  const selectAllMaterials = () => setSelectedIds((groupRows ?? []).map((row) => row.id));
  const selectOnlyThisMaterial = () => setSelectedIds([r.id]);

  // Reuses the same aggregation used on the Rentals list, so totals, status
  // and payment status are computed identically whether combined or single.
  const receipt = groupRentals(rowsForReceipt)[0];
  const receiptNumber = isCombined ? (r.group_id || r.id) : r.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/receipts">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              {hasMultipleMaterials && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>
                      Materials to combine ({rowsForReceipt.length}/{groupRows?.length ?? 0})
                    </span>
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={allSelected ? selectOnlyThisMaterial : selectAllMaterials}
                    >
                      {allSelected ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {(groupRows as Rental[]).map((row, i) => (
                      <label
                        key={row.id}
                        className="flex cursor-pointer items-start gap-2 text-sm"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={effectiveSelectedIds.includes(row.id)}
                          onCheckedChange={(checked) => toggleMaterial(row.id, !!checked)}
                        />
                        <span>
                          <span className="font-medium">Material {i + 1}</span>{" "}
                          <span className="text-muted-foreground">
                            — {row.material_name} ({row.quantity} {row.unit})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Print with</div>
                {canUseSignature ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={!showStamp && !showSignature ? "default" : "outline"}
                      onClick={() => {
                        setShowStamp(false);
                        setShowSignature(false);
                      }}
                    >
                      Without stamp & signature
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={!showStamp && showSignature ? "default" : "outline"}
                      onClick={() => {
                        setShowStamp(false);
                        setShowSignature(true);
                      }}
                    >
                      Signature only
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={showStamp && !showSignature ? "default" : "outline"}
                      onClick={() => {
                        setShowStamp(true);
                        setShowSignature(false);
                      }}
                    >
                      Stamp only
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={showStamp && showSignature ? "default" : "outline"}
                      onClick={() => {
                        setShowStamp(true);
                        setShowSignature(true);
                      }}
                    >
                      Stamp & signature
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={!showStamp ? "default" : "outline"}
                      onClick={() => setShowStamp(false)}
                    >
                      Without stamp
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={showStamp ? "default" : "outline"}
                      onClick={() => setShowStamp(true)}
                    >
                      With stamp
                    </Button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print Receipt
          </Button>
        </div>
      </div>

      <article
        className="receipt-sheet mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 text-gray-700 shadow-sm transition-shadow duration-200 sm:p-10 print:rounded-none print:border-0 print:shadow-none"
      >
        {/* Title + From */}
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-400">
              {isCombined ? "RECEIPT" : "RECEIPT"}
            </h1>
            <div className="mt-6">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">From</div>
              <div className="font-semibold text-gray-800">M.B.S CENTRING WORKS</div>
              <div className="text-sm text-gray-600">Nereducherla</div>
              <div className="text-sm text-gray-600">Pro: Sk.M.Sharif Ph.no: 8688285959</div>
            </div>
          </div>
          <img
            src={logo}
            alt="M.B.S Centring Works logo"
            className="block h-20 w-20 shrink-0 overflow-hidden rounded-full object-cover grayscale"
          />
        </div>

        {/* Bill To / Rental Period / Receipt meta */}
        <div className="mb-8 grid grid-cols-1 gap-6 border-t border-gray-200 pt-6 sm:grid-cols-3">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Bill To</div>
            <div className="font-semibold text-gray-800">{receipt.customer_name}</div>
            <div className="text-sm text-gray-600">{receipt.customer_address}</div>
            <div className="text-sm text-gray-600">{receipt.customer_phone}</div>
          </div>
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Rental Period</div>
            <div className="text-sm text-gray-600">
              Issue: <span className="font-medium text-gray-800">{receipt.issue_date}</span>
            </div>
            <div className="text-sm text-gray-600">
              Return: <span className="font-medium text-gray-800">{receipt.return_date}</span>
            </div>
            <div className="text-sm text-gray-600">
              Status:{" "}
              <span className="font-medium capitalize text-gray-800">
                {receipt.status === "partial" ? "Partially Returned" : receipt.status}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Payment:{" "}
              <span className="font-medium text-gray-800">
                {receipt.payment_status === "paid" ? "Paid" : "Not Paid"}
              </span>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="flex justify-between gap-4 text-sm sm:justify-end">
              <span className="text-gray-500">Receipt #</span>
              <span className="font-semibold text-gray-800">{receiptNumber.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm sm:justify-end">
              <span className="text-gray-500">Receipt Date</span>
              <span className="font-semibold text-gray-800">
                {new Date(receipt.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </span>
            </div>
          </div>
        </div>

        {/* Materials table */}
        <table className="mb-8 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-400 text-xs uppercase tracking-wide text-gray-500">
              {receipt.rows.length > 1 && <th className="py-2 text-left font-semibold">#</th>}
              <th className="py-2 text-left font-semibold">Material</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">Unit Price</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.rows.map((row, i) => (
              <tr key={row.id} className="border-b border-gray-200">
                {receipt.rows.length > 1 && (
                  <td className="py-2.5 text-sm text-gray-700">{i + 1}</td>
                )}
                <td className="py-2.5 text-sm font-medium text-gray-800">{row.material_name}</td>
                <td className="py-2.5 text-right text-sm text-gray-700">
                  {row.quantity} {row.unit}
                </td>
                <td className="py-2.5 text-right text-sm text-gray-700">
                  ₹{Number(row.rate_per_unit).toLocaleString("en-IN")}
                </td>
                <td className="py-2.5 text-right text-sm font-medium text-gray-800">
                  ₹{Number(row.total_amount).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mb-10 flex justify-end">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>₹{Number(receipt.total_amount).toLocaleString("en-IN")}</span>
            </div>
            {receipt.security_deposit ? (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Advance Received</span>
                <span>- ₹{Number(receipt.security_deposit).toLocaleString("en-IN")}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-gray-300 pt-2 text-lg font-bold text-gray-800">
              <span>Total</span>
              <span>
                ₹{(Number(receipt.total_amount) - Number(receipt.security_deposit ?? 0)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="mb-10 flex justify-end">
          <div className="relative w-52 pt-14 text-center">
            {showSignature && canUseSignature && (
              <img
                src={signature}
                alt="Authorized signature"
                className="pointer-events-none absolute left-1/2 top-2 h-16 w-40 -translate-x-1/2 object-contain opacity-90 grayscale print:opacity-90"
              />
            )}
            {showStamp && (
              <img
                src={stamp}
                alt="M.B.S Centring Works official stamp"
                className="pointer-events-none absolute left-1/2 top-0 z-10 h-24 w-24 -translate-x-1/2 -rotate-6 opacity-90 grayscale print:opacity-90"
              />
            )}
            <div className="border-t border-gray-300 pt-1 text-xs font-medium text-gray-500">
              Authorized Signature
            </div>
          </div>
        </div>

        {/* Terms & notes */}
        {receipt.notes && (
          <div className="border-t border-gray-200 pt-6">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
              Terms &amp; Conditions
            </div>
            <div className="text-sm text-gray-600">{receipt.notes}</div>
          </div>
        )}

        <div className="mt-8 text-center text-xs font-medium text-gray-500">
          Thank you for choosing M.B.S Centring Works, Nereducherla.
        </div>
      </article>
    </div>
  );
}