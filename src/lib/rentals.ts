import { supabase } from "@/integrations/supabase/client";

export interface Rental {
  id: string;
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
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function computeStatus(r: Pick<Rental, "status" | "return_date">): Rental["status"] {
  if (r.status === "returned") return "returned";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ret = new Date(r.return_date);
  return ret < today ? "overdue" : "active";
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

/** A stronger follow-up for material that is still not returned after an earlier notice. */
export function buildNotReturnedMessage(r: Rental) {
  return `Hello ${r.customer_name},

This is a follow-up from M.B.S CENTRING WORKS, Nereducherla.

As per our records, the material ${r.material_name} (Qty: ${r.quantity} ${r.unit}) rented on ${r.issue_date} has still not been returned.

Please arrange to return it immediately or contact us to avoid further charges/action.

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

export function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  const num = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}