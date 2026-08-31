/**
 * /animals/:animalId — animal profile as a real route (UX redesign Phase 3).
 *
 * Replaces the old in-place mount inside AnimalList: the profile now has a
 * shareable URL, hardware/browser back returns to the list, and refresh stays
 * on the animal. ?editWeight=true still opens the entry-weight dialog (used by
 * dashboard alerts and legacy notification links).
 */
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import AnimalDetails from "@/components/AnimalDetails";
import { RouteSeo } from "@/components/seo/RouteSeo";
import { useFarmShellContext } from "../FarmShell";

export default function AnimalDetailRoute() {
  const { animalId } = useParams<{ animalId: string }>();
  const { farmId, isFarmhand } = useFarmShellContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  if (!animalId) {
    return <Navigate to="/animals" replace />;
  }

  const handleBack = () => {
    const historyState = window.history.state as { idx?: number } | null;
    if (typeof historyState?.idx === "number" && historyState.idx > 0) {
      navigate(-1);
    } else {
      // Cold start on a deep link — go up to the list instead of exiting.
      navigate("/animals", { replace: true });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <RouteSeo
        title="Animal Profile — Doc Aga Farm Management"
        description="Full records for one animal: milk, weight, feed, health, breeding, photos, and costs."
        path={`/animals/${animalId}`}
      />
      <AnimalDetails
        animalId={animalId}
        farmId={farmId}
        onBack={handleBack}
        editWeightOnOpen={searchParams.get("editWeight") === "true"}
        readOnly={isFarmhand}
      />
    </div>
  );
}
