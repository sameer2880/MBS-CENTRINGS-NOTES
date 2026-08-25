/**
 * The "workers" table has no role column, and we're not adding one.
 * Instead, an admin user is marked by prefixing their `notes` value with an
 * invisible marker. This is fully transparent to anyone reading/editing
 * notes through the UI — the marker is always stripped before display and
 * re-applied on save based on the selected role.
 *
 * A row with no marker (the normal case for every existing worker) is
 * simply a "worker" — nothing to migrate, nothing to backfill.
 */

export type UserRole = "worker" | "admin";

// NOTE: Postgres `text` columns cannot store the null byte (U+0000) at all —
// using it here caused every admin save to fail with "unsupported Unicode
// escape sequence". U+2063 (INVISIBLE SEPARATOR) is a normal, storable
// Unicode character that just happens to render as nothing, so it's safe
// to use as a hidden marker.
const ROLE_MARKER = "\u2063role:admin\u2063";

export function getRole(notes: string | null | undefined): UserRole {
  return notes?.startsWith(ROLE_MARKER) ? "admin" : "worker";
}

/** The notes text as the user should see/edit it, with the marker stripped. */
export function getVisibleNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes.startsWith(ROLE_MARKER) ? notes.slice(ROLE_MARKER.length) : notes;
}

/** Re-encodes notes for saving, re-applying the marker when role is admin. */
export function encodeNotes(role: UserRole, visibleNotes: string): string | null {
  const trimmed = visibleNotes.trim();
  if (role === "admin") return ROLE_MARKER + trimmed;
  return trimmed || null;
}