import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Rental } from "@/lib/rentals";
import { computeStatus, groupRentals } from "@/lib/rentals";
import { receiptToImageFile, receiptToPdfFile, shareOrDownloadFile } from "@/lib/receipt-share";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Printer, ArrowLeft, SlidersHorizontal, Share2, Image as ImageIcon, FileText } from "lucide-react";
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

  const receiptRef = useRef<HTMLElement>(null);
  const [sharing, setSharing] = useState<"image" | "pdf" | null>(null);

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

  const handleShare = async (kind: "image" | "pdf") => {
    if (!receiptRef.current) return;
    setSharing(kind);
    try {
      const filename = `receipt-${receiptNumber.slice(0, 8)}`;
      const file =
        kind === "image"
          ? await receiptToImageFile(receiptRef.current, filename)
          : await receiptToPdfFile(receiptRef.current, filename);
      const result = await shareOrDownloadFile(file, {
        title: "Rental Receipt — M.B.S Centring Works",
        text: `Receipt for ${receipt.customer_name}`,
      });
      if (result === "shared") toast.success("Receipt shared");
      else if (result === "downloaded")
        toast.success(`Receipt saved as ${kind === "image" ? "an image" : "a PDF"} — attach it in WhatsApp`);
    } catch {
      toast.error("Couldn't generate the receipt file");
    } finally {
      setSharing(null);
    }
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={sharing !== null}>
                <Share2 className="h-4 w-4 mr-1.5" /> {sharing ? "Preparing…" : "Share"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShare("image")}>
                <ImageIcon className="h-4 w-4 mr-2" /> Share as Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare("pdf")}>
                <FileText className="h-4 w-4 mr-2" /> Share as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print Receipt
          </Button>
        </div>
      </div>

      <article
        ref={receiptRef}
        className="receipt-sheet mx-auto max-w-3xl rounded-2xl border border-gray-300 bg-white p-4 text-gray-900 shadow-sm transition-shadow duration-200 sm:p-6 print:rounded-none print:shadow-none"
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="M.B.S Centring Works logo"
              className="block h-16 w-16 shrink-0 overflow-hidden rounded-full object-cover grayscale sm:h-20 sm:w-20"
            />
            <div>
              <h1 className="text-1xl font-black text-black">M.B.S CENTRING WORKS</h1>
              <p className="text-sm font-semibold">Nereducherla</p>
              <p className="mt-1 text-xs text-gray-500">
                Pro: Sk.M.Sharif Ph.no: 8688285959
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Construction Material Rental Services
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold uppercase text-black">
              {isCombined ? "Combined Receipt" : "Receipt"}
            </div>
            <div className="text-xs mt-2 font-mono">#{receiptNumber.slice(0, 8).toUpperCase()}</div>
            <div className="text-xs text-gray-500">
              {" "}
              {new Date(receipt.created_at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
            
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase text-black">Customer</h3>
            <div className="font-semibold">{receipt.customer_name}</div>
            <div className="text-sm">{receipt.customer_phone}</div>
            <div className="text-sm text-gray-500">{receipt.customer_address}</div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase text-black">Rental Period</h3>
            <div className="text-sm">
              Issue: <span className="font-semibold">{receipt.issue_date}</span>
            </div>
            <div className="text-sm">
              Return: <span className="font-semibold">{receipt.return_date}</span>
            </div>
            <div className="text-sm">
              Status:{" "}
              <span className="font-semibold capitalize">
                {receipt.status === "partial" ? "Partially Returned" : receipt.status}
              </span>
            </div>
            <div className="text-sm">
              Payment:{" "}
              <span className="font-semibold capitalize">
                {receipt.payment_status === "paid" ? "Paid" : "Not Paid"}
              </span>
            </div>
          </div>
        </div>

        <table className="mb-6 w-full border-collapse border-2 border-black">
          <thead>
            <tr className="bg-white text-black border-b-2 border-black">
              <th className="text-left p-2 text-xs uppercase">Material</th>
              <th className="text-right p-2 text-xs uppercase">Qty</th>
              <th className="text-right p-2 text-xs uppercase">Rate</th>
              <th className="text-right p-2 text-xs uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-300">
                <td className="p-2 font-medium">{row.material_name}</td>
                <td className="p-2 text-right">
                  {row.quantity} {row.unit}
                </td>
                <td className="p-2 text-right">₹{Number(row.rate_per_unit).toLocaleString("en-IN")}</td>
                <td className="p-2 text-right font-semibold">
                  ₹{Number(row.total_amount).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>₹{Number(receipt.total_amount).toLocaleString("en-IN")}</span>
            </div>
            {receipt.security_deposit ? (
              <div className="flex justify-between text-sm">
                <span>Advance Received</span>
                <span>- ₹{Number(receipt.security_deposit).toLocaleString("en-IN")}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t-2 border-black pt-2 text-lg font-bold text-black">
              <span>TOTAL</span>
              <span>
                ₹
                {(Number(receipt.total_amount) - Number(receipt.security_deposit ?? 0)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {receipt.notes && (
          <div className="mb-6 border-t border-gray-300 pt-3 text-xs text-gray-500">
            <b>Notes:</b> {receipt.notes}
          </div>
        )}

        <div className="flex justify-end border-t border-gray-300 pt-6">
          <div className="relative w-64 pt-16">
            {showSignature && canUseSignature && (
              <img
                src={signature}
                alt="Authorized signature"
                className="pointer-events-none absolute left-1/2 top-2 h-16 w-40 -translate-x-1/2 object-contain opacity-80 print:opacity-80"
              />
            )}
            {showStamp && (
              <img
                src={stamp}
                alt="M.B.S Centring Works official stamp"
                className="pointer-events-none absolute left-1/2 top-0 z-10 h-24 w-24 -translate-x-1/2 -rotate-6 opacity-90 grayscale print:opacity-90"
              />
            )}
            <div className="border-t border-black pt-1 text-center text-xs font-medium">
              Authorized Signature
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-300 pt-3 text-center text-xs font-medium text-black">
          Thank you for choosing M.B.S Centring Works, Nereducherla.
        </div>
      </article>
    </div>
  );
}