import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_rentals",
  title: "List rentals",
  description:
    "List material rental records, newest first. Optionally filter by status or search customer / material name.",
  inputSchema: {
    status: z.enum(["active", "returned"]).optional().describe("Filter by stored rental status."),
    search: z.string().optional().describe("Case-insensitive match on customer name, phone or material name."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }) => {
    const supabase = supabaseAnon();
    let query = supabase
      .from("rentals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);

    if (status) query = query.eq("status", status);
    if (search) {
      const s = `%${search}%`;
      query = query.or(
        `customer_name.ilike.${s},customer_phone.ilike.${s},material_name.ilike.${s}`,
      );
    }

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { rentals: data ?? [] },
    };
  },
});
