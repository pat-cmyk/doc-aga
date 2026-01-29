
# CRUD Capabilities Audit: Record Types per SSOT Architecture

## Executive Summary

This audit reviews all primary record types to assess Create, Read, Update, Delete (CRUD) capabilities in the UI components. The findings show significant gaps in **frontend UI** edit/delete functionality, while the **Doc Aga AI assistant** has comprehensive update capabilities via backend tools.

---

## Current State by Record Type

### 1. MILKING RECORDS ✅ Full CRUD

| Operation | UI Component | Status |
|-----------|--------------|--------|
| Create | `RecordSingleMilkDialog.tsx`, `RecordBulkMilkDialog.tsx` | Implemented |
| Read | `MilkingRecords.tsx` | Implemented |
| Update | `EditMilkRecordDialog.tsx` | Implemented |
| Delete | `DeleteMilkRecordFromProfileDialog.tsx` | Implemented |

**Backend (Doc Aga):** `add_milking_record`, `update_milking_record` available

---

### 2. FEEDING RECORDS ✅ Full CRUD (Just Added)

| Operation | UI Component | Status |
|-----------|--------------|--------|
| Create | `RecordSingleFeedDialog.tsx`, `RecordBulkFeedDialog.tsx` | Implemented |
| Read | `FeedingRecords.tsx` | Implemented |
| Update | `EditFeedingRecordDialog.tsx` | **Just Implemented** |
| Delete | — | Missing |

**Backend (Doc Aga):** `add_feeding_record`, `update_feeding_record` available

---

### 3. HEALTH RECORDS ⚠️ Partial CRUD

| Operation | UI Component | Status |
|-----------|--------------|--------|
| Create | `RecordSingleHealthDialog.tsx`, `RecordBulkHealthDialog.tsx` | Implemented |
| Read | `HealthRecords.tsx` | Implemented |
| Update | — | **Missing in UI** |
| Delete | — | Missing |

**Backend (Doc Aga):** `add_health_record`, `update_health_record`, `add_health_resolution` available

**Gap:** No frontend edit dialog exists. Users cannot correct diagnoses or treatments via UI.

---

### 4. WEIGHT RECORDS ⚠️ Partial CRUD

| Operation | UI Component | Status |
|-----------|--------------|--------|
| Create | `RecordSingleWeightDialog.tsx` | Implemented |
| Read | `WeightRecords.tsx` | Implemented |
| Update | `EditAcquisitionWeightDialog.tsx` (limited - acquisition weight only) | Partial |
| Delete | — | Missing |

**Backend (Doc Aga):** `add_weight_record`, `update_weight_record` available

**Gap:** General weight record editing not available in UI. Only acquisition weight can be edited via `EditAcquisitionWeightDialog`.

---

### 5. AI/BREEDING RECORDS ⚠️ Partial CRUD

| Operation | UI Component | Status |
|-----------|--------------|--------|
| Create | `ScheduleAIDialog.tsx` | Implemented |
| Read | `AIRecords.tsx` | Implemented |
| Update (status) | `MarkAIPerformedDialog.tsx`, `ConfirmPregnancyDialog.tsx` | Implemented (workflow-based) |
| Update (general) | — | **Missing in UI** |
| Delete | — | Missing |

**Backend (Doc Aga):** `add_ai_record`, `update_ai_record` available

**Gap:** Cannot edit scheduled date, technician, semen code, or notes after creation. Only status progression (Scheduled → Performed → Pregnant) is supported.

---

### 6. INJECTION RECORDS ❌ Minimal CRUD

| Operation | UI Component | Status |
|-----------|--------------|--------|
| Create | `ActivityConfirmation.tsx` (via voice/farmhand flow only) | Partial |
| Read | `MedicalTimeline.tsx` (embedded in timeline only) | Partial |
| Update | — | **Missing** |
| Delete | — | Missing |

**Backend (Doc Aga):** `add_injection_record`, `update_injection_record` available

**Gap:** 
- No dedicated injection records viewing component (only visible in MedicalTimeline)
- No standalone create dialog for direct injection entry
- No edit or delete functionality

---

## CRUD Matrix Summary

```text
Record Type      | Create | Read | Update | Delete | Doc Aga Update
-----------------|--------|------|--------|--------|----------------
Milking          |   ✅   |  ✅  |   ✅   |   ✅   |      ✅
Feeding          |   ✅   |  ✅  |   ✅   |   ❌   |      ✅
Health           |   ✅   |  ✅  |   ❌   |   ❌   |      ✅
Weight           |   ✅   |  ✅  |   ⚠️   |   ❌   |      ✅
AI/Breeding      |   ✅   |  ✅  |   ⚠️   |   ❌   |      ✅
Injection        |   ⚠️   |  ⚠️  |   ❌   |   ❌   |      ✅

Legend: ✅ = Full | ⚠️ = Partial | ❌ = Missing
```

---

## Implementation Priority

Based on usage frequency and data integrity impact:

### Priority 1 (High Impact)
1. **EditHealthRecordDialog** - Health record corrections are critical for veterinary accuracy
2. **EditWeightRecordDialog** - Weight tracking affects growth metrics and OVR calculations

### Priority 2 (Medium Impact)
3. **EditAIRecordDialog** - Allow editing of scheduled date, technician, semen code
4. **InjectionRecordsTab** - Dedicated viewing component with create/edit dialogs

### Priority 3 (Completeness)
5. **Delete dialogs** for all record types (with soft-delete consideration)
6. **DeleteFeedingRecordDialog** - Complete feeding CRUD

---

## Recommended Implementation Plan

### Phase 1: Health Record Edit (Highest Priority)

**Create:** `src/components/health-recording/EditHealthRecordDialog.tsx`

- Allow editing: `visit_date`, `diagnosis`, `treatment`, `notes`
- Pattern: Follow `EditMilkRecordDialog` structure
- Add edit buttons to `HealthRecords.tsx` record cards

**Schema considerations:**
- No inventory impact (simpler than feeding records)
- May need to invalidate OVR cache if health impacts scoring

### Phase 2: Weight Record Edit

**Create:** `src/components/weight-recording/EditWeightRecordDialog.tsx`

- Allow editing: `measurement_date`, `weight_kg`, `measurement_method`, `notes`
- Pattern: Follow `EditMilkRecordDialog` structure
- Add edit buttons to `WeightRecords.tsx` history table/cards

**SSOT Considerations:**
- Must update `animals.current_weight_kg` if editing the most recent record
- Invalidate OVR cache (weight affects ADG calculations)
- Invalidate feed consumption calculations

### Phase 3: AI Record Edit

**Create:** `src/components/breeding/EditAIRecordDialog.tsx`

- Allow editing: `scheduled_date`, `technician`, `semen_code`, `notes`
- Separate from pregnancy confirmation flow
- Add edit buttons to `AIRecords.tsx` record cards

### Phase 4: Injection Records Complete

**Create:**
1. `src/components/health-recording/InjectionRecordsTab.tsx` - Dedicated viewing
2. `src/components/health-recording/RecordInjectionDialog.tsx` - Standalone create
3. `src/components/health-recording/EditInjectionRecordDialog.tsx` - Edit capability

**Integration:**
- Add as sub-tab under Health tab in animal profile (alongside Records and Preventive)

---

## Files to Create

| File | Purpose | Priority |
|------|---------|----------|
| `src/components/health-recording/EditHealthRecordDialog.tsx` | Edit health records | P1 |
| `src/components/weight-recording/EditWeightRecordDialog.tsx` | Edit weight records | P2 |
| `src/components/breeding/EditAIRecordDialog.tsx` | Edit AI/breeding records | P3 |
| `src/components/health-recording/InjectionRecordsTab.tsx` | View injection records | P4 |
| `src/components/health-recording/RecordInjectionDialog.tsx` | Create injection record | P4 |
| `src/components/health-recording/EditInjectionRecordDialog.tsx` | Edit injection records | P4 |

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `src/components/HealthRecords.tsx` | Add edit buttons, integrate EditHealthRecordDialog | P1 |
| `src/components/WeightRecords.tsx` | Add edit buttons, integrate EditWeightRecordDialog | P2 |
| `src/components/AIRecords.tsx` | Add edit buttons, integrate EditAIRecordDialog | P3 |

---

## Technical Notes

1. All edit dialogs should follow the established pattern from `EditMilkRecordDialog`:
   - Haptic feedback on interactions
   - Online-only initially (matches existing patterns)
   - Query invalidation for related caches
   - Return before/after values for audit trail

2. Delete functionality should implement:
   - Confirmation dialogs
   - Undo capability (30-second window like milk records)
   - Soft delete consideration for audit compliance

3. Cache invalidation patterns to follow per `cacheManager.ts`:
   - Health: invalidate `health-records`, `dashboard`, `animal`
   - Weight: invalidate `weight-records`, `animals`, `feed-inventory`, `lactating-animals`
   - AI: invalidate `ai-records`, `dashboard`, `pregnant-animals`
