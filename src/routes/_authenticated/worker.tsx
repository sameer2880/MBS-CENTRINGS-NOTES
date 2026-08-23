import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WorkerOverview } from "./labour/$id";
import { WORKER_ID_KEY } from "@/lib/worker-auth";

export const Route = createFileRoute("/_authenticated/worker")({
  component: WorkerHome,
});

function WorkerHome() {
  const workerId = typeof window !== "undefined" ? localStorage.getItem(WORKER_ID_KEY) : null;
  const { data: worker, isLoading } = useQuery({
    queryKey: ["my-worker"],
    enabled: Boolean(workerId),
    queryFn: async () => {
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

  if (!workerId) return null;
  if (isLoading) return null;
  if (!worker)
    return <p className="text-center py-10 text-destructive">Worker account is not linked.</p>;
  return <WorkerOverview id={worker.id} readOnly />;
}