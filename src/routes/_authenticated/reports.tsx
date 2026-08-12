import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRentals } from "@/lib/rentals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

function toCSV(rows: any[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(name: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function Reports() {
  const { data: rentals = [] } = useQuery({ queryKey: ["rentals"], queryFn: listRentals });
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);

  const inRange = useMemo(() => rentals.filter((r) => r.created_at.slice(0, 10) >= from && r.created_at.slice(0, 10) <= to), [rentals, from, to]);

  const groups = {
    daily: rentals.filter((r) => r.created_at.slice(0, 10) === today),
    monthly: inRange,
    pending: rentals.filter((r) => r.status === "active"),
    returned: rentals.filter((r) => r.status === "returned"),
    overdue: rentals.filter((r) => r.status === "overdue"),
  };

  const revenue = inRange.reduce((s, r) => s + Number(r.total_amount), 0);

  const exportRows = (rows: any[], name: string) => {
    const cleaned = rows.map((r) => ({
      customer_name: r.customer_name, mobile: r.customer_phone, village: r.customer_address,
      material: r.material_name, quantity: r.quantity, unit: r.unit, rate: r.rate_per_unit,
      total: r.total_amount, issue_date: r.issue_date, return_date: r.return_date, status: r.status,
    }));
    download(`${name}.csv`, toCSV(cleaned));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-sm text-muted-foreground">Analyse rentals, revenue and outstanding materials</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="ml-auto rounded-lg bg-primary/10 px-4 py-2">
            <div className="text-[11px] font-semibold uppercase text-primary">Revenue in range</div>
            <div className="text-xl font-bold">₹{revenue.toLocaleString("en-IN")}</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="daily">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="daily">Daily ({groups.daily.length})</TabsTrigger>
          <TabsTrigger value="monthly">In Range ({groups.monthly.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({groups.pending.length})</TabsTrigger>
          <TabsTrigger value="returned">Returned ({groups.returned.length})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({groups.overdue.length})</TabsTrigger>
        </TabsList>
        {(Object.keys(groups) as (keyof typeof groups)[]).map((key) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="capitalize text-base">{key} Report</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exportRows(groups[key], `mbs-${key}-report`)}>
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1.5" /> Print
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Return</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups[key].length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No records</TableCell></TableRow>}
                    {groups[key].map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.customer_name}</TableCell>
                        <TableCell>{r.customer_phone}</TableCell>
                        <TableCell>{r.material_name}</TableCell>
                        <TableCell className="text-right">{r.quantity} {r.unit}</TableCell>
                        <TableCell className="text-right font-semibold">₹{Number(r.total_amount).toLocaleString("en-IN")}</TableCell>
                        <TableCell>{r.issue_date}</TableCell>
                        <TableCell>{r.return_date}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
