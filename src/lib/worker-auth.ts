export const WORKER_ID_KEY = "mbs-worker-id";

// Set only when the current full-access ("admin") session came from an
// admin-role row in the workers table (via name + mobile login), so it can
// be re-checked for active status and used for self-service password
// changes. Absent for the single shared master login (mbsnotes/mbsnotes),
// which has no row and can't be deactivated or self-edited this way.
export const ADMIN_ID_KEY = "mbs-admin-id";

export function workerEmail(name: string, id: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "worker"}-${id.slice(0, 8)}@workers.mbs.local`;
}