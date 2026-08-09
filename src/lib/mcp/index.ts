import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFarmsTool from "./tools/list-farms";
import listAnimalsTool from "./tools/list-animals";
import getAnimalTool from "./tools/get-animal";
import listMilkingRecordsTool from "./tools/list-milking-records";
import farmSummaryTool from "./tools/farm-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "doc-aga",
  title: "doc-aga",
  version: "0.1.0",
  instructions:
    "Read-only tools for Doc Aga, a livestock farm management app for Filipino farmers. Call `list_farms` first to get a farm id, then use `farm_summary` for a herd/production snapshot, `list_animals` and `get_animal` for herd details, and `list_milking_records` for milk production and sales. All data is scoped to the signed-in user's farms.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listFarmsTool, farmSummaryTool, listAnimalsTool, getAnimalTool, listMilkingRecordsTool],
});
