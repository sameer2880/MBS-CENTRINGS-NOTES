import { Bell, BellRing, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, loading } = useRealtimeNotifications();

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const total = notifications.length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="relative gap-2"
        onClick={() => setOpen((value) => !value)}
      >
        {total > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        Alerts
        {total > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {total}
          </span>
        )}
      </Button>

      {open && (
        <Card
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[min(22rem,88vw)] shadow-lg",
            "border-border bg-background",
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="font-semibold">Notification centre</div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close notifications">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <CardContent className="max-h-[24rem] space-y-3 overflow-y-auto p-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading updates...</div>
            ) : notifications.length === 0 ? (
              <div className="text-sm text-muted-foreground">No alerts yet.</div>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{notification.title}</div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {notification.event_type}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{notification.body}</div>
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
