/**
 * Shared breed selection block (UX redesign Phase 7).
 *
 * SSOT for the breed + mix-breed fields used by BOTH the add form
 * (AnimalForm) and the edit dialog (EditAnimalDialog) — previously two
 * drifting copies. Form Parity Rule: change it here, both forms follow.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BilingualLabel } from "@/components/ui/bilingual-label";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

export interface BreedFieldsValue {
  breed: string;
  breed1: string;
  breed2: string;
}

interface BreedFieldsProps {
  value: BreedFieldsValue;
  onChange: (patch: Partial<BreedFieldsValue>) => void;
  availableBreeds: readonly string[];
  errors?: { breed1?: string; breed2?: string };
  idPrefix?: string;
}

export function BreedFields({ value, onChange, availableBreeds, errors = {}, idPrefix = "" }: BreedFieldsProps) {
  const pureBreeds = availableBreeds.filter((b) => b !== "Mix Breed");

  return (
    <>
      <div className="space-y-2">
        <BilingualLabel k="breed" htmlFor={`${idPrefix}breed`} />
        <Select
          value={value.breed || "no_data"}
          onValueChange={(v) => onChange({ breed: v === "no_data" ? "" : v, breed1: "", breed2: "" })}
        >
          <SelectTrigger id={`${idPrefix}breed`}>
            <SelectValue placeholder="Select breed / Pumili ng lahi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no_data">No Data / Hindi Alam</SelectItem>
            {availableBreeds.map((breed) => (
              <SelectItem key={breed} value={breed}>
                {breed}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.breed === "Mix Breed" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <BilingualLabel k="firstBreed" required />
            <Select value={value.breed1} onValueChange={(v) => onChange({ breed1: v })}>
              <SelectTrigger className={cn(errors.breed1 && "border-destructive focus-visible:ring-destructive")}>
                <SelectValue placeholder="Select first breed / Pumili ng unang lahi" />
              </SelectTrigger>
              <SelectContent>
                {pureBreeds.map((breed) => (
                  <SelectItem key={breed} value={breed}>
                    {breed}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.breed1} />
          </div>
          <div className="space-y-2">
            <BilingualLabel k="secondBreed" required />
            <Select value={value.breed2} onValueChange={(v) => onChange({ breed2: v })}>
              <SelectTrigger className={cn(errors.breed2 && "border-destructive focus-visible:ring-destructive")}>
                <SelectValue placeholder="Select second breed / Pumili ng ikalawang lahi" />
              </SelectTrigger>
              <SelectContent>
                {pureBreeds.map((breed) => (
                  <SelectItem key={breed} value={breed}>
                    {breed}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.breed2} />
          </div>
        </div>
      )}
    </>
  );
}
