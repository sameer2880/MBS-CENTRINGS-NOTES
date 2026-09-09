import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "active" | "returned" | "overdue" | "partial" }) {
  const map = {
    active: "bg-primary/10 text-primary border-primary/40",
    returned: "bg-success/10 text-success border-success/40",
    overdue: "bg-destructive/10 text-destructive border-destructive/40",
    partial: "bg-amber-500/10 text-amber-600 border-amber-500/40",
  } as const;
  const label = status === "partial" ? "Partially Returned" : status;
  return (
    <Badge variant="outline" className={`${map[status]} font-semibold ${status === "partial" ? "" : "capitalize"}`}>
      {label}
    </Badge>
  );
}