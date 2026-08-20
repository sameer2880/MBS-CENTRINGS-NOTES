import { supabase } from "@/integrations/supabase/client";
import { WORKER_ID_KEY } from "@/lib/worker-auth";

export type ActivityNotification = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  worker_id: string | null;
  entity_id: string | null;
  notify_admin: boolean;
  created_at: string;
};

export async function currentWorkerId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const sessionWorkerId = data.session?.user.user_metadata?.worker_id;
    return typeof sessionWorkerId === "string" ? sessionWorkerId : localStorage.getItem(WORKER_ID_KEY);
  } catch {
    return localStorage.getItem(WORKER_ID_KEY);
  }
}

export function showMobileNotification(notification: ActivityNotification) {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  const message = {
    type: "SHOW_NOTIFICATION",
    title: notification.title,
    body: notification.body,
    tag: `mbs-${notification.id}`,
  };
  navigator.serviceWorker?.controller?.postMessage(message);
  if (!navigator.serviceWorker?.controller) new Notification(notification.title, { body: notification.body });
}

export async function enableMobileNotifications(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  const permission = await Notification.requestPermission();
  if (permission === "granted") await navigator.serviceWorker?.ready;
  return permission;
}

export async function listRecentNotifications(): Promise<ActivityNotification[]> {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(25);
  if (!error) return (data ?? []) as ActivityNotification[];
  if (error.code !== "PGRST205" && error.code !== "42P01") throw error;
  return listRecentActivityFallback();
}

async function listRecentActivityFallback(): Promise<ActivityNotification[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [rentals, attendance, payments] = await Promise.all([
    supabase.from("rentals").select("id, customer_name, material_name, total_amount, updated_at, created_at").gte("updated_at", since).order("updated_at", { ascending: false }).limit(25),
    supabase.from("worker_attendance").select("id, worker_id, work_date, status, updated_at, created_at, workers(name)").gte("updated_at", since).order("updated_at", { ascending: false }).limit(25),
    supabase.from("worker_payments").select("id, worker_id, amount, updated_at, created_at, workers(name)").gte("updated_at", since).order("updated_at", { ascending: false }).limit(25),
  ]);
  const rows: ActivityNotification[] = [];
  rentals.data?.forEach((row) => rows.push({
    id: `rental-${row.id}-${row.updated_at}`,
    event_type: "rental_activity",
    title: "Rental updated",
    body: `${row.customer_name} · ${row.material_name} · ₹${row.total_amount}`,
    worker_id: null,
    entity_id: row.id,
    notify_admin: true,
    created_at: row.updated_at ?? row.created_at,
  }));
  attendance.data?.forEach((row) => rows.push({
    id: `attendance-${row.id}-${row.updated_at}`,
    event_type: "attendance_activity",
    title: "Attendance updated",
    body: `${(row.workers as { name?: string } | null)?.name ?? "Worker"} · ${row.work_date} · ${row.status}`,
    worker_id: row.worker_id,
    entity_id: row.id,
    notify_admin: true,
    created_at: row.updated_at ?? row.created_at,
  }));
  payments.data?.forEach((row) => rows.push({
    id: `payment-${row.id}-${row.updated_at}`,
    event_type: "payment_activity",
    title: "Payment updated",
    body: `${(row.workers as { name?: string } | null)?.name ?? "Worker"} · ₹${row.amount}`,
    worker_id: row.worker_id,
    entity_id: row.id,
    notify_admin: true,
    created_at: row.updated_at ?? row.created_at,
  }));
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 25);
}

export function subscribeToActivityNotifications(
  onNotification: (notification: ActivityNotification) => void,
  onStatus?: (status: string, error?: Error) => void,
) {
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  const poll = () => void listRecentActivityFallback().then((rows) => rows.forEach(onNotification)).catch(() => undefined);
  const channel = supabase
    .channel(`activity-notifications-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => onNotification(payload.new as ActivityNotification),
    )
    .subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        pollTimer = setInterval(poll, 5000);
      }
      onStatus?.(status, error instanceof Error ? error : error ? new Error(String(error)) : undefined);
    });
  return () => {
    if (pollTimer) clearInterval(pollTimer);
    void supabase.removeChannel(channel);
  };
}