/**
 * Shared parentage block (UX redesign Phase 7).
 *
 * SSOT for mother/father selection incl. the AI-father path (bull brand,
 * reference, breed), used by BOTH AnimalForm and EditAnimalDialog. Form
 * Parity Rule: change it here, both forms follow.
 */
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BilingualLabel } from "@/components/ui/bilingual-label";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

export interface ParentOption {
  id: string;
  name: string | null;
  ear_tag: string | null;
}

export interface ParentageFieldsValue {
  mother_id: string;
  father_id: string;
  is_father_ai: boolean;
  ai_bull_brand: string;
  ai_bull_reference: string;
  ai_bull_breed: string;
}

interface ParentageFieldsProps {
  value: ParentageFieldsValue;
  onChange: (patch: Partial<ParentageFieldsValue>) => void;
  mothers: ParentOption[];
  fathers: ParentOption[];
  availableBreeds: readonly string[];
  errors?: { mother_id?: string; father_id?: string; ai_bull_breed?: string };
  loading?: boolean;
  idPrefix?: string;
}

const parentDisplayName = (parent: ParentOption) => {
  if (parent.name && parent.ear_tag) return `${parent.name} (${parent.ear_tag})`;
  return parent.name || parent.ear_tag || "Unnamed";
};

export function ParentageFields({
  value,
  onChange,
  mothers,
  fathers,
  availableBreeds,
  errors = {},
  loading = false,
  idPrefix = "",
}: ParentageFieldsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading parents...</span>
      </div>
    );
  }

  const pureBreeds = availableBreeds.filter((b) => b !== "Mix Breed");

  return (
    <>
      <div className="space-y-2">
        <BilingualLabel k="mother" htmlFor={`${idPrefix}mother_id`} />
        <Select
          value={value.mother_id || "none"}
          onValueChange={(v) => onChange({ mother_id: v === "none" ? "" : v })}
        >
          <SelectTrigger
            id={`${idPrefix}mother_id`}
            className={cn(errors.mother_id && "border-destructive focus-visible:ring-destructive")}
          >
            <SelectValue placeholder="Select mother / Pumili ng ina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Data / Hindi Alam</SelectItem>
            {mothers.map((mother) => (
              <SelectItem key={mother.id} value={mother.id}>
                {parentDisplayName(mother)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.mother_id} />
      </div>

      <div className="space-y-2">
        <BilingualLabel k="father" htmlFor={`${idPrefix}father_id`} />
        <Select
          value={value.is_father_ai ? "ai" : value.father_id || "none"}
          onValueChange={(v) => {
            if (v === "ai") {
              onChange({ is_father_ai: true, father_id: "" });
            } else {
              onChange({ is_father_ai: false, father_id: v === "none" ? "" : v });
            }
          }}
        >
          <SelectTrigger
            id={`${idPrefix}father_id`}
            className={cn(errors.father_id && "border-destructive focus-visible:ring-destructive")}
          >
            <SelectValue placeholder="Select father / Pumili ng ama" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Data / Hindi Alam</SelectItem>
            <SelectItem value="ai">🧬 AI / Artificial Insemination</SelectItem>
            {fathers.map((father) => (
              <SelectItem key={father.id} value={father.id}>
                {parentDisplayName(father)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.father_id} />

        {value.is_father_ai && (
          <div className="space-y-3 mt-2 p-3 bg-muted/40 rounded-lg">
            <div className="space-y-2">
              <BilingualLabel english="Bull Semen Brand" filipino="Brand ng Semen" htmlFor={`${idPrefix}ai_bull_brand`} />
              <Input
                id={`${idPrefix}ai_bull_brand`}
                value={value.ai_bull_brand}
                onChange={(e) => onChange({ ai_bull_brand: e.target.value })}
                placeholder="Enter bull semen brand"
              />
            </div>
            <div className="space-y-2">
              <BilingualLabel english="Bull Reference/Name" filipino="Pangalan ng Toro" htmlFor={`${idPrefix}ai_bull_reference`} />
              <Input
                id={`${idPrefix}ai_bull_reference`}
                value={value.ai_bull_reference}
                onChange={(e) => onChange({ ai_bull_reference: e.target.value })}
                placeholder="Enter bull reference or name"
              />
            </div>
            <div className="space-y-2">
              <BilingualLabel english="Bull Breed" filipino="Lahi ng Toro" htmlFor={`${idPrefix}ai_bull_breed`} />
              <Select
                value={value.ai_bull_breed || "no_data"}
                onValueChange={(v) => onChange({ ai_bull_breed: v === "no_data" ? "" : v })}
              >
                <SelectTrigger
                  id={`${idPrefix}ai_bull_breed`}
                  className={cn(errors.ai_bull_breed && "border-destructive focus-visible:ring-destructive")}
                >
                  <SelectValue placeholder="Select bull breed / Pumili ng lahi ng toro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_data">No Data / Hindi Alam</SelectItem>
                  {pureBreeds.map((breed) => (
                    <SelectItem key={breed} value={breed}>
                      {breed}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.ai_bull_breed} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
