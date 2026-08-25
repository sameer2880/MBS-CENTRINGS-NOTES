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