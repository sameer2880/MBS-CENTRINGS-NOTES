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
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw error;
  return (data ?? []) as ActivityNotification[];
}

export function subscribeToActivityNotifications(
  onNotification: (notification: ActivityNotification) => void,
  onStatus?: (status: string, error?: Error) => void,
) {
  const channel = supabase
    .channel(`activity-notifications-${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => onNotification(payload.new as ActivityNotification),
    )
    .subscribe((status, error) => {
      onStatus?.(status, error instanceof Error ? error : error ? new Error(String(error)) : undefined);
    });
  return () => void supabase.removeChannel(channel);
}