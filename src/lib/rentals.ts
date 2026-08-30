import { supabase } from "@/integrations/supabase/client";

export interface Rental {
  id: string;
  group_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  material_name: string;
  quantity: number;
  unit: string;
  rate_per_unit: number;
  total_amount: number;
  security_deposit: number | null;
  issue_date: string;
  return_date: string;
  status: "active" | "returned" | "overdue";
  payment_status: "paid" | "unpaid";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A "card" worth of materials — every rental row that was created together
 * (same group_id) is bundled into one RentalGroup so they render as a single
 * card instead of one card per material.
 */
export interface RentalGroup {
  group_id: string;
  rows: Rental[];
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  issue_date: string;
  return_date: string;
  total_amount: number;
  security_deposit: number;
  status: "active" | "returned" | "overdue" | "partial";
  payment_status: "paid" | "unpaid";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function computeStatus(r: Pick<Rental, "status" | "return_date">): Rental["status"] {
  if (r.status === "returned") return "returned";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ret = new Date(r.return_date);
  return ret < today ? "overdue" : "active";
}

/**
 * Groups rentals by group_id so materials added together show up as one
 * card. `rentals` is expected pre-sorted (newest first, as listRentals()
 * returns) — group order follows the position of each group's first row,
 * so the newest activity still sorts first.
 */
export function groupRentals(rentals: Rental[]): RentalGroup[] {
  const order: string[] = [];
  const byGroup = new Map<string, Rental[]>();

  for (const r of rentals) {
    const key = r.group_id || r.id;
    const existing = byGroup.get(key);
    if (existing) {
      existing.push(r);
    } else {
      byGroup.set(key, [r]);
      order.push(key);
    }
  }

  return order.map((group_id) => {
    const rows = byGroup.get(group_id)!;
    const first = rows[0];
    const returnedCount = rows.filter((r) => r.status === "returned").length;
    const overdueCount = rows.filter((r) => r.status === "overdue").length;

    let status: RentalGroup["status"];
    if (returnedCount === rows.length) status = "returned";
    else if (returnedCount > 0) status = "partial";
    else if (overdueCount > 0) status = "overdue";
    else status = "active";

    const payment_status: RentalGroup["payment_status"] =
      rows.every((r) => r.payment_status === "paid") ? "paid" : "unpaid";

    return {
      group_id,
      rows,
      customer_name: first.customer_name,
      customer_phone: first.customer_phone,
      customer_address: first.customer_address,
      issue_date: first.issue_date,
      return_date: first.return_date,
      total_amount: rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
      security_deposit: rows.reduce((s, r) => s + Number(r.security_deposit || 0), 0),
      status,
      payment_status,
      notes: first.notes,
      created_at: rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), first.created_at),
      updated_at: rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), first.updated_at),
    };
  });
}

/**
 * Row indicator colors for the rentals table. Rows are no longer tinted —
 * instead, a small color marker is shown in the corner of the row's first
 * cell so the status is still visible at a glance without coloring the
 * whole row:
 * - Active                -> blue   (payment doesn't change this)
 * - Overdue               -> red
 * - Partially returned    -> amber  (some materials back, some not)
 * - Returned + paid       -> green
 * - Returned + not paid   -> orange
 */
export function getRentalRowTheme(
  r: Pick<Rental, "payment_status"> & { status: Rental["status"] | "partial" },
) {
  if (r.status === "returned") {
    return r.payment_status === "paid"
      ? { key: "green", dotClass: "bg-success", cornerClass: "border-t-success" }
      : { key: "orange", dotClass: "bg-orange-500", cornerClass: "border-t-orange-500" };
  }
  if (r.status === "partial") {
    return { key: "amber", dotClass: "bg-amber-500", cornerClass: "border-t-amber-500" };
  }
  if (r.status === "overdue") {
    return { key: "red", dotClass: "bg-destructive", cornerClass: "border-t-destructive" };
  }
  return { key: "blue", dotClass: "bg-blue-500", cornerClass: "border-t-blue-500" };
}

export async function listRentals(): Promise<Rental[]> {
  const { data, error } = await supabase.from("rentals").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as any[]).map((r) => ({ ...r, status: computeStatus(r) }));
}

export function buildConfirmMessage(r: Rental) {
  const advance = Number(r.security_deposit || 0);
  const balance = Number(r.total_amount || 0) - advance;
  return `Hello ${r.customer_name},

Welcome to M.B.S CENTRING WORKS, Nereducherla.

Rental Details:
Material: ${r.material_name}
Quantity: ${r.quantity} ${r.unit}
Amount: ₹${r.total_amount}${advance ? `\nAdvance Received: ₹${advance.toLocaleString("en-IN")}\nBalance Due: ₹${balance.toLocaleString("en-IN")}` : ""}
Issue Date: ${r.issue_date}
Return Date: ${r.return_date}

Please return the material on or before the scheduled date.

Thank you.`;
}

export function buildGroupConfirmMessage(rows: Rental[]) {
  if (rows.length === 1) return buildConfirmMessage(rows[0]);
  const first = rows[0];
  const lines = rows
    .map((r, i) => `${i + 1}. ${r.material_name} — ${r.quantity} ${r.unit} — ₹${Number(r.total_amount).toLocaleString("en-IN")}`)
    .join("\n");
  const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const advance = rows.reduce((s, r) => s + Number(r.security_deposit || 0), 0);
  const balance = total - advance;
  return `Hello ${first.customer_name},

Welcome to M.B.S CENTRING WORKS, Nereducherla.

Rental Details:
${lines}

Total Amount: ₹${total.toLocaleString("en-IN")}${advance ? `\nAdvance Received: ₹${advance.toLocaleString("en-IN")}\nBalance Due: ₹${balance.toLocaleString("en-IN")}` : ""}
Issue Date: ${first.issue_date}
Return Date: ${first.return_date}

Please return the materials on or before the scheduled date.

Thank you.`;
}


export function buildReminderMessage(r: Rental) {
  return `Hello ${r.customer_name},

This is a reminder from M.B.S CENTRING WORKS, Nereducherla.

Your rented material ${r.material_name} is due on ${r.return_date}.

Please return it on time or contact us if you need an extension.

Thank you.`;
}

function daysBetween(a: Date, b: Date) {
  const ms = a.setHours(0, 0, 0, 0) - b.setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

/** Sent while a rental is still within its return date — a friendly status update. */
export function buildActiveMessage(r: Rental) {
  const today = new Date();
  const ret = new Date(r.return_date);
  const daysLeft = daysBetween(ret, today);
  const dueText =
    daysLeft === 0
      ? "due today"
      : daysLeft === 1
        ? "due tomorrow"
        : daysLeft > 1
          ? `due in ${daysLeft} days`
          : "due soon";

  return `Hello ${r.customer_name},

This is a status update from M.B.S CENTRING WORKS, Nereducherla.

Your rented material ${r.material_name} (Qty: ${r.quantity} ${r.unit}) is currently active and ${dueText} on ${r.return_date}.

Please plan to return it on or before the due date.

Thank you.`;
}

/** Group version of buildActiveMessage — lists every material still with the customer. */
export function buildGroupActiveMessage(rows: Rental[]) {
  if (rows.length === 1) return buildActiveMessage(rows[0]);
  const first = rows[0];
  const today = new Date();
  const ret = new Date(first.return_date);
  const daysLeft = daysBetween(ret, today);
  const dueText =
    daysLeft === 0 ? "due today" : daysLeft === 1 ? "due tomorrow" : daysLeft > 1 ? `due in ${daysLeft} days` : "due soon";
  const lines = rows.map((r) => `- ${r.material_name} (Qty: ${r.quantity} ${r.unit})`).join("\n");

  return `Hello ${first.customer_name},

This is a status update from M.B.S CENTRING WORKS, Nereducherla.

Your rented materials are currently active and ${dueText} on ${first.return_date}:
${lines}

Please plan to return them on or before the due date.

Thank you.`;
}

/** Sent once a rental has crossed its return date — a first overdue notice. */
export function buildOverdueMessage(r: Rental) {
  const today = new Date();
  const ret = new Date(r.return_date);
  const daysLate = Math.max(1, daysBetween(today, ret));

  return `Hello ${r.customer_name},

This is an overdue notice from M.B.S CENTRING WORKS, Nereducherla.

Your rented material ${r.material_name} (Qty: ${r.quantity} ${r.unit}) was due for return on ${r.return_date} and is now ${daysLate} day${daysLate > 1 ? "s" : ""} overdue.

Kindly return the material at the earliest or contact us to extend the rental.

Thank you.`;
}

/** Group version of buildOverdueMessage — lists every overdue material. */
export function buildGroupOverdueMessage(rows: Rental[]) {
  if (rows.length === 1) return buildOverdueMessage(rows[0]);
  const first = rows[0];
  const today = new Date();
  const ret = new Date(first.return_date);
  const daysLate = Math.max(1, daysBetween(today, ret));
  const lines = rows.map((r) => `- ${r.material_name} (Qty: ${r.quantity} ${r.unit})`).join("\n");

  return `Hello ${first.customer_name},

This is an overdue notice from M.B.S CENTRING WORKS, Nereducherla.

The following materials were due for return on ${first.return_date} and are now ${daysLate} day${daysLate > 1 ? "s" : ""} overdue:
${lines}

Kindly return the materials at the earliest or contact us to extend the rental.

Thank you.`;
}

/** A stronger follow-up for material that is still not returned after an earlier notice. */
export function buildNotReturnedMessage(r: Rental) {
  return `Hello ${r.customer_name},

This is a follow-up from M.B.S CENTRING WORKS, Nereducherla.

As per our records, the material ${r.material_name} (Qty: ${r.quantity} ${r.unit}) rented on ${r.issue_date} has still not been returned.

Please arrange to return it immediately or contact us to avoid further charges/action.

Thank you.`;
}

/** Group version of buildNotReturnedMessage — pass just the still-pending rows. */
export function buildGroupNotReturnedMessage(rows: Rental[]) {
  if (rows.length === 0) return "";
  if (rows.length === 1) return buildNotReturnedMessage(rows[0]);
  const first = rows[0];
  const lines = rows.map((r) => `- ${r.material_name} (Qty: ${r.quantity} ${r.unit})`).join("\n");

  return `Hello ${first.customer_name},

This is a follow-up from M.B.S CENTRING WORKS, Nereducherla.

As per our records, the following materials rented on ${first.issue_date} have still not been returned:
${lines}

Please arrange to return them immediately or contact us to avoid further charges/action.

Thank you.`;
}

export function buildReturnMessage(r: Rental) {
  const returnedOn = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return `Hello ${r.customer_name},

Thank you for returning the rented material ${r.material_name}.

The rental material is returned on ${returnedOn}.

We appreciate your business.

Thank you for choosing M.B.S CENTRING WORKS, Nereducherla.`;
}

/** Group version of buildReturnMessage — pass just the rows that were just marked returned. */
export function buildGroupReturnMessage(rows: Rental[]) {
  if (rows.length === 0) return "";
  if (rows.length === 1) return buildReturnMessage(rows[0]);
  const first = rows[0];
  const returnedOn = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const lines = rows.map((r) => `- ${r.material_name} (Qty: ${r.quantity} ${r.unit})`).join("\n");

  return `Hello ${first.customer_name},

Thank you for returning the rented materials:
${lines}

The materials were returned on ${returnedOn}.

We appreciate your business.

Thank you for choosing M.B.S CENTRING WORKS, Nereducherla.`;
}

/** Absolute link to the printable receipt page for a rental. */
export function receiptUrl(id: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/receipts/${id}`;
}

/** WhatsApp message that hands the customer a link to their printable receipt. */
export function buildReceiptMessage(r: Rental) {
  return `Hello ${r.customer_name},

Here is your receipt from M.B.S CENTRING WORKS, Nereducherla for ${r.material_name} (Qty: ${r.quantity} ${r.unit}):

${receiptUrl(r.id)}

Thank you.`;
}

/** Same as buildReceiptMessage, but for a batch of rentals saved together (one link per material). */
export function buildGroupReceiptMessage(rows: Rental[]) {
  if (rows.length === 1) return buildReceiptMessage(rows[0]);
  const first = rows[0];
  const lines = rows.map((r) => `${r.material_name} — ${receiptUrl(r.id)}`).join("\n");
  return `Hello ${first.customer_name},

Here ${rows.length > 1 ? "are your receipts" : "is your receipt"} from M.B.S CENTRING WORKS, Nereducherla:

${lines}

Thank you.`;
}

export function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const num = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}