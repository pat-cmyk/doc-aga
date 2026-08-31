/**
 * /operations/:subtab — milk / feed / breeding (UX redesign Phase 2).
 *
 * The old Dashboard nested a second Tabs layer in React state; each segment is
 * now its own URL so back navigation and deep links work. Farmhands only get
 * the feed segment (parity with the old farmhand dashboard).
 */
import { useEffect, useState } from "react";
import { Navigate, NavLink, useParams, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { MilkInventoryTab } from "@/components/milk-inventory/MilkInventoryTab";
import { FeedInventoryTab } from "@/components/FeedInventoryTab";
import { BreedingHub } from "@/components/breeding";
import { RouteSeo } from "@/components/seo/RouteSeo";
import { generateFeedForecast } from "@/lib/feedForecast";
import { useFarmShellContext } from "../FarmShell";
import { allowedOperationsSubtabs, type OperationsSubtab } from "../routes";

const SUBTAB_LABELS: Record<OperationsSubtab, string> = {
  milk: "Milk Inventory",
  feed: "Feed Stock",
  breeding: "Breeding",
};

export default function OperationsRoute() {
  const { farmId, isFarmhand, canManageFarm } = useFarmShellContext();
  const { subtab } = useParams<{ subtab: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [forecastData, setForecastData] = useState<ReturnType<typeof generateFeedForecast>>([]);

  const allowed = allowedOperationsSubtabs({ isFarmhand });
  const prefillFeedType = searchParams.get("prefillFeedType") ?? undefined;

  useEffect(() => {
    const loadForecastData = async () => {
      try {
        const { data: animals } = await supabase
          .from("animals")
          .select("id, birth_date, gender, life_stage, milking_stage, current_weight_kg")
          .eq("farm_id", farmId)
          .eq("is_deleted", false)
          .is("exit_date", null);
        if (animals) {
          setForecastData(generateFeedForecast(animals));
        }
      } catch (error) {
        console.error("Error loading forecast data:", error);
      }
    };
    loadForecastData();
  }, [farmId]);

  if (!subtab || !allowed.includes(subtab as OperationsSubtab)) {
    return <Navigate to={`/operations/${allowed[0]}`} replace />;
  }
  const active = subtab as OperationsSubtab;

  return (
    <div className="space-y-4">
      <RouteSeo
        title="Operations — Doc Aga Farm Management"
        description="Milk inventory, feed stock, and breeding management."
        path={`/operations/${active}`}
      />
      <nav aria-label="Operations sections" className="flex gap-2 overflow-x-auto scrollbar-hide">
        {allowed.map((tab) => (
          <NavLink
            key={tab}
            to={`/operations/${tab}`}
            replace
            className={cn(
              "min-h-[44px] inline-flex items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
              tab === active
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {SUBTAB_LABELS[tab]}
          </NavLink>
        ))}
      </nav>

      {active === "milk" && <MilkInventoryTab farmId={farmId} canManage={canManageFarm} />}
      {active === "feed" && (
        <FeedInventoryTab
          farmId={farmId}
          forecasts={forecastData}
          canManage={canManageFarm}
          prefillFeedType={prefillFeedType}
          onPrefillUsed={() => {
            const next = new URLSearchParams(searchParams);
            next.delete("prefillFeedType");
            setSearchParams(next, { replace: true });
          }}
        />
      )}
      {active === "breeding" && <BreedingHub farmId={farmId} />}
    </div>
  );
}
