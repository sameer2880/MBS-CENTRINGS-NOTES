import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

/**
 * Opt-in location sharing, always visible to the worker.
 *
 * - Off by default. Nothing is sent anywhere until the worker flips this on.
 * - While on, an explicit "Location sharing is ON" badge is shown at all times
 *   (this component is meant to stay visible on screen, not buried in a menu).
 * - Turning it off immediately stops updates and clears sharing_enabled,
 *   which also removes the admin's read access via the RLS policy.
 */
export function WorkerLocationToggle({ workerId }: { workerId: string }) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Reflect current DB state on mount, in case they left it on last session.
    void (async () => {
      const { data } = await supabase
        .from("worker_locations")
        .select("sharing_enabled")
        .eq("worker_id", workerId)
        .maybeSingle();
      if (data?.sharing_enabled) setSharing(true);
    })();
    return () => stopWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  function stopWatch() {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  async function setSharingEnabled(next: boolean) {
    setError(null);
    if (!next) {
      stopWatch();
      setSharing(false);
      await supabase
        .from("worker_locations")
        .upsert({ worker_id: workerId, sharing_enabled: false, latitude: 0, longitude: 0 }, { onConflict: "worker_id" });
      return;
    }

    if (!("geolocation" in navigator)) {
      setError("Location isn't supported on this device/browser.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("worker_locations").upsert(
          {
            worker_id: workerId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
            sharing_enabled: true,
          },
          { onConflict: "worker_id" },
        );
        setSharing(true);
      },
      (err) => {
        setError(err.message || "Couldn't get your location.");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className={`h-4 w-4 ${sharing ? "text-success" : "text-muted-foreground"}`} />
          <div>
            <p className="text-sm font-semibold">Share my location</p>
            <p className="text-xs text-muted-foreground">
              {sharing ? "Sharing is ON — visible to your admin right now." : "Off — your admin can't see your location."}
            </p>
          </div>
        </div>
        <Switch checked={sharing} onCheckedChange={setSharingEnabled} aria-label="Toggle location sharing" />
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}