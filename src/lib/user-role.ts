/**
 * The "workers" table has no role column, and we're not adding one.
 * Instead, a non-worker user is marked by prefixing their `notes` value
 * with an invisible marker. This is fully transparent to anyone
 * reading/editing notes through the UI — the marker is always stripped
 * before display and re-applied on save based on the selected role.
 *
 * A row with no marker (the normal case for every existing worker) is
 * simply a "worker" — nothing to migrate, nothing to backfill.
 *
 * There are three roles:
 *  - "worker"  — attendance/payments only, no management access.
 *  - "manager" — full management access (Rentals, Diary, Labour Charges,
 *    Manage Users), but everywhere except Rentals a delete just tells
 *    them to ask the admin instead of deleting. In Manage Users they can
 *    only see and add Workers.
 *  - "admin"   — same full access as the master login: can delete
 *    anything, and can create Worker, Manager, or Admin users.
 *
 * The "manager" marker is the original marker this app shipped with, so
 * every existing admin-role row keeps working exactly as before with no
 * migration. "admin" is a new, separate marker for the new top-level role.
 */

export type UserRole = "worker" | "manager" | "admin";

// NOTE: Postgres `text` columns cannot store the null byte (U+0000) at all —
// using it here caused saves to fail with "unsupported Unicode escape
// sequence". U+2063 (INVISIBLE SEPARATOR) is a normal, storable Unicode
// character that just happens to render as nothing, so it's safe to use as
// a hidden marker.
const MANAGER_MARKER = "\u2063role:admin\u2063";
const ADMIN_MARKER = "\u2063role:superadmin\u2063";

export function getRole(notes: string | null | undefined): UserRole {
  if (notes?.startsWith(ADMIN_MARKER)) return "admin";
  if (notes?.startsWith(MANAGER_MARKER)) return "manager";
  return "worker";
}

/** The notes text as the user should see/edit it, with the marker stripped. */
export function getVisibleNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  if (notes.startsWith(ADMIN_MARKER)) return notes.slice(ADMIN_MARKER.length);
  if (notes.startsWith(MANAGER_MARKER)) return notes.slice(MANAGER_MARKER.length);
  return notes;
}

/** Re-encodes notes for saving, re-applying the marker for the given role. */
export function encodeNotes(role: UserRole, visibleNotes: string): string | null {
  const trimmed = visibleNotes.trim();
  if (role === "admin") return ADMIN_MARKER + trimmed;
  if (role === "manager") return MANAGER_MARKER + trimmed;
  return trimmed || null;
}