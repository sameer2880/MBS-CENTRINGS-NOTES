import type { ReactNode } from "react";
import { Trash2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { isMasterAdmin } from "@/lib/access";

type Props = {
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  children?: ReactNode;
  className?: string;
  /**
   * Set this on actions that permanently delete or wipe data. Managers
   * (full-access users who aren't the master admin) still see the trigger,
   * but confirming shows an "ask the admin" message instead of deleting —
   * only the master admin can actually go through with it. Leave unset for
   * non-destructive confirmations (e.g. sign out) that everyone may do.
   */
  restricted?: boolean;
};

export function ConfirmDelete({
  onConfirm,
  title = "Delete this item?",
  description = "This can't be undone. The record will be permanently removed.",
  confirmLabel = "Delete",
  children,
  className,
  restricted = false,
}: Props) {
  const blocked = restricted && !isMasterAdmin();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {children ?? (
          <Button variant="ghost" size="icon" className={className ?? "text-destructive"} aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        {blocked ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-muted-foreground" /> Ask the admin
              </AlertDialogTitle>
              <AlertDialogDescription>
                Managers can't delete records. To delete this, please ask the admin.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Got it</AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}