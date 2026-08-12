import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listRentals } from "@/lib/rentals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Package, CheckCircle2, Clock, AlertTriangle, TrendingUp, IndianRupee } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: rentals = [], isLoading } = useQuery({ queryKey: ["rentals"], queryFn: listRentals });

  const today = new Date().toISOString().slice(0, 10);
  const active = rentals.filter((r) => r.status === "active");
  const overdue = rentals.filter((r) => r.status === "overdue");
  const returned = rentals.filter((r) => r.status === "returned");
  const dueToday = rentals.filter((r) => r.return_date === today && r.status !== "returned");
  const totalRevenue = rentals.reduce((s, r) => s + Number(r.total_amount), 0);
  const thisMonth = new Date(); thisMonth.setDate(1);
  const monthlyRevenue = rentals
    .filter((r) => new Date(r.created_at) >= thisMonth)
    .reduce((s, r) => s + Number(r.total_amount), 0);

  // charts
  const last6 = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
    return { key: d.toLocaleString("en", { month: "short" }), y: d.getFullYear(), m: d.getMonth() };
  });
  const monthly = last6.map(({ key, y, m }) => {
    const rows = rentals.filter((r) => {
      const d = new Date(r.created_at);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    return {
      month: key,
      revenue: rows.reduce((s, r) => s + Number(r.total_amount), 0),
      rentals: rows.length,
    };
  });
  const statusData = [
    { name: "Active", value: active.length, color: "var(--chart-1)" },
    { name: "Returned", value: returned.length, color: "var(--success)" },
    { name: "Overdue", value: overdue.length, color: "var(--destructive)" },
  ];

  const recent = rentals.slice(0, 8);

  const stats = [
    { label: "Active Rentals", value: active.length, icon: Package, tone: "bg-primary/10 text-primary" },
    { label: "Returned", value: returned.length, icon: CheckCircle2, tone: "bg-success/10 text-success" },
    { label: "Due Today", value: dueToday.length, icon: Clock, tone: "bg-warning/15 text-warning" },
    { label: "Overdue", value: overdue.length, icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
    { label: "Monthly Revenue", value: `₹${monthlyRevenue.toLocaleString("en-IN")}`, icon: TrendingUp, tone: "bg-chart-2/15 text-chart-2" },
    { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, tone: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Overview of rentals at M.B.S Centring Works, Nereducherla</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
                  <p className="text-xl font-bold mt-1 truncate">{s.value}</p>
                </div>
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.tone}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Monthly Revenue</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString("en-IN")}`} />
                <Bar dataKey="revenue" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Rental Status</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {statusData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Rentals</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="rentals" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Transactions</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
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
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && recent.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No rentals yet. Create your first one from the Rentals page.</TableCell></TableRow>
              )}
              {recent.map((r) => (
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
    </div>
  );
}
