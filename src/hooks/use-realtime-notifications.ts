import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  event_type: string;
  created_at: string;
  worker_id?: string | null;
  entity_id?: string | null;
  notify_admin?: boolean;
};

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!isMounted) return;

      if (!error && data) {
        setNotifications(data as NotificationItem[]);
      }
      setLoading(false);
    };

    void loadNotifications();

    const channel = supabase.channel("mobile-notifications");

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
      },
      (payload) => {
        const next = payload.new as NotificationItem;
        setNotifications((current) => [next, ...current].slice(0, 20));

        if (typeof window !== "undefined" && "Notification" in window) {
          const permission = Notification.permission;
          if (permission === "granted") {
            const title = next.title || "MBS update";
            const body = next.body || "A new update has arrived.";
            new Notification(title, {
              body,
              tag: next.id,
            });
          }
        }
      },
    );

    void channel.subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return {
    notifications,
    loading,
  };
}
