import { KEY } from "./gate";
import { ADMIN_ID_KEY, ADMIN_ROLE_KEY } from "./worker-auth";

/**
 * There are three kinds of session:
 *  - the single shared master login — always full "admin" rights, no row
 *  - a workers-table row logged in with role "admin" — same full rights
 *    as the master login, including deleting anything
 *  - a workers-table row logged in with role "manager" — full access
 *    everywhere, but delete is blocked (ask the admin) except in Rentals,
 *    and Manage Users only shows/lets them add Workers
 *
 * Workers (role "worker") never reach these full-access screens at all,
 * so there's no helper for that case here.
 */

function hasFullAccess(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

/** True for the master login, or a workers-row account with role "admin". */
export function isMasterAdmin(): boolean {
  if (!hasFullAccess()) return false;
  const adminId = localStorage.getItem(ADMIN_ID_KEY);
  if (!adminId) return true; // master login — no row, always full admin
  return localStorage.getItem(ADMIN_ROLE_KEY) === "admin";
}

/** True for a workers-row account with role "manager". */
export function isManager(): boolean {
  if (!hasFullAccess()) return false;
  const adminId = localStorage.getItem(ADMIN_ID_KEY);
  if (!adminId) return false; // master login is never a manager
  return localStorage.getItem(ADMIN_ROLE_KEY) !== "admin";
}

/**
 * Rentals is the one place managers are allowed to delete directly.
 * Everywhere else, deleting is restricted to isMasterAdmin().
 */
export function canDeleteRentals(): boolean {
  return isMasterAdmin() || isManager();
}