

# Add Tooltip Definitions to Lifecycle Action Buttons

## Overview

Add mouse-over tooltips to each of the 8 lifecycle action buttons explaining what they do and when to use them. Follow the existing SSOT glossary pattern used throughout the app.

## Approach

Reuse the existing architecture:
- **SSOT definitions** in `src/lib/urgencyGlossary.ts` (same file that holds all other glossary entries)
- **Tooltip component** from `src/components/ui/tooltip.tsx` (same pattern as `DefinitionBadge`)

## Implementation

### Step 1: Add lifecycle action definitions to urgencyGlossary.ts

Add a new `BREEDING_LIFECYCLE_ACTIONS` glossary section with entries for all 8 milestones:

| Action | Tooltip Definition |
|--------|-------------------|
| Record Heat | Log when an animal shows signs of estrus (standing heat, mucus, restlessness). Use this to start the breeding window timer. |
| Schedule AI | Book an artificial insemination appointment. Use after detecting heat -- ideally within 12-18 hours of standing heat. |
| Record Calving | Log a birth event. Use when the animal delivers a calf. This resets her cycle to postpartum recovery. |
| Suspected Pregnant | Mark non-return to heat 18-24 days after AI. Use when no heat signs reappear, suggesting breeding was successful. |
| Confirm Pregnancy | Verify pregnancy via ultrasound or rectal palpation, typically 28-35 days post-AI. |
| Pregnancy Failed | Record a negative pregnancy check or pregnancy loss. The animal returns to Open and Cycling status. |
| Heat Returned | The animal came back into heat after breeding, meaning the previous AI was unsuccessful. |
| VWP Complete | The voluntary waiting period (60 days postpartum) has ended. The animal is now eligible for breeding again. |

Each entry will include bilingual descriptions (English + Tagalog) following the existing `UrgencyDefinition`-like structure.

### Step 2: Wrap each button with Tooltip in AIRecords.tsx

In the Lifecycle Actions card, wrap each button component with `TooltipProvider > Tooltip > TooltipTrigger + TooltipContent`, pulling the description text from the SSOT glossary. This follows the exact same pattern as `DefinitionBadge`.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/urgencyGlossary.ts` | Add `BREEDING_LIFECYCLE_ACTIONS` glossary definitions |
| `src/components/AIRecords.tsx` | Wrap each lifecycle button with Tooltip using glossary definitions |

## Why This Approach

- Reuses the existing `urgencyGlossary.ts` SSOT pattern -- definitions are centralized, not scattered across components
- Reuses the existing Tooltip component -- no new UI primitives needed
- Bilingual support built in, consistent with the rest of the app
- Tooltips only appear on hover/focus, keeping the UI clean on mobile
