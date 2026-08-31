/**
 * Add-animal validation (UX redesign Phase 3).
 *
 * Pure so it is unit-testable; AnimalForm renders the messages inline next to
 * each field (replacing the old one-toast-at-a-time chain, which made farmers
 * fix one field, resubmit, and discover the next problem).
 */
export interface AnimalFormValidationInput {
  gender: string;
  ear_tag: string;
  animal_type: string;
  mother_id: string;
  father_id: string;
  is_father_ai: boolean;
  ai_bull_breed: string;
}

/** Field name → bilingual error message (English first, per UI language rule). */
export function validateAnimalForm(form: AnimalFormValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.gender) {
    errors.gender = "Please select the animal's gender / Piliin ang kasarian";
  }

  if (!form.ear_tag.trim()) {
    errors.ear_tag = "Ear tag is required / Kinakailangan ang ear tag";
  }

  if (form.animal_type === "offspring") {
    if (!form.mother_id || form.mother_id === "none") {
      errors.mother_id = "Mother is required for offspring / Kinakailangan ang ina";
    }
    if (!form.is_father_ai && (!form.father_id || form.father_id === "none")) {
      errors.father_id = "Father or AI is required for offspring / Kinakailangan ang ama o AI";
    }
    if (form.is_father_ai && !form.ai_bull_breed) {
      errors.ai_bull_breed = "AI bull breed is required / Kinakailangan ang lahi ng toro";
    }
  }

  return errors;
}

/** DOM ids to scroll to per error key (first error wins). */
export const ANIMAL_FORM_FIELD_IDS: Record<string, string> = {
  gender: "gender-field",
  ear_tag: "ear_tag",
  mother_id: "mother_id",
  father_id: "father_id",
  ai_bull_breed: "ai_bull_breed",
};
