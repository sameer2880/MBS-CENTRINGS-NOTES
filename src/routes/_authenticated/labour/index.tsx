import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HardHat,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  UserCog,
  CalendarCheck,
  Sun,
  Check,
  X,
} from "lucide-react";
import { downloadCsv } from "@/lib/export";
import { toast } from "sonner";
import { getRole, getVisibleNotes } from "@/lib/user-role";
import { AdminOnly } from "@/components/AdminOnly";
import { isMasterAdmin } from "@/lib/access";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/labour/")({
  head: () => ({
    meta: [
      { title: "Labour Charges — M.B.S Centring Works" },
      { name: "description", content: "Day by day labour attendance and worker payment records for M.B.S Centring Works." },
      { property: "og:title", content: "Labour Charges — M.B.S Centring Works" },
      { property: "og:description", content: "Track worker attendance and daily payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LabourList,
});

export type Worker = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  password: string | null;
  must_set_password: boolean;
  daily_wage: number;
  active: boolean;
  notes: string | null;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/*  Attendance helpers (used by the "Mark Attendance" dialog)          */
/* ------------------------------------------------------------------ */

type AttStatus = "present" | "absent" | "holiday";
type DayType = "full" | "half" | "ot";
type AttRow = {
  id: string;
  worker_id: string;
  work_date: string;
  status: AttStatus;
  day_type: DayType;
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const dayStart = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Fetches every attendance row of one month (pages past the 1000-row API limit). */
async function fetchMonthAttendance(start: string, end: string): Promise<AttRow[]> {
  const PAGE = 1000;
  const rows: AttRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("worker_attendance")
      .select("id, worker_id, work_date, status, day_type")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date")
      .order("worker_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as AttRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/*  Mark Attendance dialog                                             */
/* ------------------------------------------------------------------ */

function MarkAttendanceDialog({
  workers,
  open,
  onOpenChange,
}: {
  workers: Worker[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const todayStr = ymd(new Date());
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = ymd(new Date(year, month, 1));
  const monthEnd = ymd(new Date(year, month + 1, 0));

  const { data: rows = [] } = useQuery({
    queryKey: ["all_attendance", monthStart],
    queryFn: () => fetchMonthAttendance(monthStart, monthEnd),
    enabled: open,
  });

  // date -> (workerId -> attendance row), only for the workers in this list
  const byDate = useMemo(() => {
    const ids = new Set(workers.map((w) => w.id));
    const m = new Map<string, Map<string, AttRow>>();
    rows.forEach((r) => {
      if (!ids.has(r.worker_id)) return;
      if (!m.has(r.work_date)) m.set(r.work_date, new Map());
      m.get(r.work_date)!.set(r.worker_id, r);
    });
    return m;
  }, [rows, workers]);

  const isHolidayForAll = (date: string) =>
    workers.length > 0 &&
    workers.every((w) => byDate.get(date)?.get(w.id)?.status === "holiday");

  const dayMap = byDate.get(selectedDate);
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let holiday = 0;
    workers.forEach((w) => {
      const st = dayMap?.get(w.id)?.status;
      if (st === "present") present++;
      else if (st === "absent") absent++;
      else if (st === "holiday") holiday++;
    });
    return { present, absent, holiday, unmarked: workers.length - present - absent - holiday };
  }, [workers, dayMap]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["all_attendance"] });
    qc.invalidateQueries({ queryKey: ["worker_attendance"] }); // per-worker pages
  };

  const save = useMutation({
    mutationFn: async (
      items: { worker_id: string; status: AttStatus; day_type?: DayType }[],
    ) => {
      if (items.length === 0) return;
      const payload = items.map((i) => ({
        worker_id: i.worker_id,
        work_date: selectedDate,
        status: i.status,
        present: i.status === "present",
        day_type: i.status === "present" ? (i.day_type ?? "full") : "full",
      }));
      const { error } = await supabase
        .from("worker_attendance")
        .upsert(payload, { onConflict: "worker_id,work_date" });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: async ({ workerIds, holidayOnly }: { workerIds: string[]; holidayOnly?: boolean }) => {
      if (workerIds.length === 0) return;
      let q = supabase
        .from("worker_attendance")
        .delete()
        .eq("work_date", selectedDate)
        .in("worker_id", workerIds);
      if (holidayOnly) q = q.eq("status", "holiday");
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const holidayAll = isHolidayForAll(selectedDate);
  const busy = save.isPending || clear.isPending;

  const toggleHoliday = () => {
    if (workers.length === 0) return;
    if (holidayAll) {
      clear.mutate(
        { workerIds: workers.map((w) => w.id), holidayOnly: true },
        { onSuccess: () => toast.success("Holiday removed for all workers") },
      );
      return;
    }
    const alreadyMarked = workers.filter((w) => {
      const st = dayMap?.get(w.id)?.status;
      return st === "present" || st === "absent";
    }).length;
    if (
      alreadyMarked > 0 &&
      !window.confirm(
        `${alreadyMarked} worker(s) already have present/absent marked on this date. Mark it as a holiday for everyone and replace those?`,
      )
    ) {
      return;
    }
    save.mutate(
      workers.map((w) => ({ worker_id: w.id, status: "holiday" as AttStatus })),
      { onSuccess: () => toast.success("Marked as holiday for all workers") },
    );
  };

  const markUnmarkedPresent = () => {
    const targets = workers.filter((w) => !dayMap?.get(w.id));
    if (targets.length === 0) return toast.info("Everyone is already marked");
    save.mutate(
      targets.map((w) => ({ worker_id: w.id, status: "present" as AttStatus, day_type: "full" as DayType })),
      { onSuccess: () => toast.success(`${targets.length} worker(s) marked present`) },
    );
  };

  const changeMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setCursor(next);
    const now = new Date();
    const sameAsToday = next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth();
    setSelectedDate(sameAsToday ? todayStr : ymd(next));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader className="border-b border-border pb-3 pr-8">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            <CalendarCheck className="h-5 w-5 text-primary" /> Mark Attendance
          </DialogTitle>
          <DialogDescription>
            Pick a date, then mark every worker in one place. Holiday applies to all workers.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[minmax(0,330px)_minmax(0,1fr)] md:items-start">
          {/* ---------------- Calendar ---------------- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {cursor.toLocaleString("en-IN", { month: "long", year: "numeric" })}
              </h3>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => changeMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next month" onClick={() => changeMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {WEEK_DAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e${i}`} className="aspect-square rounded-lg bg-muted/20" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const date = ymd(new Date(year, month, i + 1));
                const holiday = isHolidayForAll(date);
                const marked = (byDate.get(date)?.size ?? 0) > 0;
                const isSel = date === selectedDate;
                const isToday = date === todayStr;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    title={holiday ? "Holiday" : marked ? "Attendance marked" : "Not marked"}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold transition-all hover:bg-muted/60 active:scale-95",
                      holiday && "border-warning/40 bg-warning/20 text-warning font-bold hover:bg-warning/30",
                      isToday && !isSel && "border-primary/60 text-primary",
                      isSel && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {i + 1}
                    {marked && !holiday && (
                      <span
                        className={cn(
                          "absolute bottom-1 h-1.5 w-1.5 rounded-full",
                          isSel ? "bg-primary-foreground" : "bg-success",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-warning/40 bg-warning/30" /> Holiday (all)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Marked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-primary bg-primary" /> Selected
              </span>
            </div>
          </div>

          {/* ---------------- Workers list ---------------- */}
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-base font-bold">
                  {dayStart(selectedDate).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <div className="text-xs text-muted-foreground">
                  Present {counts.present} · Absent {counts.absent} · Holiday {counts.holiday} · Not marked{" "}
                  {counts.unmarked}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={markUnmarkedPresent}
                  disabled={busy || workers.length === 0 || holidayAll}
                >
                  <Check className="h-4 w-4 mr-1.5" /> All present
                </Button>
                <Button
                  size="sm"
                  variant={holidayAll ? "default" : "outline"}
                  onClick={toggleHoliday}
                  disabled={busy || workers.length === 0}
                >
                  <Sun className="h-4 w-4 mr-1.5" />
                  {holidayAll ? "Remove holiday" : "Mark holiday (all)"}
                </Button>
              </div>
            </div>

            {workers.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No workers yet.</p>
            )}

            <div className="space-y-2 md:max-h-[58vh] md:overflow-y-auto md:pr-1">
              {workers.map((w) => {
                const rec = dayMap?.get(w.id);
                const st = rec?.status;
                const dt = rec?.day_type ?? "full";
                return (
                  <div
                    key={w.id}
                    className={cn(
                      "space-y-2 rounded-lg border border-border p-3",
                      st === "present" && "border-success/30 bg-success/[0.06]",
                      st === "absent" && "border-destructive/30 bg-destructive/[0.06]",
                      st === "holiday" && "border-warning/40 bg-warning/[0.10]",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{w.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {st === "holiday"
                            ? "Holiday"
                            : st === "present"
                              ? `Present · ${dt === "full" ? "Full day" : dt === "half" ? "Half day" : "Overtime (OT)"}`
                              : st === "absent"
                                ? "Absent"
                                : "Not marked"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant={st === "present" ? "default" : "outline"}
                          disabled={busy}
                          onClick={() =>
                            save.mutate([
                              { worker_id: w.id, status: "present", day_type: st === "present" ? dt : "full" },
                            ])
                          }
                        >
                          Present
                        </Button>
                        <Button
                          size="sm"
                          variant={st === "absent" ? "destructive" : "outline"}
                          disabled={busy}
                          onClick={() => save.mutate([{ worker_id: w.id, status: "absent" }])}
                        >
                          Absent
                        </Button>
                        {rec && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label={`Clear ${w.name}`}
                            title="Clear mark"
                            disabled={busy}
                            onClick={() => clear.mutate({ workerIds: [w.id] })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {st === "present" && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["full", "half", "ot"] as DayType[]).map((d) => (
                          <Button
                            key={d}
                            size="sm"
                            variant={dt === d ? "default" : "outline"}
                            disabled={busy}
                            onClick={() => save.mutate([{ worker_id: w.id, status: "present", day_type: d }])}
                          >
                            {d === "full" ? "Full day" : d === "half" ? "Half day" : "OT"}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Labour Charges page                                                */
/* ------------------------------------------------------------------ */

function LabourList() {
  const [q, setQ] = useState("");
  const [markOpen, setMarkOpen] = useState(false);

  // Labour Charges only ever shows "worker" role users. There's no role
  // column — admins are marked with a hidden marker inside `notes` (see
  // @/lib/user-role) — so the split happens client-side after the fetch.
  const { data: workers = [], isLoading } = useQuery({
    queryKey: ["workers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").order("name");
      if (error) throw error;
      return (data as Worker[]).filter((w) => getRole(w.notes) === "worker");
    },
    enabled: isMasterAdmin(),
  });

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    if (!ql) return workers;
    return workers.filter((w) => w.name.toLowerCase().includes(ql) || (w.phone ?? "").includes(ql));
  }, [workers, q]);

  return (
    <AdminOnly label="Labour Charges">
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <HardHat className="h-6 w-6 text-primary" /> Labour Charges
          </h2>
          <p className="text-sm text-muted-foreground">Workers list · open a worker for attendance and payments</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMarkOpen(true)}>
            <CalendarCheck className="h-4 w-4 mr-1.5" /> Mark Attendance
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (workers.length === 0) return toast.error("No workers to export");
              downloadCsv(
                `workers-${new Date().toISOString().slice(0, 10)}`,
                workers.map((w) => ({
                  Name: w.name,
                  Mobile: w.phone ?? "",
                  "Daily wage": w.daily_wage,
                  Notes: getVisibleNotes(w.notes),
                  Added: new Date(w.created_at).toLocaleString("en-IN"),
                })),
              );
              toast.success("Exported CSV");
            }}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
          <Button asChild>
            <Link to="/manage-worker">
              <UserCog className="h-4 w-4 mr-1.5" /> Manage Users
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search worker by name or mobile" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>

          {isLoading && <p className="text-center py-10 text-muted-foreground">Loading…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-center py-10 text-muted-foreground">
              No workers yet.{" "}
              <Link to="/manage-worker" className="text-primary underline underline-offset-2">
                Add your first worker
              </Link>
              .
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((w) => (
              <Link
                key={w.id}
                to="/labour/$id"
                params={{ id: w.id }}
                className="rounded-lg border border-border p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.phone ? `${w.phone} · ` : ""}₹{Number(w.daily_wage).toLocaleString("en-IN")}/day
                    {!w.active && " · Login disabled"}
                  </div>
                  {w.notes && <div className="text-xs text-muted-foreground truncate mt-0.5">{getVisibleNotes(w.notes)}</div>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <MarkAttendanceDialog workers={workers} open={markOpen} onOpenChange={setMarkOpen} />
    </div>
    </AdminOnly>
  );
}