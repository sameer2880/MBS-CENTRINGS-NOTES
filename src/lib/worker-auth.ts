export const WORKER_ID_KEY = "mbs-worker-id";

export function workerEmail(name: string, id: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "worker"}-${id.slice(0, 8)}@workers.mbs.local`;
}
