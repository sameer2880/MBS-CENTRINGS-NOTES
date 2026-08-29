import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MapPinned, RadioTower, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isWithinWorkingHours, WORK_HOURS_LABEL } from "@/hooks/use-worker-location-sharing";
import { AdminOnly } from "@/components/AdminOnly";
import { isMasterAdmin } from "@/lib/access";

export const Route = createFileRoute("/_authenticated/worker-locations")({
  head: () => ({
    meta: [
      { title: "Worker Locations — M.B.S Centring Works" },
      {
        name: "description",
        content: "Live GPS locations of workers who have location sharing turned on.",
      },
    ],
  }),
  component: WorkerLocationsPage,
});

// A worker is treated as "live" if we heard from them in the last 3
// minutes — after that their pin is shown as stale/offline.
const LIVE_THRESHOLD_MS = 3 * 60 * 1000;

// Poll for fresh positions every 15s while this page is open.
const REFRESH_INTERVAL_MS = 15_000;

type WorkerLocationRow = {
  worker_id: string;
  name: string;
  active: boolean;
  sharing_enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  updated_at: string | null;
};

function WorkerLocationsPage() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const withinHours = isWithinWorkingHours(now);

  const {
    data: rows = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["worker-locations-admin"],
    refetchInterval: REFRESH_INTERVAL_MS,
    queryFn: async () => {
      const [{ data: workers, error: workersError }, { data: locations, error: locationsError }] =
        await Promise.all([
          supabase.from("workers").select("id, name, active").order("name"),
          supabase
            .from("worker_locations")
            .select("worker_id, sharing_enabled, latitude, longitude, accuracy_m, updated_at"),
        ]);

      if (workersError) throw workersError;
      if (locationsError) throw locationsError;

      const locationMap = new Map(
        (locations ?? []).map((location) => [location.worker_id, location]),
      );

      const merged: WorkerLocationRow[] = (workers ?? [])
        .filter((worker) => worker.active)
        .map((worker) => {
          const location = locationMap.get(worker.id);
          return {
            worker_id: worker.id,
            name: worker.name,
            active: worker.active,
            sharing_enabled: Boolean(location?.sharing_enabled),
            latitude: location?.latitude ?? null,
            longitude: location?.longitude ?? null,
            accuracy_m: location?.accuracy_m ?? null,
            updated_at: location?.updated_at ?? null,
          };
        });

      // Sharing-and-live workers first, then sharing-but-stale, then off.
      merged.sort((a, b) => {
        const rank = (row: WorkerLocationRow) => {
          if (!row.sharing_enabled || !row.latitude || !row.updated_at) return 2;
          const isLive = Date.now() - new Date(row.updated_at).getTime() < LIVE_THRESHOLD_MS;
          return isLive ? 0 : 1;
        };
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });

      return merged;
    },
    enabled: isMasterAdmin(),
  });

  const liveCount = rows.filter(
    (row) =>
      row.sharing_enabled &&
      row.latitude != null &&
      row.updated_at &&
      Date.now() - new Date(row.updated_at).getTime() < LIVE_THRESHOLD_MS,
  ).length;

  return (
    <AdminOnly label="Worker Locations">
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <MapPinned className="h-5 w-5 text-primary" /> Worker Locations
          </h2>
          <p className="text-sm text-muted-foreground">
            Live GPS location of workers who have turned location sharing on.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={withinHours ? "default" : "secondary"}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <Clock className="h-3 w-3" />
            {withinHours ? "Working hours" : "Outside working hours"}
          </Badge>

          <Badge variant="outline" className="h-8 gap-1.5 px-3 text-xs">
            <RadioTower className="h-3 w-3 text-primary" />
            {liveCount} live
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNow(new Date());
              void refetch();
            }}
            disabled={isFetching}
            className="h-8 gap-1.5 px-3 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {!withinHours && (
        <Card className="border-dashed">
          <CardContent className="py-3 text-sm text-muted-foreground">
            Live tracking runs between <span className="font-semibold">{WORK_HOURS_LABEL}</span>.
            Outside this window, workers' apps automatically pause sharing, so locations below may
            be from earlier in the day.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading worker locations...</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No active workers found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const hasFix = row.sharing_enabled && row.latitude != null && row.longitude != null;
            const isLive =
              hasFix &&
              row.updated_at &&
              Date.now() - new Date(row.updated_at).getTime() < LIVE_THRESHOLD_MS;

            const mapsUrl = hasFix
              ? `https://www.google.com/maps?q=${row.latitude},${row.longitude}`
              : null;

            const embedUrl = hasFix
              ? `https://maps.google.com/maps?q=${row.latitude},${row.longitude}&z=16&output=embed`
              : null;

            return (
              <Card key={row.worker_id} className="overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 pt-4">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {hasFix && row.updated_at
                        ? `Updated ${formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}`
                        : row.sharing_enabled
                          ? "Waiting for first GPS fix..."
                          : "Location sharing is off"}
                    </div>
                  </div>

                  <Badge
                    variant={isLive ? "default" : hasFix ? "secondary" : "outline"}
                    className="shrink-0"
                  >
                    {isLive ? "Live" : hasFix ? "Stale" : "Off"}
                  </Badge>
                </div>

                <CardContent className="p-4">
                  {hasFix && embedUrl ? (
                    <div className="overflow-hidden rounded-lg border">
                      <iframe
                        title={`${row.name} location`}
                        src={embedUrl}
                        className="h-40 w-full"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                      No location available
                    </div>
                  )}

                  {hasFix && mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
                    >
                      Open in Google Maps
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
    </AdminOnly>
  );
}