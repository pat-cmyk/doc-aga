/**
 * /money — farm finance (UX redesign Phase 2).
 *
 * FinanceTab's legacy onNavigateToTab callback (which used to flip Dashboard
 * tab state) now maps onto real routes.
 */
import { useNavigate } from "react-router-dom";
import { FinanceTab } from "@/components/FinanceTab";
import { RouteSeo } from "@/components/seo/RouteSeo";
import { useFarmShellContext } from "../FarmShell";

const TAB_PATHS: Record<string, string> = {
  dashboard: "/home",
  animals: "/animals",
  operations: "/operations/milk",
  finance: "/money",
  more: "/more",
};

export default function MoneyRoute() {
  const { farmId, canManageFarm } = useFarmShellContext();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 sm:space-y-6">
      <RouteSeo
        title="Money — Doc Aga Farm Management"
        description="Track farm revenue, expenses, and profitability."
        path="/money"
      />
      <FinanceTab
        farmId={farmId}
        canManage={canManageFarm}
        onNavigateToTab={(tab) => navigate(TAB_PATHS[tab] ?? "/home")}
      />
    </div>
  );
}
