import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Rental, RentalGroup } from "@/lib/rentals";
import { buildGroupReturnMessage, whatsappUrl } from "@/lib/rentals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Package } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: RentalGroup | null;
}

/**
 * Checklist for marking returns. One row per material in the group —
 * already-returned materials come in ticked, everything else unticked.
 * Toggling and saving updates each material's own status, so a customer
 * who returns some materials but not others is tracked accurately.
 */
export function ReturnItemsDialog({ open, onOpenChange, group }: Props) {
  const qc = useQueryClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (group) {
      const initial: Record<string, boolean> = {};
      group.rows.forEach((r) => { initial[r.id] = r.status === "returned"; });
      setChecked(initial);
    }
  }, [group, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!group) return { newlyReturned: [] as Rental[], allReturned: true };
      const toReturn = group.rows.filter((r) => checked[r.id] && r.status !== "returned");
      const toUnreturn = group.rows.filter((r) => !checked[r.id] && r.status === "returned");

      if (toReturn.length > 0) {
        const { error } = await supabase
          .from("rentals")
          .update({ status: "returned" })
          .in("id", toReturn.map((r) => r.id));
        if (error) throw error;
      }
      if (toUnreturn.length > 0) {
        const { error } = await supabase
          .from("rentals")
          .update({ status: "active" })
          .in("id", toUnreturn.map((r) => r.id));
        if (error) throw error;
      }

      const allReturned = group.rows.every((r) => checked[r.id]);
      return { newlyReturned: toReturn, allReturned };
    },
    onSuccess: ({ newlyReturned, allReturned }) => {
      qc.invalidateQueries({ queryKey: ["rentals"] });
      if (!group) return;

      if (newlyReturned.length > 0) {
        toast.success(
          allReturned ? "All materials marked returned" : `${newlyReturned.length} material${newlyReturned.length > 1 ? "s" : ""} marked returned`,
          {
            action: {
              label: "Send WhatsApp",
              onClick: () => window.open(whatsappUrl(group.customer_phone, buildGroupReturnMessage(newlyReturned)), "_blank"),
            },
          },
        );
      } else {
        toast.success("Return status updated");
      }
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update return status"),
  });

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Materials Returned</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Tick each material {group.customer_name} has returned. Leave the rest unticked — they'll stay marked as not returned.
        </p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {group.rows.map((r) => (
            <label
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
            >
              <Checkbox
                checked={!!checked[r.id]}
                onCheckedChange={(v) => setChecked((c) => ({ ...c, [r.id]: !!v }))}
              />
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{r.material_name}</div>
                <div className="text-xs text-muted-foreground">{r.quantity} {r.unit}</div>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}