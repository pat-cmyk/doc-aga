import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "list_animals",
  title: "List animals",
  description:
    "List animals on a farm. Active animals only by default (not deleted, no exit date). Use list_farms first to get a farm id.",
  inputSchema: {
    farm_id: z.string().describe("Farm UUID from list_farms."),
    include_inactive: z
      .boolean()
      .optional()
      .describe("Include sold/dead/exited animals. Defaults to false."),
    limit: z.number().optional().describe("Max rows to return. Defaults to 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ farm_id, include_inactive, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("animals")
      .select(
        "id, name, ear_tag, breed, gender, birth_date, life_stage, current_weight_kg, is_currently_lactating, exit_date, exit_reason",
      )
      .eq("farm_id", farm_id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 100, 1), 500));

    if (!include_inactive) query = query.is("exit_date", null);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { animals: data ?? [], count: data?.length ?? 0 },
    };
  },
});
