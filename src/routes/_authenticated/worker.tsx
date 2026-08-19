import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkerOverview } from "./labour/$id";
import { WORKER_ID_KEY } from "@/lib/worker-auth";

export const Route = createFileRoute("/_authenticated/worker")({
  component: WorkerHome,
});

function WorkerHome() {
  const { data: worker, isLoading } = useQuery({
    queryKey: ["my-worker"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const workerId = sessionData.session?.user.user_metadata?.worker_id ?? localStorage.getItem(WORKER_ID_KEY);
      if (typeof workerId !== "string") throw new Error("Worker session not found");
      const { data, error } = await supabase
        .from("workers")
        .select("id")
        .eq("id", workerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-center py-10 text-muted-foreground">Loading your records...</p>;
  if (!worker) return <p className="text-center py-10 text-destructive">Worker account is not linked.</p>;
  return <WorkerOverview id={worker.id} readOnly />;
}
