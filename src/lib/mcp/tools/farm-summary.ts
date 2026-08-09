import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default defineTool({
  name: "farm_summary",
  title: "Farm summary",
  description:
    "Herd and production snapshot for a farm: active animal counts by life stage plus milk output over the last N days.",
  inputSchema: {
    farm_id: z.string().describe("Farm UUID from list_farms."),
    days: z.number().optional().describe("Production window in days. Defaults to 7."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ farm_id, days }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const window = Math.min(Math.max(days ?? 7, 1), 365);

    const { data: animals, error } = await supabase
      .from("animals")
      .select("id, life_stage, gender, is_currently_lactating, exit_date")
      .eq("farm_id", farm_id)
      .eq("is_deleted", false);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const active = (animals ?? []).filter((a) => !a.exit_date);
    const byStage: Record<string, number> = {};
    for (const a of active) {
      const key = a.life_stage ?? "unknown";
      byStage[key] = (byStage[key] ?? 0) + 1;
    }
    const lactating = active.filter((a) => a.is_currently_lactating).length;

    const { data: milk, error: milkError } = await supabase
      .from("milking_records")
      .select("liters, sale_amount, is_sold")
      .in("animal_id", active.map((a) => a.id))
      .gte("record_date", daysAgo(window));

    if (milkError)
      return { content: [{ type: "text", text: milkError.message }], isError: true };

    const summary = {
      farm_id,
      active_animals: active.length,
      exited_animals: (animals ?? []).length - active.length,
      lactating_animals: lactating,
      animals_by_life_stage: byStage,
      window_days: window,
      milk_liters: (milk ?? []).reduce((s, r) => s + Number(r.liters ?? 0), 0),
      milk_sales_amount: (milk ?? []).reduce((s, r) => s + Number(r.sale_amount ?? 0), 0),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
