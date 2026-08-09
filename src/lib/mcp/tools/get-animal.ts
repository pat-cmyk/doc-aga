import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "get_animal",
  title: "Get animal details",
  description:
    "Get the full profile of one animal by id, including breeding, weight and lactation fields.",
  inputSchema: {
    animal_id: z.string().describe("Animal UUID from list_animals."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ animal_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("animals")
      .select("*")
      .eq("id", animal_id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return {
        content: [{ type: "text", text: "No animal found with that id (or no access)." }],
        isError: true,
      };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { animal: data },
    };
  },
});
