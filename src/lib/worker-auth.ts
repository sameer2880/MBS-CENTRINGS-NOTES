export const WORKER_ID_KEY = "mbs-worker-id";
export const WORKER_SESSION_KEY = "mbs-worker-session";

export function workerSessionKey(workerId: string) {
  return `${WORKER_SESSION_KEY}:${workerId}`;
}

// Set only when the current full-access session came from a workers-table
// row (via name + mobile login) — either an "admin" or "manager" role row
// — so it can be re-checked for active status and used for self-service
// password changes. Absent for the single shared master login
// (mbscentringworks/mbs), which has no row and can't be deactivated or
// self-edited this way.
export const ADMIN_ID_KEY = "mbs-admin-id";

// The row's role ("admin" | "manager") at the time of login, re-checked
// alongside ADMIN_ID_KEY. Only meaningful when ADMIN_ID_KEY is set — the
// master login is always treated as a full "admin" with no row to read.
export const ADMIN_ROLE_KEY = "mbs-admin-role";

export function workerEmail(name: string, id: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "worker"}-${id.slice(0, 8)}@workers.mbs.local`;
}
