import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Rental } from "@/lib/rentals";
import { buildConfirmMessage, buildGroupConfirmMessage, buildGroupReceiptMessage, whatsappUrl } from "@/lib/rentals";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

import { MessageCircle, Plus, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: Rental | null;

}

type Item = {
  material_name: string;
  quantity: number | string;
  unit: string;
  rate_per_unit: number | string;
};

const emptyItem = (): Item => ({ material_name: "", quantity: 1, unit: "pcs", rate_per_unit: 0 });

const MOBILE_REGEX = /^[6789]\d{9}$/;

const emptyForm = () => ({
  customer_name: "",
  customer_phone: "",
  customer_address: "Nereducherla",
  security_deposit: 0 as number | string,
  issue_date: new Date().toISOString().slice(0, 10),
  return_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  status: "active" as "active" | "returned",
  payment_status: "unpaid" as "paid" | "unpaid",
  notes: "",
  items: [emptyItem()] as Item[],
});

export function RentalForm({ open, onOpenChange, editing }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm());


  useEffect(() => {
    if (editing) {
      setForm({
        customer_name: editing.customer_name,
        customer_phone: editing.customer_phone,
        customer_address: editing.customer_address ?? "",
        security_deposit: editing.security_deposit ?? 0,
        issue_date: editing.issue_date,
        return_date: editing.return_date,
        status: editing.status === "overdue" ? "active" : (editing.status as "active" | "returned"),
        payment_status: editing.payment_status ?? "unpaid",
        notes: editing.notes ?? "",
        items: [{
          material_name: editing.material_name,
          quantity: editing.quantity,
          unit: editing.unit,
          rate_per_unit: editing.rate_per_unit,
        }],
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, open]);


  const itemTotal = (it: Item) => Number(it.quantity || 0) * Number(it.rate_per_unit || 0);
  const grandTotal = form.items.reduce((s, it) => s + itemTotal(it), 0);
  const balanceDue = grandTotal - Number(form.security_deposit || 0);

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx: number) =>
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items }));

  const save = useMutation({
    mutationFn: async () => {
      if (!MOBILE_REGEX.test(form.customer_phone)) throw new Error("Mobile number must be 10 digits and start with 6, 7, 8 or 9");
      if (!form.customer_name) throw new Error("Customer name is required");
      if (form.items.some((it) => !it.material_name)) throw new Error("Every material row needs a name");

      if (editing) {
        const it = form.items[0];
        const payload = {
          customer_name: form.customer_name,
          customer_phone: form.customer_phone,
          customer_address: form.customer_address,
          material_name: it.material_name,
          quantity: Number(it.quantity),
          unit: it.unit,
          rate_per_unit: Number(it.rate_per_unit),
          total_amount: itemTotal(it),
          security_deposit: Number(form.security_deposit || 0),
          issue_date: form.issue_date,
          return_date: form.return_date,
          status: form.status,
          payment_status: form.payment_status,
          notes: form.notes,
        };
        const { data, error } = await supabase.from("rentals").update(payload).eq("id", editing.id).select().single();
        if (error) throw error;
        const results: Rental[] = [data as Rental];

        // Any extra material rows added while editing are saved as new rentals
        const extraItems = form.items.slice(1);
        if (extraItems.length > 0) {
          const extraRows = extraItems.map((extra) => ({
            customer_name: form.customer_name,
            customer_phone: form.customer_phone,
            customer_address: form.customer_address,
            material_name: extra.material_name,
            quantity: Number(extra.quantity),
            unit: extra.unit,
            rate_per_unit: Number(extra.rate_per_unit),
            total_amount: itemTotal(extra),
            security_deposit: 0,
            issue_date: form.issue_date,
            return_date: form.return_date,
            status: form.status,
            payment_status: form.payment_status,
            notes: form.notes,
          }));
          const { data: extraData, error: extraError } = await supabase.from("rentals").insert(extraRows).select();
          if (extraError) throw extraError;
          results.push(...(extraData as Rental[]));
        }
        return results;
      }

      // Split security deposit only on the first row to avoid double counting
      const rows = form.items.map((it, idx) => ({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address,
        material_name: it.material_name,
        quantity: Number(it.quantity),
        unit: it.unit,
        rate_per_unit: Number(it.rate_per_unit),
        total_amount: itemTotal(it),
        security_deposit: idx === 0 ? Number(form.security_deposit || 0) : 0,
        issue_date: form.issue_date,
        return_date: form.return_date,
        status: form.status,
        payment_status: form.payment_status,
        notes: form.notes,
      }));
      const { data, error } = await supabase.from("rentals").insert(rows).select();
      if (error) throw error;
      return data as Rental[];
    },
    onSuccess: (rows) => {
      qc.invalidateQueries({ queryKey: ["rentals"] });
      const first = rows[0];
      const message = rows.length > 1 ? buildGroupConfirmMessage(rows) : buildConfirmMessage(first);
      const link = first ? whatsappUrl(first.customer_phone, message) : null;
      const receiptMessage = buildGroupReceiptMessage(rows);
      const receiptLink = first ? whatsappUrl(first.customer_phone, receiptMessage) : null;

      toast.success(
        editing
          ? rows.length > 1
            ? `Rental updated · ${rows.length} materials`
            : "Rental updated"
          : `Saved ${rows.length} material${rows.length > 1 ? "s" : ""}`,
        {
          action: link
            ? { label: "Send WhatsApp", onClick: () => window.open(link, "_blank") }
            : undefined,
          cancel: receiptLink
            ? { label: "Send Receipt", onClick: () => window.open(receiptLink, "_blank") }
            : undefined,
        },
      );
      onOpenChange(false);
    },

    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Rental" : "New Rental"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer Name *">
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required />
            </Field>
            <Field label="Mobile Number *">
              <Input
                maxLength={10}
                inputMode="numeric"
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                required
              />
              {form.customer_phone.length > 0 && !MOBILE_REGEX.test(form.customer_phone) && (
                <p className="text-xs text-destructive">Must be 10 digits, starting with 6, 7, 8 or 9</p>
              )}
            </Field>
          </div>
          <Field label="Village / Address">
            <Input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
          </Field>

          <div className="space-y-3">
            <Label>Materials</Label>
            {form.items.map((it, idx) => (
              <div key={idx} className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Material #{idx + 1}</span>
                  {form.items.length > 1 && (!editing || idx > 0) && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(idx)} className="h-7 text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Material Name *">
                    <Input value={it.material_name} onChange={(e) => updateItem(idx, { material_name: e.target.value })} required />
                  </Field>
                  <Field label="Unit">
                    <Input value={it.unit} onChange={(e) => updateItem(idx, { unit: e.target.value })} placeholder="pcs, kg, bag" />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Quantity *">
                    <Input type="number" min="0" step="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
                  </Field>
                  <Field label="Rate / Unit ₹ *">
                    <Input type="number" min="0" step="0.01" value={it.rate_per_unit} onChange={(e) => updateItem(idx, { rate_per_unit: e.target.value })} />
                  </Field>
                  <div className="flex flex-col justify-end">
                    <div className="text-xs text-muted-foreground">Line total</div>
                    <div className="text-lg font-semibold">₹{itemTotal(it).toLocaleString("en-IN")}</div>
                  </div>
                </div>
              </div>
            ))}
            {(!editing || form.items.length > 1) && (
              <p className="text-[11px] text-muted-foreground">
                {editing ? "Extra materials added here are saved as new rentals for this customer." : ""}
              </p>
            )}
            <Button type="button" size="sm" variant="outline" onClick={addItem} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add more
            </Button>
          </div>

          <Field label="Advance Received ₹">
            <Input type="number" min="0" step="0.01" value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: e.target.value })} placeholder="Advance money given by the customer" />
          </Field>

          <div className="rounded-lg bg-primary/10 border-2 border-primary/30 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Materials Total</span>
              <span className="font-medium">₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
            {Number(form.security_deposit || 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Advance Received</span>
                <span className="font-medium text-success">- ₹{Number(form.security_deposit || 0).toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-primary/20 pt-1.5">
              <span className="text-sm font-medium">Balance Due</span>
              <span className="text-2xl font-bold text-primary">₹{balanceDue.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Issue Date *">
              <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} required />
            </Field>
            <Field label="Expected Return Date *">
              <Input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} required />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "returned" })}
              >
                <option value="active">Active</option>
                <option value="returned">Returned</option>
              </select>
            </Field>
            <Field label="Payment">
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.payment_status}
                onChange={(e) => setForm({ ...form, payment_status: e.target.value as "paid" | "unpaid" })}
              >
                <option value="unpaid">Not Paid</option>
                <option value="paid">Paid</option>
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Update Rental" : "Create Rental"}
            </Button>
          </DialogFooter>
          {!editing && form.customer_phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MessageCircle className="h-3 w-3 text-success" /> "Send WhatsApp" and "Send Receipt" options will be offered after saving — neither opens automatically.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}