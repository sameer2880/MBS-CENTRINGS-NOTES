import { MapPin, MapPinOff, MapPinned } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useWorkerLocationSharing, WORK_HOURS_LABEL } from "@/hooks/use-worker-location-sharing";
import { cn } from "@/lib/utils";

export function WorkerLocationToggle({ workerId }: { workerId: string | null }) {
  const { enabled, status, errorMessage, toggle, loaded } = useWorkerLocationSharing(workerId);

  if (!workerId) return null;

  const statusText =
    status === "sharing"
      ? "Sharing your live location"
      : status === "paused"
        ? "On, but paused (outside working hours)"
        : status === "error"
          ? errorMessage || "Couldn't access your location"
          : "Location sharing is off";

  const Icon = status === "sharing" ? MapPinned : status === "error" ? MapPinOff : MapPin;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        status === "sharing"
          ? "border-primary/40 bg-primary/5"
          : status === "error"
            ? "border-destructive/40 bg-destructive/5"
            : "border-sidebar-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              status === "sharing"
                ? "text-primary"
                : status === "error"
                  ? "text-destructive"
                  : "text-sidebar-foreground/70",
            )}
          />

          <span className="truncate text-sm font-semibold">Share My Location</span>
        </div>

        <Switch
          checked={enabled}
          disabled={!loaded}
          onCheckedChange={() => {
            void toggle();
          }}
          aria-label="Toggle live location sharing"
        />
      </div>

      <p
        className={cn(
          "mt-1.5 text-[11px] leading-snug",
          status === "error" ? "text-destructive" : "text-sidebar-foreground/65",
        )}
      >
        {statusText}
      </p>

      <p className="mt-0.5 text-[10px] leading-snug text-sidebar-foreground/50">
        Visible to admins only between {WORK_HOURS_LABEL}.
      </p>
    </div>
  );
}