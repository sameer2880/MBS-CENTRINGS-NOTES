import { Badge } from "@/components/ui/badge";

export function PaymentBadge({ status }: { status: "paid" | "unpaid" }) {
  const map = {
    paid: "bg-success/10 text-success border-success/40",
    unpaid: "bg-destructive/10 text-destructive border-destructive/40",
  } as const;
  return (
    <Badge variant="outline" className={`${map[status]} capitalize font-semibold`}>
      {status === "paid" ? "Paid" : "Not Paid"}
    </Badge>
  );
}