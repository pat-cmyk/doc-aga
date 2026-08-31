/**
 * /more — everything-else hub (UX redesign Phase 2).
 *
 * The old More tab nested Tabs three levels deep at "/" with no URL state.
 * Sections are now flat chips driven by ?tab=, so approvals/government deep
 * links (from notifications) land directly. Farmhands see their submissions
 * here (previously a tab on the farmhand dashboard).
 */
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingActivitiesQueue } from "@/components/approval/PendingActivitiesQueue";
import { ApprovalSettings } from "@/components/approval/ApprovalSettings";
import { MySubmissions } from "@/components/approval/MySubmissions";
import { GovernmentConnectTab } from "@/components/farmer/GovernmentConnectTab";
import { FarmerFeedbackList } from "@/components/farmer/FarmerFeedbackList";
import { MyCooperativeTab } from "@/components/cooperative/farmer-view/MyCooperativeTab";
import { useMyCoopMembership } from "@/hooks/useMyCooperative";
import { usePendingActivities } from "@/hooks/usePendingActivities";
import { RouteSeo } from "@/components/seo/RouteSeo";
import { useFarmShellContext } from "../FarmShell";

interface MoreSection {
  id: string;
  label: string;
}

export default function MoreRoute() {
  const { farmId, user, isFarmhand, canManageFarm } = useFarmShellContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: coopMembership } = useMyCoopMembership(farmId);
  const { pendingCount } = usePendingActivities(farmId, undefined);

  const sections: MoreSection[] = [
    ...(canManageFarm ? [{ id: "approvals", label: "Approvals" }] : []),
    ...(isFarmhand ? [{ id: "submissions", label: "My Submissions" }] : []),
    ...(coopMembership ? [{ id: "cooperative", label: "Cooperative" }] : []),
    { id: "government", label: "Government" },
    ...(canManageFarm ? [{ id: "settings", label: "Settings" }] : []),
  ];

  const requested = searchParams.get("tab");
  const active = sections.some((s) => s.id === requested) ? requested! : sections[0].id;

  const selectSection = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <RouteSeo
        title="More — Doc Aga Farm Management"
        description="Approvals, cooperative, government programs, and settings."
        path="/more"
      />
      <nav aria-label="More sections" className="flex gap-2 overflow-x-auto scrollbar-hide">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => selectSection(section.id)}
            className={cn(
              "min-h-[44px] inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
              section.id === active
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {section.label}
            {section.id === "approvals" && pendingCount > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-xs">
                {pendingCount}
              </Badge>
            )}
          </button>
        ))}
      </nav>

      {active === "approvals" && canManageFarm && <PendingActivitiesQueue farmId={farmId} />}

      {active === "submissions" && user && <MySubmissions userId={user.id} />}

      {active === "cooperative" && coopMembership && <MyCooperativeTab farmId={farmId} />}

      {active === "government" && (
        <Tabs defaultValue="submit" className="space-y-4">
          <TabsList>
            <TabsTrigger value="submit">Submit Feedback</TabsTrigger>
            <TabsTrigger value="submissions">My Submissions</TabsTrigger>
          </TabsList>
          <TabsContent value="submit">
            <GovernmentConnectTab farmId={farmId} />
          </TabsContent>
          <TabsContent value="submissions">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle>My Submissions</CardTitle>
                <CardDescription>Track your feedback to the government</CardDescription>
              </CardHeader>
              <CardContent>
                <FarmerFeedbackList farmId={farmId} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {active === "settings" && canManageFarm && <ApprovalSettings farmId={farmId} />}
    </div>
  );
}
