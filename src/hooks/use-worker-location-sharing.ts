import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ================================
   WORKING HOURS WINDOW
   5:30 AM -> 7:00 PM
   ================================ */
const WORK_START_MINUTES = 5 * 60 + 30;
const WORK_END_MINUTES = 19 * 60;

// Minimum gap between two writes to Supabase while actively sharing.
const MIN_WRITE_INTERVAL_MS = 20_000;

export function isWithinWorkingHours(date: Date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= WORK_START_MINUTES && minutes < WORK_END_MINUTES;
}

export const WORK_HOURS_LABEL = "5:30 AM - 7:00 PM";

export type LocationSharingStatus =
  | "idle" // off
  | "sharing" // on + within working hours + sending updates
  | "paused" // on but outside working hours, so nothing is being sent
  | "error"; // on but geolocation failed (permission denied, etc.)

type Coords = {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
};

export function useWorkerLocationSharing(workerId: string | null) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<LocationSharingStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastWriteRef = useRef(0);
  const lastCoordsRef = useRef<Coords | null>(null);

  /* ================================
     LOAD EXISTING PREFERENCE
     ================================ */
  useEffect(() => {
    if (!workerId) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    void supabase
      .from("worker_locations")
      .select("sharing_enabled, latitude, longitude, accuracy_m")
      .eq("worker_id", workerId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;

        if (data?.latitude != null && data?.longitude != null) {
          lastCoordsRef.current = {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy_m: data.accuracy_m,
          };
        }

        setEnabled(Boolean(data?.sharing_enabled));
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [workerId]);

  /* ================================
     WRITE HELPERS
     ================================ */
  const writeRow = useCallback(
    async (patch: { sharing_enabled?: boolean; coords?: Coords }) => {
      if (!workerId) return;

      if (patch.coords) lastCoordsRef.current = patch.coords;

      const coords = lastCoordsRef.current;

      const { error } = await supabase.from("worker_locations").upsert(
        {
          worker_id: workerId,
          ...(patch.sharing_enabled !== undefined
            ? { sharing_enabled: patch.sharing_enabled }
            : {}),
          ...(coords
            ? {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy_m: coords.accuracy_m,
              }
            : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "worker_id" },
      );

      if (error) throw error;
    },
    [workerId],
  );

  /* ================================
     GEOLOCATION WATCH
     ================================ */
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (watchIdRef.current !== null) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMessage("Location is not supported on this device.");
      setStatus("error");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setErrorMessage(null);

        if (!isWithinWorkingHours()) {
          setStatus("paused");
          return;
        }

        setStatus("sharing");

        const now = Date.now();
        if (now - lastWriteRef.current < MIN_WRITE_INTERVAL_MS) return;
        lastWriteRef.current = now;

        void writeRow({
          sharing_enabled: true,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_m: position.coords.accuracy ?? null,
          },
        }).catch(() => {
          // Non-fatal: we'll retry on the next position update.
        });
      },
      (geoError) => {
        setErrorMessage(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission was denied. Enable it in your browser/app settings to share your location."
            : "Could not get your location. Make sure GPS is turned on.",
        );
        setStatus("error");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 25_000 },
    );
  }, [writeRow]);

  /* ================================
     REACT TO enabled TOGGLING
     ================================ */
  useEffect(() => {
    if (!loaded) return;

    if (!enabled) {
      stopWatch();
      setStatus("idle");
      return;
    }

    setStatus(isWithinWorkingHours() ? "sharing" : "paused");
    startWatch();

    // Re-check the working-hours window every minute so sharing
    // automatically pauses/resumes at 5:30 AM / 7:00 PM without the
    // worker needing to touch the toggle.
    const interval = window.setInterval(() => {
      setStatus((current) => {
        if (current === "error") return current;
        return isWithinWorkingHours() ? "sharing" : "paused";
      });
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, loaded, startWatch, stopWatch]);

  // Always stop the watch on unmount.
  useEffect(() => stopWatch, [stopWatch]);

  /* ================================
     PUBLIC TOGGLE
     ================================ */
  const toggle = useCallback(async () => {
    if (!workerId) return;

    const next = !enabled;
    setEnabled(next);
    setErrorMessage(null);

    try {
      await writeRow({ sharing_enabled: next });
    } catch {
      // Reflect failure by reverting the switch.
      setEnabled(!next);
      setErrorMessage("Couldn't update location sharing. Check your connection and try again.");
    }
  }, [enabled, workerId, writeRow]);

  return { enabled, status, errorMessage, toggle, loaded };
}