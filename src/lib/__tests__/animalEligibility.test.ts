import { describe, it, expect } from 'vitest';
import {
  canRecordMilk,
  canRecordHeat,
  canScheduleAI,
  canRecordCalving,
  EligibilityInput,
} from '@/lib/animalEligibility';
import { subMonths } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnimal(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    gender: 'Female',
    livestock_type: 'cattle',
    birth_date: subMonths(new Date(), 36).toISOString(), // 3 years old by default
    life_stage: 'Mature Cow',
    milking_stage: null,
    fertility_status: 'open_cycling',
    is_currently_lactating: false,
    offspring_count: 2,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// canRecordMilk
// ---------------------------------------------------------------------------

describe('canRecordMilk', () => {
  describe('gender checks', () => {
    it('blocks when gender is null', () => {
      const result = canRecordMilk(makeAnimal({ gender: null }));
      expect(result.eligible).toBe(false);
    });

    it('blocks males', () => {
      const result = canRecordMilk(makeAnimal({ gender: 'Male', life_stage: 'Mature Bull' }));
      expect(result.eligible).toBe(false);
    });
  });

  describe('cattle', () => {
    it('blocks Calf', () => {
      const result = canRecordMilk(makeAnimal({
        birth_date: subMonths(new Date(), 4).toISOString(),
        life_stage: 'Calf',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks Heifer Calf', () => {
      const result = canRecordMilk(makeAnimal({
        birth_date: subMonths(new Date(), 10).toISOString(),
        life_stage: 'Heifer Calf',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks Yearling Heifer', () => {
      const result = canRecordMilk(makeAnimal({
        birth_date: subMonths(new Date(), 14).toISOString(),
        life_stage: 'Yearling Heifer',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks Breeding Heifer (no offspring)', () => {
      const result = canRecordMilk(makeAnimal({
        birth_date: subMonths(new Date(), 18).toISOString(),
        life_stage: 'Breeding Heifer',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks Pregnant Heifer (first pregnancy, no offspring)', () => {
      const result = canRecordMilk(makeAnimal({
        birth_date: subMonths(new Date(), 24).toISOString(),
        life_stage: 'Pregnant Heifer',
        fertility_status: 'confirmed_pregnant',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows First-Calf Heifer', () => {
      const result = canRecordMilk(makeAnimal({
        life_stage: 'First-Calf Heifer',
        offspring_count: 1,
      }));
      expect(result.eligible).toBe(true);
    });

    it('allows Mature Cow', () => {
      const result = canRecordMilk(makeAnimal({
        life_stage: 'Mature Cow',
        offspring_count: 2,
      }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('goat', () => {
    it('blocks Kid', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'goat',
        birth_date: subMonths(new Date(), 3).toISOString(),
        life_stage: 'Kid',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks Doeling', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'goat',
        birth_date: subMonths(new Date(), 7).toISOString(),
        life_stage: 'Doeling',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks Breeding Doe (no offspring)', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'goat',
        birth_date: subMonths(new Date(), 12).toISOString(),
        life_stage: 'Breeding Doe',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows First Freshener', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'goat',
        life_stage: 'First Freshener',
        offspring_count: 1,
      }));
      expect(result.eligible).toBe(true);
    });

    it('allows Mature Doe', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'goat',
        life_stage: 'Mature Doe',
        offspring_count: 3,
      }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('carabao', () => {
    it('blocks Carabao Calf', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'carabao',
        birth_date: subMonths(new Date(), 6).toISOString(),
        life_stage: 'Carabao Calf',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows First-Time Mother', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'carabao',
        life_stage: 'First-Time Mother',
        offspring_count: 1,
      }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('sheep', () => {
    it('blocks Ewe Lamb', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'sheep',
        birth_date: subMonths(new Date(), 8).toISOString(),
        life_stage: 'Ewe Lamb',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows Mature Ewe', () => {
      const result = canRecordMilk(makeAnimal({
        livestock_type: 'sheep',
        life_stage: 'Mature Ewe',
        offspring_count: 3,
      }));
      expect(result.eligible).toBe(true);
    });
  });

  describe('lactation overrides', () => {
    it('allows if is_currently_lactating even with 0 offspring (with warning)', () => {
      const result = canRecordMilk(makeAnimal({
        life_stage: 'Breeding Heifer',
        offspring_count: 0,
        is_currently_lactating: true,
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBe(true);
    });

    it('allows if milking_stage is Early Lactation', () => {
      const result = canRecordMilk(makeAnimal({
        milking_stage: 'Early Lactation',
        offspring_count: 1,
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('missing data edge cases', () => {
    it('blocks when all data is null/empty', () => {
      const result = canRecordMilk({
        gender: null,
        livestock_type: null,
        birth_date: null,
        life_stage: null,
        milking_stage: null,
        fertility_status: null,
        is_currently_lactating: null,
        offspring_count: 0,
      });
      expect(result.eligible).toBe(false);
    });

    it('blocks female with no data suggesting lactation', () => {
      const result = canRecordMilk(makeAnimal({
        birth_date: null,
        life_stage: null,
        milking_stage: null,
        is_currently_lactating: null,
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows female with offspring but no life_stage', () => {
      const result = canRecordMilk(makeAnimal({
        birth_date: null,
        life_stage: null,
        offspring_count: 2,
      }));
      expect(result.eligible).toBe(true);
    });

    it('treats is_currently_lactating null as false', () => {
      const result = canRecordMilk(makeAnimal({
        life_stage: 'Breeding Heifer',
        offspring_count: 0,
        is_currently_lactating: null,
      }));
      expect(result.eligible).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// canRecordHeat
// ---------------------------------------------------------------------------

describe('canRecordHeat', () => {
  describe('gender checks', () => {
    it('blocks null gender', () => {
      const result = canRecordHeat(makeAnimal({ gender: null }));
      expect(result.eligible).toBe(false);
    });

    it('blocks males', () => {
      const result = canRecordHeat(makeAnimal({ gender: 'Male', life_stage: 'Mature Bull' }));
      expect(result.eligible).toBe(false);
    });
  });

  describe('age-based checks', () => {
    it('blocks cattle under 15 months', () => {
      const result = canRecordHeat(makeAnimal({
        birth_date: subMonths(new Date(), 12).toISOString(),
        life_stage: 'Yearling Heifer',
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows cattle at 15 months', () => {
      const result = canRecordHeat(makeAnimal({
        birth_date: subMonths(new Date(), 15).toISOString(),
        life_stage: 'Breeding Heifer',
      }));
      expect(result.eligible).toBe(true);
    });

    it('blocks goat under 8 months', () => {
      const result = canRecordHeat(makeAnimal({
        livestock_type: 'goat',
        birth_date: subMonths(new Date(), 5).toISOString(),
        life_stage: 'Kid',
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows goat at 8 months (Doeling stage but breeding-age)', () => {
      const result = canRecordHeat(makeAnimal({
        livestock_type: 'goat',
        birth_date: subMonths(new Date(), 9).toISOString(),
        life_stage: 'Doeling',
      }));
      expect(result.eligible).toBe(true);
    });

    it('blocks carabao under 18 months', () => {
      const result = canRecordHeat(makeAnimal({
        livestock_type: 'carabao',
        birth_date: subMonths(new Date(), 14).toISOString(),
        life_stage: 'Young Carabao',
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows carabao at 18 months', () => {
      const result = canRecordHeat(makeAnimal({
        livestock_type: 'carabao',
        birth_date: subMonths(new Date(), 20).toISOString(),
        life_stage: 'Breeding Carabao',
      }));
      expect(result.eligible).toBe(true);
    });

    it('blocks sheep under 8 months', () => {
      const result = canRecordHeat(makeAnimal({
        livestock_type: 'sheep',
        birth_date: subMonths(new Date(), 5).toISOString(),
        life_stage: 'Ewe Lamb',
      }));
      expect(result.eligible).toBe(false);
    });
  });

  describe('life stage fallback (no birth_date)', () => {
    it('blocks pre-breeding stage', () => {
      const result = canRecordHeat(makeAnimal({
        birth_date: null,
        life_stage: 'Calf',
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows breeding stage', () => {
      const result = canRecordHeat(makeAnimal({
        birth_date: null,
        life_stage: 'Breeding Heifer',
      }));
      expect(result.eligible).toBe(true);
    });

    it('allows post-calving stage', () => {
      const result = canRecordHeat(makeAnimal({
        birth_date: null,
        life_stage: 'Mature Cow',
      }));
      expect(result.eligible).toBe(true);
    });

    it('warns for Doeling without birth_date', () => {
      const result = canRecordHeat(makeAnimal({
        livestock_type: 'goat',
        birth_date: null,
        life_stage: 'Doeling',
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBe(true);
    });
  });

  describe('missing data edge cases', () => {
    it('blocks when livestock_type is null and no birth_date', () => {
      const result = canRecordHeat(makeAnimal({
        livestock_type: null,
        birth_date: null,
        life_stage: null,
      }));
      expect(result.eligible).toBe(false);
    });

    it('allows with warning when no birth_date and no life_stage but has livestock_type', () => {
      const result = canRecordHeat(makeAnimal({
        birth_date: null,
        life_stage: null,
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// canScheduleAI
// ---------------------------------------------------------------------------

describe('canScheduleAI', () => {
  it('blocks males', () => {
    const result = canScheduleAI(makeAnimal({ gender: 'Male', life_stage: 'Mature Bull' }));
    expect(result.eligible).toBe(false);
  });

  it('blocks too young animals', () => {
    const result = canScheduleAI(makeAnimal({
      birth_date: subMonths(new Date(), 10).toISOString(),
      life_stage: 'Heifer Calf',
    }));
    expect(result.eligible).toBe(false);
  });

  it('allows breeding-age open female', () => {
    const result = canScheduleAI(makeAnimal({
      life_stage: 'Breeding Heifer',
      fertility_status: 'open_cycling',
    }));
    expect(result.eligible).toBe(true);
  });

  it('blocks confirmed pregnant', () => {
    const result = canScheduleAI(makeAnimal({
      life_stage: 'Mature Cow',
      fertility_status: 'confirmed_pregnant',
    }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('pregnant');
  });

  it('blocks suspected pregnant', () => {
    const result = canScheduleAI(makeAnimal({
      life_stage: 'Mature Cow',
      fertility_status: 'suspected_pregnant',
    }));
    expect(result.eligible).toBe(false);
  });

  it('blocks pregnant life stage even if fertility_status is null', () => {
    const result = canScheduleAI(makeAnimal({
      life_stage: 'Pregnant Heifer',
      fertility_status: null,
    }));
    expect(result.eligible).toBe(false);
  });

  it('allows bred_waiting (not yet confirmed pregnant)', () => {
    const result = canScheduleAI(makeAnimal({
      life_stage: 'Mature Cow',
      fertility_status: 'bred_waiting',
    }));
    expect(result.eligible).toBe(true);
  });

  it('allows null fertility_status (treat as open)', () => {
    const result = canScheduleAI(makeAnimal({
      life_stage: 'Breeding Heifer',
      fertility_status: null,
    }));
    expect(result.eligible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canRecordCalving
// ---------------------------------------------------------------------------

describe('canRecordCalving', () => {
  describe('gender checks', () => {
    it('blocks null gender', () => {
      const result = canRecordCalving(makeAnimal({ gender: null }));
      expect(result.eligible).toBe(false);
    });

    it('blocks males', () => {
      const result = canRecordCalving(makeAnimal({ gender: 'Male', life_stage: 'Mature Bull' }));
      expect(result.eligible).toBe(false);
    });
  });

  describe('pregnancy checks', () => {
    it('allows confirmed pregnant', () => {
      const result = canRecordCalving(makeAnimal({
        fertility_status: 'confirmed_pregnant',
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('allows suspected pregnant', () => {
      const result = canRecordCalving(makeAnimal({
        fertility_status: 'suspected_pregnant',
      }));
      expect(result.eligible).toBe(true);
    });

    it('allows pregnant life stage', () => {
      const result = canRecordCalving(makeAnimal({
        life_stage: 'Pregnant Heifer',
        fertility_status: null,
      }));
      expect(result.eligible).toBe(true);
    });

    it('allows bred_waiting with warning', () => {
      const result = canRecordCalving(makeAnimal({
        fertility_status: 'bred_waiting',
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBe(true);
    });

    it('allows experienced mother with warning (untracked pregnancy)', () => {
      const result = canRecordCalving(makeAnimal({
        fertility_status: 'open_cycling',
        offspring_count: 2,
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBe(true);
    });
  });

  describe('blocks non-pregnant', () => {
    it('blocks pre-breeding stage', () => {
      const result = canRecordCalving(makeAnimal({
        life_stage: 'Calf',
        fertility_status: null,
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks Doeling', () => {
      const result = canRecordCalving(makeAnimal({
        livestock_type: 'goat',
        life_stage: 'Doeling',
        fertility_status: null,
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks open_cycling with no offspring', () => {
      const result = canRecordCalving(makeAnimal({
        life_stage: 'Breeding Heifer',
        fertility_status: 'open_cycling',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });

    it('blocks not_eligible fertility status', () => {
      const result = canRecordCalving(makeAnimal({
        life_stage: 'Breeding Heifer',
        fertility_status: 'not_eligible',
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(false);
    });
  });

  describe('missing data edge cases', () => {
    it('allows with warning when no fertility_status but breeding stage', () => {
      const result = canRecordCalving(makeAnimal({
        life_stage: 'Breeding Heifer',
        fertility_status: null,
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBe(true);
    });

    it('allows with warning when no life_stage and no fertility_status', () => {
      const result = canRecordCalving(makeAnimal({
        life_stage: null,
        fertility_status: null,
        offspring_count: 0,
      }));
      expect(result.eligible).toBe(true);
      expect(result.warning).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: Complete missing data scenarios
// ---------------------------------------------------------------------------

describe('complete missing data animal', () => {
  const emptyAnimal: EligibilityInput = {
    gender: null,
    livestock_type: null,
    birth_date: null,
    life_stage: null,
    milking_stage: null,
    fertility_status: null,
    is_currently_lactating: null,
    offspring_count: 0,
  };

  it('blocks all female-specific recordings when gender is null', () => {
    expect(canRecordMilk(emptyAnimal).eligible).toBe(false);
    expect(canRecordHeat(emptyAnimal).eligible).toBe(false);
    expect(canScheduleAI(emptyAnimal).eligible).toBe(false);
    expect(canRecordCalving(emptyAnimal).eligible).toBe(false);
  });
});
