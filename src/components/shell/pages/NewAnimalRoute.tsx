/**
 * /animals/new — add animal as a focused page (UX redesign Phase 3).
 *
 * One canonical add-animal surface: the FAB's 90vh bottom sheet and the
 * animal list's in-place form swap both navigate here now. Focused flow:
 * page-mode header, no bottom nav (a stray tap can't lose the form).
 */
import { useNavigate } from "react-router-dom";
import AnimalForm from "@/components/AnimalForm";
import { RouteSeo } from "@/components/seo/RouteSeo";
import { PageHeader } from "../PageHeader";
import { useFarmShellContext } from "../FarmShell";

export default function NewAnimalRoute() {
  const { farmId } = useFarmShellContext();
  const navigate = useNavigate();

  const exitToAnimals = () => {
    const historyState = window.history.state as { idx?: number } | null;
    if (typeof historyState?.idx === "number" && historyState.idx > 0) {
      navigate(-1);
    } else {
      navigate("/animals", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background">
      <RouteSeo
        title="Add Animal — Doc Aga Farm Management"
        description="Register a new animal to your herd."
        path="/animals/new"
      />
      <PageHeader title="Add Animal" subtitle="Magdagdag ng hayop" fallbackPath="/animals" />
      <main className="container mx-auto px-4 py-4 max-w-2xl pb-safe">
        <AnimalForm farmId={farmId} onSuccess={exitToAnimals} onCancel={exitToAnimals} />
      </main>
    </div>
  );
}
