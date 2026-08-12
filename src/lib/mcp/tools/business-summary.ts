import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "business_summary",
  title: "Business summary",
  description:
    "Summarise rentals: totals, active vs returned counts, overdue rentals and revenue over an optional date range.",
  inputSchema: {
    from_date: z.string().optional().describe("Earliest issue_date, YYYY-MM-DD."),
    to_date: z.string().optional().describe("Latest issue_date, YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date }) => {
    const supabase = supabaseAnon();
    let query = supabase.from("rentals").select("*");
    if (from_date) query = query.gte("issue_date", from_date);
    if (to_date) query = query.lte("issue_date", to_date);

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const rows = data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const summary = {
      total_rentals: rows.length,
      active: rows.filter((r) => r.status !== "returned" && r.return_date >= today).length,
      overdue: rows.filter((r) => r.status !== "returned" && r.return_date < today).length,
      returned: rows.filter((r) => r.status === "returned").length,
      total_revenue: rows.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0),
      total_deposits: rows.reduce((sum, r) => sum + Number(r.security_deposit ?? 0), 0),
      overdue_rentals: rows
        .filter((r) => r.status !== "returned" && r.return_date < today)
        .map((r) => ({
          id: r.id,
          customer_name: r.customer_name,
          customer_phone: r.customer_phone,
          material_name: r.material_name,
          return_date: r.return_date,
          total_amount: r.total_amount,
        })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
