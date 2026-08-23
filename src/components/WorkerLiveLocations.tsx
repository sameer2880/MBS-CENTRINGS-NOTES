import { useEffect, useState } from "react";
import { MapPin, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type LiveLocation = {
  worker_id: string;
  latitude: number;
  longitude: number;
  updated_at: string;
  workers: { name: string } | null;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  return `${Math.round(mins / 60)}h ago`;
}

/**
 * Admin-only. Shows ONLY workers who currently have location sharing
 * switched on themselves (worker_locations.sharing_enabled = true).
 * The RLS policy on worker_locations enforces this at the DB level too,
 * so there is no path to see a worker's location without their toggle being on.
 */
export function WorkerLiveLocations() {
  const [rows, setRows] = useState<LiveLocation[]>([]);

  async function load() {
    const { data } = await supabase
      .from("worker_locations")
      .select("worker_id, latitude, longitude, updated_at, workers(name)")
      .eq("sharing_enabled", true)
      .order("updated_at", { ascending: false });

    setRows((data as unknown as LiveLocation[]) ?? []);
  }

  useEffect(() => {
    void load();

    const interval = setInterval(load, 20_000);

    const channel = supabase
      .channel("worker-locations-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "worker_locations",
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="mx-4 mt-5 border-t border-sidebar-border pt-5">
      <div className="flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/65">
        <Radio className="h-3.5 w-3.5" />
        Live locations ({rows.length})
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 px-3 text-xs text-sidebar-foreground/55">
          No workers are sharing their location right now.
        </p>
      ) : (
        <div className="mt-2 space-y-1">
          {rows.map((r) => (
            <a
              key={r.worker_id}
              href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-sidebar-accent"
            >
              <MapPin className="h-4 w-4 shrink-0 text-success" />

              <span className="min-w-0 flex-1 truncate">
                {r.workers?.name ?? "Worker"}
              </span>

              <span className="shrink-0 text-[10px] font-normal text-sidebar-foreground/55">
                {timeAgo(r.updated_at)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}