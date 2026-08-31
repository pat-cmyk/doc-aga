/**
 * Shared acquisition block (UX redesign Phase 7).
 *
 * SSOT for how-was-this-animal-acquired (purchased/grant + price/source),
 * used by BOTH AnimalForm and EditAnimalDialog. Form Parity Rule: change it
 * here, both forms follow.
 */
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BilingualLabel } from "@/components/ui/bilingual-label";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

export interface AcquisitionFieldsValue {
  acquisition_type: string;
  purchase_price: string;
  grant_source: string;
  grant_source_other: string;
  source_farm: string;
}

interface AcquisitionFieldsProps {
  value: AcquisitionFieldsValue;
  onChange: (patch: Partial<AcquisitionFieldsValue>) => void;
  errors?: { grant_source?: string; grant_source_other?: string };
  idPrefix?: string;
}

export function AcquisitionFields({ value, onChange, errors = {}, idPrefix = "" }: AcquisitionFieldsProps) {
  return (
    <div className="space-y-4 p-4 bg-muted/40 rounded-lg">
      <BilingualLabel k="acquisitionQuestion" required />
      <RadioGroup
        value={value.acquisition_type}
        onValueChange={(v) =>
          onChange({
            acquisition_type: v,
            purchase_price: v === "grant" ? "" : value.purchase_price,
            grant_source: v === "purchased" ? "" : value.grant_source,
            grant_source_other: v === "purchased" ? "" : value.grant_source_other,
          })
        }
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="purchased" id={`${idPrefix}acquired_purchased`} />
          <label htmlFor={`${idPrefix}acquired_purchased`} className="cursor-pointer font-normal">
            Purchased / Binili
          </label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="grant" id={`${idPrefix}acquired_grant`} />
          <label htmlFor={`${idPrefix}acquired_grant`} className="cursor-pointer font-normal">
            Grant / Bigay
          </label>
        </div>
      </RadioGroup>

      {value.acquisition_type === "purchased" && (
        <div className="space-y-2">
          <BilingualLabel english="Purchase Price (PHP)" filipino="Halaga ng Pagbili" htmlFor={`${idPrefix}purchase_price`} />
          <Input
            id={`${idPrefix}purchase_price`}
            type="number"
            step="0.01"
            min="0"
            value={value.purchase_price}
            onChange={(e) => onChange({ purchase_price: e.target.value })}
            placeholder="e.g., 50000"
          />
        </div>
      )}

      {value.acquisition_type === "grant" && (
        <>
          <div className="space-y-2">
            <BilingualLabel k="grantSource" required htmlFor={`${idPrefix}grant_source`} />
            <Select
              value={value.grant_source}
              onValueChange={(v) =>
                onChange({ grant_source: v, grant_source_other: v !== "other" ? "" : value.grant_source_other })
              }
            >
              <SelectTrigger
                id={`${idPrefix}grant_source`}
                className={cn(errors.grant_source && "border-destructive focus-visible:ring-destructive")}
              >
                <SelectValue placeholder="Select grant source / Pumili ng pinagmulan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="national_dairy_authority">National Dairy Authority (NDA)</SelectItem>
                <SelectItem value="local_government_unit">Local Government Unit (LGU)</SelectItem>
                <SelectItem value="other">Other / Iba pa</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={errors.grant_source} />
          </div>

          {value.grant_source === "other" && (
            <div className="space-y-2">
              <BilingualLabel k="specifySource" required htmlFor={`${idPrefix}grant_source_other`} />
              <Input
                id={`${idPrefix}grant_source_other`}
                value={value.grant_source_other}
                onChange={(e) => onChange({ grant_source_other: e.target.value })}
                placeholder="Enter grant source / Ilagay ang pinagmulan"
                className={cn(errors.grant_source_other && "border-destructive focus-visible:ring-destructive")}
              />
              <FieldError message={errors.grant_source_other} />
            </div>
          )}
        </>
      )}

      {/* Source Farm — shown for both purchased and grant */}
      <div className="space-y-2">
        <BilingualLabel english="Source Farm" filipino="Pinagmulan na Farm" htmlFor={`${idPrefix}source_farm`} />
        <Input
          id={`${idPrefix}source_farm`}
          value={value.source_farm}
          onChange={(e) => onChange({ source_farm: e.target.value })}
          placeholder="Enter farm name / Ilagay ang pangalan ng farm"
        />
      </div>
    </div>
  );
}
