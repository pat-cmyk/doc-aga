
# SSOT Alignment: Add Missing Update/Correction Tools to Doc Aga

## Problem Summary

Following the health record update pattern, Doc Aga needs similar update/correction capabilities for ALL record types to maintain Single Source of Truth (SSOT) consistency. Currently:

- **Health records**: Full CRUD (add, update, resolve) ✅
- **Other records**: Only ADD capability, no corrections possible ❌

This creates scenarios where Doc Aga might "hallucinate" corrections for milk, weight, feeding, and breeding records just like it did for health records.

---

## Proposed New Tools

### 1. **Milking Records**

#### `update_milking_record`
**Use case**: Farmer says "Doc, mali yung 5L kahapon kay Bessie, 8L pala yun"

```
Parameters:
- animal_identifier (required): Animal name or ear tag
- record_date (optional): Target specific date (defaults to most recent)
- session (optional): AM or PM to target specific session
- new_liters (optional): Corrected liter amount
- notes (optional): Reason for correction
```

#### `delete_milking_record`
**Use case**: "Doc, wala pala yung record na yun, delete mo"

---

### 2. **Weight Records**

#### `add_weight_record` (MISSING - Critical!)
**Use case**: "Doc, 350kg na si Bessie ngayon"

```
Parameters:
- animal_identifier (required): Animal name or ear tag
- weight_kg (required): Weight in kilograms
- measurement_method (optional): Scale, tape measure, visual estimate
- notes (optional): Additional observations
```

#### `update_weight_record`
**Use case**: "Doc, mali yung timbang kahapon, 340kg lang pala hindi 350kg"

```
Parameters:
- animal_identifier (required): Animal name or ear tag
- record_date (optional): Target specific date
- new_weight_kg (optional): Corrected weight
- notes (optional): Reason for correction
```

---

### 3. **AI/Breeding Records**

#### `update_ai_record` / `confirm_pregnancy`
**Use case**: "Doc, confirmed na buntis si Bessie" or "Mali pala, hindi pala buntis"

```
Parameters:
- animal_identifier (required): Animal name or ear tag
- pregnancy_confirmed (optional): true/false/null
- expected_delivery_date (optional): Expected calving date
- notes (optional): Additional notes
```

---

### 4. **Feeding Records**

#### `update_feeding_record`
**Use case**: "Doc, mali yung feeding record, 3kg lang hindi 5kg"

```
Parameters:
- animal_identifier (required): Animal name or ear tag
- record_date (optional): Target specific date
- new_kilograms (optional): Corrected amount
- new_feed_type (optional): Corrected feed type
- notes (optional): Reason for correction
```

---

### 5. **Injection Records**

#### `update_injection_record`
**Use case**: "Doc, mali yung dosage na nilagay ko, 5mL lang hindi 10mL"

```
Parameters:
- animal_identifier (required): Animal name or ear tag
- record_date (optional): Target specific datetime
- new_medicine_name (optional): Corrected medicine
- new_dosage (optional): Corrected dosage
- notes (optional): Reason for correction
```

---

## Implementation Priority

Based on frequency of farmer corrections and SSOT impact:

| Priority | Tool | Reason |
|----------|------|--------|
| **P0 - Critical** | `add_weight_record` | Currently NO WAY to add weight via voice/Doc Aga |
| **P1 - High** | `update_milking_record` | Most common correction - liters entered wrong |
| **P1 - High** | `confirm_pregnancy` / `update_ai_record` | Critical for breeding management |
| **P2 - Medium** | `update_weight_record` | Weight corrections happen occasionally |
| **P2 - Medium** | `update_feeding_record` | Feed amount corrections |
| **P3 - Low** | `update_injection_record` | Less frequent corrections |
| **P3 - Low** | `delete_milking_record` | Rare but needed |

---

## Technical Implementation

### File: `supabase/functions/doc-aga/tools.ts`

Add 6 new functions following the `updateHealthRecord` pattern:

1. `addWeightRecord()` - Create weight measurement
2. `updateMilkingRecord()` - Correct liters/session
3. `updateWeightRecord()` - Correct weight measurements
4. `updateAIRecord()` - Confirm pregnancy, update delivery date
5. `updateFeedingRecord()` - Correct feed amounts
6. `updateInjectionRecord()` - Correct injection details

Each function will:
- Find animal by identifier (name or ear_tag)
- Find the target record (most recent or by date)
- Build update object from provided parameters
- Execute update and return before/after values

### File: `supabase/functions/doc-aga/index.ts`

Add tool definitions to `getFarmerTools()`:

```typescript
// Weight tools
{ type: "function", function: { name: "add_weight_record", ... } },
{ type: "function", function: { name: "update_weight_record", ... } },

// Milking tools
{ type: "function", function: { name: "update_milking_record", ... } },

// Breeding tools
{ type: "function", function: { name: "update_ai_record", ... } },

// Feeding tools
{ type: "function", function: { name: "update_feeding_record", ... } },

// Injection tools
{ type: "function", function: { name: "update_injection_record", ... } },
```

Add cases to `executeToolCall()` switch statement.

---

## Database Columns Available for Updates

| Table | Updatable Fields |
|-------|-----------------|
| `milking_records` | liters, session, notes (add), record_date |
| `weight_records` | weight_kg, measurement_method, notes |
| `ai_records` | pregnancy_confirmed, expected_delivery_date, technician, semen_code, notes |
| `feeding_records` | feed_type, kilograms, notes |
| `injection_records` | medicine_name, dosage, instructions, notes |

---

## Example Conversations After Implementation

### Correcting Milk Record

**User**: "Doc, mali yung record ko kay Bessie kahapon. 8 liters pala hindi 5."

**Doc Aga**: "Okay, ina-update ko na ang milking record ni Bessie.

✅ **Updated milking record:**
- Date: January 26, 2026
- Previous: 5L
- Corrected to: 8L

Tama na po ba ito?"

### Adding Weight

**User**: "Doc, 350kg na si Brownie ngayon"

**Doc Aga**: "Recorded! 

✅ **Weight record saved:**
- Animal: Brownie (A003)
- Weight: 350 kg
- Date: January 27, 2026

Magandang growth! Last weight niya was 320kg noong December. +30kg in a month! 📈"

### Confirming Pregnancy

**User**: "Doc, confirmed na buntis si Daisy"

**Doc Aga**: "Congrats! 🎉 Na-update ko na ang breeding record ni Daisy.

✅ **Pregnancy confirmed:**
- Animal: Daisy (A005)
- AI Date: December 15, 2025
- Expected Delivery: September 24, 2026

Gusto mo bang i-set yung expected delivery date, or okay na itong estimate?"

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/doc-aga/tools.ts` | Add 6 new functions: `addWeightRecord`, `updateMilkingRecord`, `updateWeightRecord`, `updateAIRecord`, `updateFeedingRecord`, `updateInjectionRecord` |
| `supabase/functions/doc-aga/index.ts` | Add tool definitions to `getFarmerTools()` and cases to `executeToolCall()` |

---

## Testing Checklist

After implementation:
- [ ] Can add weight record via Doc Aga ("350kg si Bessie")
- [ ] Can correct milk liters ("mali yung 5L, 8L pala")
- [ ] Can confirm pregnancy ("confirmed na buntis")
- [ ] Can update expected delivery date
- [ ] Can correct feeding amounts
- [ ] Can correct injection details
- [ ] All corrections show before/after values
- [ ] Database reflects actual updates (no more hallucinations)

---

## Memory Update

After implementation, update the architecture memory:

```
memory/architecture/doc-aga-ssot-crud-pattern-v2

Doc Aga now has full CRUD (Create, Read, Update) capabilities for all major record types following SSOT principles. Pattern: find animal by identifier → find target record (most recent or by date) → execute update → return before/after for confirmation. Applies to: health_records (add, update, resolve), milking_records (add, update), weight_records (add, update), ai_records (add, update/confirm), feeding_records (add, update), injection_records (add, update). All updates are logged with previous values for audit trail.
```
