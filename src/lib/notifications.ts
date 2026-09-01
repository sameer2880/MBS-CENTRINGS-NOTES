import { supabase } from "@/integrations/supabase/client";

export type NotificationEventType =
  | "rental_added"
  | "rental_deleted"
  | "attendance_added"
  | "attendance_removed";

export async function createAppNotification({
  title,
  body,
  event_type,
  worker_id,
  entity_id,
  notify_admin = true,
}: {
  title: string;
  body: string;
  event_type: NotificationEventType;
  worker_id?: string | null;
  entity_id?: string | null;
  notify_admin?: boolean;
}) {
  const { error } = await supabase.from("notifications").insert({
    title,
    body,
    event_type,
    worker_id: worker_id ?? null,
    entity_id: entity_id ?? null,
    notify_admin,
  });

  if (error) throw error;
}
