import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listRentals } from "@/lib/rentals";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/receipts/")({
  component: ReceiptsList,
});

function ReceiptsList() {
  const { data: rentals = [] } = useQuery({ queryKey: ["rentals"], queryFn: listRentals });
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Receipts</h2>
        <p className="text-sm text-muted-foreground">Print professional rental receipts</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rentals.map((r) => (
          <Card key={r.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{r.customer_phone}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="text-sm">{r.material_name} · {r.quantity} {r.unit}</div>
              <div className="flex items-center justify-between">
                <div className="font-bold text-lg">₹{Number(r.total_amount).toLocaleString("en-IN")}</div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/receipts/$id" params={{ id: r.id }}>
                    <Printer className="h-3.5 w-3.5 mr-1" /> View
                  </Link>
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground">#{r.id.slice(0, 8).toUpperCase()} · {r.issue_date} → {r.return_date}</div>
            </CardContent>
          </Card>
        ))}
        {rentals.length === 0 && <div className="col-span-full text-center py-10 text-muted-foreground">No rentals yet</div>}
      </div>
    </div>
  );
}
