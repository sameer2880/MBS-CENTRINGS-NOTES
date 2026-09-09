import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "create_diary_note",
  title: "Create diary note",
  description: "Add a daily diary / notebook entry with an optional amount and category.",
  inputSchema: {
    title: z.string().trim().min(1),
    content: z.string().optional(),
    entry_date: z.string().optional().describe("YYYY-MM-DD, defaults to today."),
    category: z
      .enum(["general", "labour", "expense", "payment", "reminder"])
      .optional()
      .describe("Defaults to 'general'."),
    amount: z.number().optional().describe("Optional money amount for expense/payment notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, content, entry_date, category, amount }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase
      .from("diary_notes")
      .insert({
        title,
        content: content ?? "",
        entry_date: entry_date ?? new Date().toISOString().slice(0, 10),
        category: category ?? "general",
        amount: amount ?? null,
      })
      .select()
      .single();
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: `Created diary note ${data.id}: ${data.title}` }],
      structuredContent: { note: data },
    };
  },
});
