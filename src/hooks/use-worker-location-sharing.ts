```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ================================
   LOCATION SHARING
   24 HOURS A DAY
   ================================ */

// How often we send a fresh location while sharing is active.
// A worker's position gets pushed at least this often even if
// they haven't moved, since watchPosition alone can go quiet
// on a stationary device.
const UPDATE_INTERVAL_MS = 60_000;

export const WORK_HOURS_LABEL = "24 Hours";

export function isWithinWorkingHours(_date: Date = new Date()) {
  // Location sharing is available 24 hours a day.
  return true;
}

export type LocationSharingStatus =
  | "idle" // off
  | "sharing" // on + sending updates
  | "paused" // kept for compatibility, but no longer caused by working hours
  | "error"; // on but geolocation failed

type Coords = {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
};

export function useWorkerLocationSharing(workerId: string | null) {
  // Sharing is ON by default.
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<LocationSharingStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastWriteRef = useRef(0);
  const lastCoordsRef = useRef<Coords | null>(null);

  /* ================================
     LOAD LAST KNOWN POSITION
     ================================ */
  useEffect(() => {
    if (!workerId) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    void supabase
      .from("worker_locations")
      .select("latitude, longitude, accuracy_m")
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

        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [workerId]);

  /* ================================
     WRITE HELPER
     ================================ */
  const writeRow = useCallback(
    async (patch: {
      sharing_enabled?: boolean;
      coords?: Coords;
    }) => {
      if (!workerId) return;

      if (patch.coords) {
        lastCoordsRef.current = patch.coords;
      }

      const coords = lastCoordsRef.current;

      const { error } = await supabase
        .from("worker_locations")
        .upsert(
          {
            worker_id: workerId,

            ...(patch.sharing_enabled !== undefined
              ? {
                  sharing_enabled: patch.sharing_enabled,
                }
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
          {
            onConflict: "worker_id",
          },
        );

      if (error) throw error;
    },
    [workerId],
  );

  /* ================================
     SEND LOCATION FIX
     ================================ */
  const sendFix = useCallback(
    (position: GeolocationPosition) => {
      lastWriteRef.current = Date.now();

      setErrorMessage(null);
      setStatus("sharing");

      void writeRow({
        sharing_enabled: true,
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy ?? null,
        },
      }).catch(() => {
        // Non-fatal.
        // We'll retry on the next location tick.
      });
    },
    [writeRow],
  );

  /* ================================
     GEOLOCATION ERROR
     ================================ */
  const handleGeoError = useCallback(
    (geoError: GeolocationPositionError) => {
      setErrorMessage(
        geoError.code === geoError.PERMISSION_DENIED
          ? "Location permission was denied. Enable it in your browser/app settings to share your location."
          : "Could not get your location. Make sure GPS is turned on.",
      );

      setStatus("error");
    },
    [],
  );

  /* ================================
     STOP GEOLOCATION WATCH
     ================================ */
  const stopWatch = useCallback(() => {
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined"
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  /* ================================
     START GEOLOCATION WATCH
     ================================ */
  const startWatch = useCallback(() => {
    if (watchIdRef.current !== null) return;

    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation
    ) {
      setErrorMessage(
        "Location is not supported on this device.",
      );
      setStatus("error");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        // No working-hours restriction anymore.

        // watchPosition can fire often while moving.
        // Only write at most once per minute.
        if (
          Date.now() - lastWriteRef.current <
          UPDATE_INTERVAL_MS
        ) {
          return;
        }

        sendFix(position);
      },
      handleGeoError,
      {
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 25_000,
      },
    );
  }, [handleGeoError, sendFix]);

  /* ================================
     FORCE LOCATION UPDATE EVERY MINUTE
     
     This works independently of watchPosition,
     so a stationary worker still gets a fresh
     location approximately every 60 seconds.
     ================================ */
  useEffect(() => {
    if (!loaded || !enabled) return;

    const tick = () => {
      // No working-hours restriction.
      // Location can be updated 24/7.

      if (
        typeof navigator === "undefined" ||
        !navigator.geolocation
      ) {
        setErrorMessage(
          "Location is not supported on this device.",
        );
        setStatus("error");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        sendFix,
        handleGeoError,
        {
          enableHighAccuracy: true,
          maximumAge: 10_000,
          timeout: 20_000,
        },
      );
    };

    // Get a location immediately.
    tick();

    // Then refresh every minute.
    const interval = window.setInterval(
      tick,
      UPDATE_INTERVAL_MS,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, loaded, sendFix, handleGeoError]);

  /* ================================
     REACT TO ENABLED TOGGLING
     
     There is no working-hours boundary anymore.
     ================================ */
  useEffect(() => {
    if (!loaded) return;

    if (!enabled) {
      stopWatch();
      setStatus("idle");
      return;
    }

    // Always start tracking when enabled.
    startWatch();

    setStatus((current) =>
      current === "error" ? current : "sharing",
    );
  }, [
    enabled,
    loaded,
    startWatch,
    stopWatch,
  ]);

  /* ================================
     ALWAYS STOP WATCH ON UNMOUNT
     ================================ */
  useEffect(() => stopWatch, [stopWatch]);

  /* ================================
     PUBLIC TOGGLE
     MANUAL PAUSE / RESUME
     ================================ */
  const toggle = useCallback(async () => {
    if (!workerId) return;

    const next = !enabled;

    setEnabled(next);
    setErrorMessage(null);

    try {
      await writeRow({
        sharing_enabled: next,
      });
    } catch {
      // Reflect failure by reverting the switch.
      setEnabled(!next);

      setErrorMessage(
        "Couldn't update location sharing. Check your connection and try again.",
      );
    }
  }, [
    enabled,
    workerId,
    writeRow,
  ]);

  return {
    enabled,
    status,
    errorMessage,
    toggle,
    loaded,
  };
}
```
