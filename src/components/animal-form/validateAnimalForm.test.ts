import { describe, it, expect } from "vitest";
import { validateAnimalForm } from "./validateAnimalForm";

const base = {
  gender: "Female",
  ear_tag: "A001",
  animal_type: "new_entrant",
  mother_id: "",
  father_id: "",
  is_father_ai: false,
  ai_bull_breed: "",
};

describe("validateAnimalForm", () => {
  it("passes a complete new entrant", () => {
    expect(validateAnimalForm(base)).toEqual({});
  });

  it("requires gender and ear tag, reported together (not one at a time)", () => {
    const errors = validateAnimalForm({ ...base, gender: "", ear_tag: "  " });
    expect(Object.keys(errors).sort()).toEqual(["ear_tag", "gender"]);
  });

  it("offspring requires a mother", () => {
    const errors = validateAnimalForm({ ...base, animal_type: "offspring", mother_id: "none" });
    expect(errors.mother_id).toBeTruthy();
  });

  it("offspring requires a father unless AI", () => {
    expect(
      validateAnimalForm({ ...base, animal_type: "offspring", mother_id: "m1" }).father_id,
    ).toBeTruthy();
    expect(
      validateAnimalForm({
        ...base,
        animal_type: "offspring",
        mother_id: "m1",
        is_father_ai: true,
        ai_bull_breed: "Holstein",
      }),
    ).toEqual({});
  });

  it("AI father requires a bull breed", () => {
    const errors = validateAnimalForm({
      ...base,
      animal_type: "offspring",
      mother_id: "m1",
      is_father_ai: true,
    });
    expect(errors.ai_bull_breed).toBeTruthy();
  });

  it("new entrants never get offspring errors", () => {
    expect(validateAnimalForm({ ...base, mother_id: "none" })).toEqual({});
  });
});
