import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { downloadCsv } from "@/lib/export";
import type { Worker } from "./index";

export const Route = createFileRoute("/_authenticated/labour/$id")({
  head: () => ({
    meta: [
      { title: "Worker Attendance & Payments — M.B.S Centring Works" },
      { name: "description", content: "Day by day attendance calendar and payment history for a worker at M.B.S Centring Works." },
      { property: "og:title", content: "Worker Attendance & Payments — M.B.S Centring Works" },
      { property: "og:description", content: "Attendance calendar and payment history for a worker." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const { id } = Route.useParams();
    return <WorkerOverview id={id} />;
  },
  errorComponent: ({ error }) => <div role="alert" className="p-4">{error.message}</div>,
  notFoundComponent: () => <div className="p-4">Worker not found.</div>,
});

type AttStatus = "present" | "absent" | "holiday";
type DayType = "full" | "half" | "ot";
type Attendance = { id: string; work_date: string; present: boolean; status: AttStatus; day_type: DayType; note: string | null };
type Payment = { id: string; amount: number; note: string | null; paid_at: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function localDateTimeValue(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function dayStart(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const STATUS_LABEL: Record<AttStatus, string> = { present: "Present", absent: "Absent", holiday: "Holiday" };
const DAY_TYPE_LABEL: Record<DayType, string> = { full: "Full day", half: "Half day", ot: "Overtime (OT)" };
const DAY_TYPE_SHORT: Record<DayType, string> = { full: "", half: "½", ot: "OT" };
const DAY_TYPE_FACTOR: Record<DayType, number> = { full: 1, half: 0.5, ot: 0.25 };


export function WorkerOverview({ id, readOnly = false }: { id: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [dayOpen, setDayOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(ymd(new Date()));
  const [dayNote, setDayNote] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [editingPay, setEditingPay] = useState<Payment | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", note: "", paid_at: localDateTimeValue(new Date()) });

  const { data: worker } = useQuery({
    queryKey: ["worker", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Worker;
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["worker_attendance", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("worker_attendance").select("*").eq("worker_id", id);
      if (error) throw error;
      return data as unknown as Attendance[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["worker_payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("worker_payments")
        .select("*")
        .eq("worker_id", id)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const attMap = useMemo(() => {
    const m = new Map<string, Attendance>();
    attendance.forEach((a) => m.set(a.work_date, a));
    return m;
  }, [attendance]);

  const setStatus = useMutation({
    mutationFn: async ({
      date,
      status,
      note,
      dayType,
    }: { date: string; status: AttStatus | null; note: string; dayType?: DayType }) => {
      const existing = attMap.get(date);
      if (status === null) {
        if (existing) {
          const { error } = await supabase.from("worker_attendance").delete().eq("id", existing.id);
          if (error) throw error;
        }
        return;
      }
      const row = {
        worker_id: id,
        work_date: date,
        status,
        present: status === "present",
        day_type: status === "present" ? (dayType ?? existing?.day_type ?? "full") : "full",
        note: note.trim() || null,
      };
      if (existing) {
        const { error } = await supabase.from("worker_attendance").update(row).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("worker_attendance").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker_attendance", id] });
      toast.success("Attendance updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const savePayment = useMutation({
    mutationFn: async () => {
      const amount = Number(payForm.amount);
      if (!amount) throw new Error("Enter an amount");
      const row = {
        worker_id: id,
        amount,
        note: payForm.note.trim() || null,
        paid_at: new Date(payForm.paid_at).toISOString(),
      };
      if (editingPay) {
        const { error } = await supabase.from("worker_payments").update(row).eq("id", editingPay.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("worker_payments").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker_payments", id] });
      toast.success(editingPay ? "Payment updated" : "Payment recorded");
      setPayOpen(false);
      setEditingPay(null);
      setPayForm({ amount: "", note: "", paid_at: localDateTimeValue(new Date()) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delPayment = useMutation({
    mutationFn: async (pid: string) => {
      const { error } = await supabase.from("worker_payments").delete().eq("id", pid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker_payments", id] });
      toast.success("Payment removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = ymd(new Date());

  const monthKeys = Array.from({ length: daysInMonth }, (_, i) => ymd(new Date(year, month, i + 1)));
  const statusOf = (k: string) => attMap.get(k)?.status;
  const presentDays = monthKeys.filter((k) => statusOf(k) === "present").length;
  const absentDays = monthKeys.filter((k) => statusOf(k) === "absent").length;
  const holidayDays = monthKeys.filter((k) => statusOf(k) === "holiday").length;
  const halfDays = monthKeys.filter((k) => statusOf(k) === "present" && attMap.get(k)?.day_type === "half").length;
  const otDays = monthKeys.filter((k) => statusOf(k) === "present" && attMap.get(k)?.day_type === "ot").length;
  const workUnits = monthKeys.reduce(
    (s, k) => (statusOf(k) === "present" ? s + DAY_TYPE_FACTOR[attMap.get(k)?.day_type ?? "full"] : s),
    0,
  );

  const monthPayments = payments.filter((p) => {
    const d = new Date(p.paid_at);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const monthPaid = monthPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const earned = workUnits * Number(worker?.daily_wage ?? 0);

  const exportData = () => {
    const rows = [
      ...attendance
        .slice()
        .sort((a, b) => a.work_date.localeCompare(b.work_date))
        .map((a) => ({
          Type: "Attendance",
          Date: a.work_date,
          Status: STATUS_LABEL[a.status],
          "Day type": a.status === "present" ? DAY_TYPE_LABEL[a.day_type ?? "full"] : "",
          Amount: "",
          Note: a.note ?? "",
        })),
      ...payments.map((p) => ({
        Type: "Payment",
        Date: new Date(p.paid_at).toLocaleString("en-IN"),
        Status: "",
        "Day type": "",
        Amount: Number(p.amount),
        Note: p.note ?? "",
      })),
    ];
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    downloadCsv(`${(worker?.name ?? "worker").replace(/\s+/g, "-").toLowerCase()}-records`, rows);
    toast.success("Exported CSV");
  };


  const dayPayments = payments.filter((p) => ymd(new Date(p.paid_at)) === selectedDate);
  const dayAtt = attMap.get(selectedDate);

  const openDay = (date: string) => {
    setSelectedDate(date);
    setDayNote(attMap.get(date)?.note ?? "");
    setDayOpen(true);
  };

  const openPayment = (p: Payment | null, dateStr?: string) => {
    setEditingPay(p);
    setPayForm(
      p
        ? { amount: String(p.amount), note: p.note ?? "", paid_at: localDateTimeValue(new Date(p.paid_at)) }
        : {
            amount: "",
            note: "",
            paid_at: localDateTimeValue(dateStr ? new Date(dayStart(dateStr).setHours(10, 0, 0, 0)) : new Date()),
          },
    );
    setPayOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/labour">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold">{worker?.name ?? "Worker"}</h2>
          <p className="text-sm text-muted-foreground">
            {worker?.phone ? `${worker.phone} · ` : ""}₹{Number(worker?.daily_wage ?? 0).toLocaleString("en-IN")}/day
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportData}>
          <Download className="h-4 w-4 mr-1.5" /> Export
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Present this month", value: `${presentDays} days`, tone: "text-success" },
          { label: "Absent / Holiday", value: `${absentDays} / ${holidayDays} days`, tone: "text-destructive" },
          { label: "Wage earned (month)", value: `₹${earned.toLocaleString("en-IN")}`, tone: "text-primary" },
          { label: "Paid (month / total)", value: `₹${monthPaid.toLocaleString("en-IN")} / ₹${totalPaid.toLocaleString("en-IN")}`, tone: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={cn("text-lg font-bold", s.tone)}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-bold text-primary">
              {cursor.toLocaleString("en-IN", { month: "long", year: "numeric" })}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
            {DAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const date = ymd(new Date(year, month, i + 1));
              const st = statusOf(date);
              const dt = attMap.get(date)?.day_type ?? "full";
              const isToday = date === todayStr;
              const hasPay = payments.some((p) => ymd(new Date(p.paid_at)) === date);
              return (
                <button
                  key={date}
                  onClick={readOnly ? undefined : () => openDay(date)}
                  disabled={readOnly}
                  title={st ? `${STATUS_LABEL[st]}${st === "present" ? ` · ${DAY_TYPE_LABEL[dt]}` : ""}` : "No record — tap to set"}
                  className={cn(
                    "relative aspect-square rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    !st && "text-muted-foreground hover:bg-muted",
                    st === "present" && "bg-success/15 text-success hover:bg-success/25",
                    st === "absent" && "bg-destructive/15 text-destructive hover:bg-destructive/25",
                    st === "holiday" && "bg-muted text-muted-foreground hover:bg-muted/80",
                    isToday && !st && "bg-primary text-primary-foreground hover:bg-primary/90",
                    isToday && st && "ring-2 ring-primary",
                  )}
                >
                  {i + 1}
                  {st === "present" && DAY_TYPE_SHORT[dt] && (
                    <span className="absolute top-0.5 right-0.5 text-[9px] font-bold leading-none text-primary">
                      {DAY_TYPE_SHORT[dt]}
                    </span>
                  )}
                  {hasPay && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-success/25" /> Present</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-destructive/25" /> Absent</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-muted" /> Holiday</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Payment on that day</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Money given
            </h3>
          </div>

          {payments.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No payments recorded yet.</p>}
          <div className="divide-y divide-border">
            {payments.map((p) => (
              <div key={p.id} className="flex items-start gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-primary">₹{Number(p.amount).toLocaleString("en-IN")}</div>
                  {p.note && <div className="text-sm text-muted-foreground break-words">{p.note}</div>}
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(p.paid_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                {!readOnly && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => openPayment(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDelete
                      onConfirm={() => delPayment.mutate(p.id)}
                      title="Delete this payment?"
                      description="This payment record will be permanently removed."
                    />
                  </>
                )}

              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!readOnly && <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dayStart(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Attendance</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["present", "absent", "holiday"] as AttStatus[]).map((s) => (
                  <Button
                    key={s}
                    variant={dayAtt?.status === s ? "default" : "outline"}
                    onClick={() => setStatus.mutate({ date: selectedDate, status: s, note: dayNote })}
                    disabled={setStatus.isPending}
                  >
                    {STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>

              {dayAtt?.status === "present" && (
                <div className="space-y-2 pt-1">
                  <Label className="text-xs text-muted-foreground">How long did he work?</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["full", "half", "ot"] as DayType[]).map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant={(dayAtt.day_type ?? "full") === d ? "default" : "outline"}
                        onClick={() =>
                          setStatus.mutate({ date: selectedDate, status: "present", note: dayNote, dayType: d })
                        }
                        disabled={setStatus.isPending}
                      >
                        {d === "ot" ? "OT" : d === "half" ? "Half day" : "Full day"}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <ConfirmDelete
                onConfirm={() => setStatus.mutate({ date: selectedDate, status: null, note: "" })}
                title="Clear attendance for this day?"
                description="The attendance mark and its note for this day will be removed. Payments are not affected."
                confirmLabel="Clear"
              >
                <Button variant="outline" size="sm" className="text-destructive w-full" disabled={!dayAtt}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Clear attendance
                </Button>
              </ConfirmDelete>
            </div>


            <div>
              <Label>Day note</Label>
              <Textarea rows={2} value={dayNote} onChange={(e) => setDayNote(e.target.value)} placeholder="Optional note for this day" />
              {dayAtt && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setStatus.mutate({ date: selectedDate, status: dayAtt.status, note: dayNote })}
                >
                  Save note
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Payments on this day</Label>
                <Button size="sm" variant="outline" onClick={() => openPayment(null, selectedDate)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add
                </Button>
              </div>
              {dayPayments.length === 0 && <p className="text-sm text-muted-foreground">No payments on this day.</p>}
              <div className="divide-y divide-border">
                {dayPayments.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-primary">₹{Number(p.amount).toLocaleString("en-IN")}</div>
                      {p.note && <div className="text-sm text-muted-foreground break-words">{p.note}</div>}
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(p.paid_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openPayment(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDelete
                      onConfirm={() => delPayment.mutate(p.id)}
                      title="Delete this payment?"
                      description="This payment record will be permanently removed."
                    />

                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDayOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      {/* Payment form */}
      {!readOnly && <Dialog open={payOpen} onOpenChange={(o) => { setPayOpen(o); if (!o) setEditingPay(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPay ? "Edit payment" : "Add payment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>Date &amp; time</Label>
              <Input type="datetime-local" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea rows={2} value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} placeholder="Advance, weekly wage, etc." />
            </div>
            <p className="text-xs text-muted-foreground">Payments do not change attendance — set attendance from the calendar day.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={() => savePayment.mutate()} disabled={savePayment.isPending}>
              {savePayment.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
