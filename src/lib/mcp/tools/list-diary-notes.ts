import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_diary_notes",
  title: "List diary notes",
  description: "List diary / notebook entries, newest date first. Filter by category, date range or text search.",
  inputSchema: {
    category: z
      .enum(["general", "labour", "expense", "payment", "reminder"])
      .optional()
      .describe("Filter by note category."),
    from_date: z.string().optional().describe("Earliest entry_date, YYYY-MM-DD."),
    to_date: z.string().optional().describe("Latest entry_date, YYYY-MM-DD."),
    search: z.string().optional().describe("Case-insensitive match on title or content."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category, from_date, to_date, search, limit }) => {
    const supabase = supabaseAnon();
    let query = supabase
      .from("diary_notes")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(limit ?? 25);

    if (category) query = query.eq("category", category);
    if (from_date) query = query.gte("entry_date", from_date);
    if (to_date) query = query.lte("entry_date", to_date);
    if (search) {
      const s = `%${search}%`;
      query = query.or(`title.ilike.${s},content.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { notes: data ?? [] },
    };
  },
});
