/**
 * /animals — animal list (UX redesign Phase 2).
 *
 * Deep-link state rides in the URL (?animalId=, ?filter=missing-weight,
 * ?editWeight=true) instead of Dashboard tab state, so refresh, share, and
 * hardware back all work. Phase 3 promotes the detail view to /animals/:id.
 */
import { Navigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AnimalList from "@/components/AnimalList";
import { BarnListView } from "@/components/barns/BarnListView";
import { RouteSeo } from "@/components/seo/RouteSeo";
import { useFarmShellContext } from "../FarmShell";

export default function AnimalsRoute() {
  const { farmId, isFarmhand } = useFarmShellContext();
  const [searchParams] = useSearchParams();

  // Phase 2-era deep links used /animals?animalId=X; the profile is now a
  // real route. Redirect (preserving ?editWeight=true).
  const animalId = searchParams.get("animalId");
  if (animalId) {
    const editWeight = searchParams.get("editWeight") === "true";
    return <Navigate to={`/animals/${animalId}${editWeight ? "?editWeight=true" : ""}`} replace />;
  }

  const weightFilter = searchParams.get("filter") === "missing-weight" ? ("missing" as const) : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      <RouteSeo
        title="Animals — Doc Aga Farm Management"
        description="Browse and manage your livestock records."
        path="/animals"
      />
      {!isFarmhand && <BarnListView farmId={farmId} />}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle>My Animals</CardTitle>
          <CardDescription>Manage your livestock and animal records</CardDescription>
        </CardHeader>
        <CardContent>
          <AnimalList farmId={farmId} readOnly={isFarmhand} weightFilter={weightFilter} />
        </CardContent>
      </Card>
    </div>
  );
}
