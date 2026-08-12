import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "active" | "returned" | "overdue" }) {
  const map = {
    active: "bg-primary/10 text-primary border-primary/40",
    returned: "bg-success/10 text-success border-success/40",
    overdue: "bg-destructive/10 text-destructive border-destructive/40",
  } as const;
  return (
    <Badge variant="outline" className={`${map[status]} capitalize font-semibold`}>
      {status}
    </Badge>
  );
}
