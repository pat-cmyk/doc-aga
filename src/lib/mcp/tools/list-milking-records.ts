import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "list_milking_records",
  title: "List milking records",
  description:
    "List milk production records for a farm within a date range (YYYY-MM-DD), newest first.",
  inputSchema: {
    farm_id: z.string().describe("Farm UUID from list_farms."),
    start_date: z.string().optional().describe("Inclusive start date, YYYY-MM-DD."),
    end_date: z.string().optional().describe("Inclusive end date, YYYY-MM-DD."),
    limit: z.number().optional().describe("Max rows to return. Defaults to 100."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ farm_id, start_date, end_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: animals, error: animalsError } = await supabase
      .from("animals")
      .select("id, name, ear_tag")
      .eq("farm_id", farm_id)
      .eq("is_deleted", false);

    if (animalsError)
      return { content: [{ type: "text", text: animalsError.message }], isError: true };

    const ids = (animals ?? []).map((a) => a.id);
    if (ids.length === 0)
      return {
        content: [{ type: "text", text: "No animals on this farm." }],
        structuredContent: { records: [], total_liters: 0 },
      };

    let query = supabase
      .from("milking_records")
      .select("id, animal_id, record_date, session, liters, milk_quality, is_sold, sale_amount")
      .in("animal_id", ids)
      .order("record_date", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 100, 1), 500));

    if (start_date) query = query.gte("record_date", start_date);
    if (end_date) query = query.lte("record_date", end_date);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const nameById = new Map((animals ?? []).map((a) => [a.id, a.name ?? a.ear_tag ?? a.id]));
    const records = (data ?? []).map((r) => ({ ...r, animal: nameById.get(r.animal_id) }));
    const totalLiters = records.reduce((sum, r) => sum + Number(r.liters ?? 0), 0);

    return {
      content: [{ type: "text", text: JSON.stringify({ total_liters: totalLiters, records }, null, 2) }],
      structuredContent: { records, total_liters: totalLiters },
    };
  },
});
