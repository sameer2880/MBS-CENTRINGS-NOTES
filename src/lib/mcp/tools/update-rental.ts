import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "update_rental",
  title: "Update rental",
  description:
    "Update an existing rental record — mark it returned/active, change the return date, amount or notes.",
  inputSchema: {
    id: z.string().uuid().describe("Rental record id."),
    status: z.enum(["active", "returned"]).optional(),
    return_date: z.string().optional().describe("YYYY-MM-DD."),
    quantity: z.number().positive().optional(),
    rate_per_unit: z.number().nonnegative().optional(),
    total_amount: z.number().nonnegative().optional(),
    security_deposit: z.number().nonnegative().optional().describe("Advance amount received from the customer."),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, ...patch }) => {
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length === 0) throw new ToolError("Provide at least one field to update.");

    const supabase = supabaseAnon();
    const { data, error } = await supabase
      .from("rentals")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError(`No rental found with id ${id}`);

    return {
      content: [{ type: "text", text: `Updated rental ${id}.` }],
      structuredContent: { rental: data },
    };
  },
});