import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AdminOnly } from "@/components/AdminOnly";
import { isMasterAdmin } from "@/lib/access";

type Feedback = {
  id: string;
  worker_id: string;
  work_date: string;
  attendance_feedback: string | null;
  payment_feedback: string | null;
  created_at: string;
};

type Worker = { id: string; name: string };

export const Route = createFileRoute("/_authenticated/feedback")({
  component: FeedbackPage,
});

function FeedbackPage() {
  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ["worker_feedback_admin"],
    queryFn: async () => {
      const [{ data: feedbackRows, error: feedbackError }, { data: workers, error: workersError }] =
        await Promise.all([
          supabase
            .from("worker_feedback")
            .select("id, worker_id, work_date, attendance_feedback, payment_feedback, created_at")
            .order("work_date", { ascending: false }),
          supabase.from("workers").select("id, name"),
        ]);
      if (feedbackError) throw feedbackError;
      if (workersError) throw workersError;
      const workerMap = new Map((workers as Worker[]).map((worker) => [worker.id, worker.name]));
      return (feedbackRows as Feedback[]).map((item) => ({
        ...item,
        workerName: workerMap.get(item.worker_id) ?? "Unknown worker",
      }));
    },
    enabled: isMasterAdmin(),
  });

  return (
    <AdminOnly label="Worker Feedback">
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <MessageSquare className="h-5 w-5 text-primary" /> Worker Feedback
        </h2>
        <p className="text-sm text-muted-foreground">
          Attendance and payment feedback submitted by workers.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading feedback...</p>
      ) : feedback.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No worker feedback submitted yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {feedback.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">{item.workerName}</div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(`${item.work_date}T00:00:00`).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md bg-muted/50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Attendance
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {item.attendance_feedback || "No feedback"}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Payment
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {item.payment_feedback || "No feedback"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </AdminOnly>
  );
}