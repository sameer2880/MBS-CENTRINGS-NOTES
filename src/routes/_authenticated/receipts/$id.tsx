import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Rental } from "@/lib/rentals";
import { computeStatus } from "@/lib/rentals";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import stamp from "@/assets/stamp.png";

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
  const { data: r, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("rentals").select("*").eq("id", id).single();
      if (error) throw error;
      return { ...(data as any), status: computeStatus(data as any) } as Rental;
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading receipt…</div>;
  if (!r) return <div>Not found</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/receipts">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1.5" /> Print Receipt
        </Button>
      </div>

      <article className="receipt-sheet mx-auto max-w-3xl rounded-2xl border border-gray-300 bg-white p-4 text-gray-900 shadow-sm transition-shadow duration-200 sm:p-6 print:rounded-none print:shadow-none">
        <div className="mb-6 flex items-start justify-between gap-4 border-b-2 border-black pb-4">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="M.B.S Centring Works logo"
              className="block h-16 w-16 shrink-0 overflow-hidden rounded-full object-cover grayscale sm:h-20 sm:w-20"
            />
            <div>
              <h1 className="text-2xl font-black text-black">M.B.S CENTRING WORKS</h1>
              <p className="text-sm font-semibold">Nereducherla</p>
              <p className="mt-1 text-xs text-gray-500">
                Construction Material Rental Services
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block rounded border border-black bg-black px-3 py-1 text-xs font-bold uppercase text-white">
              Receipt
            </div>
            <div className="text-xs mt-2 font-mono">#{r.id.slice(0, 8).toUpperCase()}</div>
            <div className="text-xs text-gray-500">
              Recorded:{" "}
              {new Date(r.created_at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </div>
            {r.updated_at && r.updated_at !== r.created_at && (
              <div className="text-[10px] text-gray-500">
                Updated:{" "}
                {new Date(r.updated_at).toLocaleString("en-IN", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase text-black">Customer</h3>
            <div className="font-semibold">{r.customer_name}</div>
            <div className="text-sm">{r.customer_phone}</div>
            <div className="text-sm text-gray-500">{r.customer_address}</div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase text-black">Rental Period</h3>
            <div className="text-sm">
              Issue: <span className="font-semibold">{r.issue_date}</span>
            </div>
            <div className="text-sm">
              Return: <span className="font-semibold">{r.return_date}</span>
            </div>
            <div className="text-sm">
              Status: <span className="font-semibold capitalize">{r.status}</span>
            </div>
          </div>
        </div>

        <table className="mb-6 w-full border-collapse border-2 border-black">
          <thead>
            <tr className="bg-black text-white">
              <th className="text-left p-2 text-xs uppercase">Material</th>
              <th className="text-right p-2 text-xs uppercase">Qty</th>
              <th className="text-right p-2 text-xs uppercase">Rate</th>
              <th className="text-right p-2 text-xs uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="p-2 font-medium">{r.material_name}</td>
              <td className="p-2 text-right">
                {r.quantity} {r.unit}
              </td>
              <td className="p-2 text-right">₹{Number(r.rate_per_unit).toLocaleString("en-IN")}</td>
              <td className="p-2 text-right font-semibold">
                ₹{Number(r.total_amount).toLocaleString("en-IN")}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>₹{Number(r.total_amount).toLocaleString("en-IN")}</span>
            </div>
            {r.security_deposit ? (
              <div className="flex justify-between text-sm">
                <span>Advance Received</span>
                <span>- ₹{Number(r.security_deposit).toLocaleString("en-IN")}</span>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t-2 border-black pt-2 text-lg font-bold text-black">
              <span>Balance Due</span>
              <span>
                ₹
                {(Number(r.total_amount) - Number(r.security_deposit ?? 0)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {r.notes && (
          <div className="mb-6 border-t border-gray-300 pt-3 text-xs text-gray-500">
            <b>Notes:</b> {r.notes}
          </div>
        )}

        <div className="flex justify-end border-t border-gray-300 pt-6">
          <div className="relative w-64 pt-16">
            <img
              src={stamp}
              alt="M.B.S Centring Works official stamp"
              className="pointer-events-none absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 -rotate-6 opacity-90 grayscale print:opacity-90"
            />
            <div className="border-t border-black pt-1 text-center text-xs font-medium">
              Authorized Signature
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-300 pt-3 text-center text-xs font-medium text-black">
          Thank you for choosing M.B.S Centring Works, Nereducherla
        </div>
      </article>
    </div>
  );
}