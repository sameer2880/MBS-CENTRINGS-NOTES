import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "create_rental",
  title: "Create rental",
  description:
    "Record a new material rental (one material per record). Total amount is computed as quantity x rate when not supplied.",
  inputSchema: {
    customer_name: z.string().trim().min(1),
    customer_phone: z.string().trim().min(1),
    customer_address: z.string().optional(),
    material_name: z.string().trim().min(1),
    quantity: z.number().positive(),
    unit: z.string().optional().describe("Unit of measure, default 'pcs'."),
    rate_per_unit: z.number().nonnegative(),
    total_amount: z.number().nonnegative().optional(),
    security_deposit: z.number().nonnegative().optional().describe("Advance amount received from the customer."),
    issue_date: z.string().describe("Issue date, YYYY-MM-DD."),
    return_date: z.string().describe("Expected return date, YYYY-MM-DD."),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input) => {
    const supabase = supabaseAnon();
    const row = {
      ...input,
      unit: input.unit ?? "pcs",
      security_deposit: input.security_deposit ?? 0,
      total_amount: input.total_amount ?? input.quantity * input.rate_per_unit,
      status: "active",
    };
    const { data, error } = await supabase.from("rentals").insert(row).select().single();
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: `Created rental ${data.id} for ${data.customer_name}.` }],
      structuredContent: { rental: data },
    };
  },
});