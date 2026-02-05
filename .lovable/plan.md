
# Fix Doc Aga Analyst Persona and Create App-Wide Tag/Banner Glossary

## Problem Analysis

### Issue 1: Persona Conflict in Doc Aga - Analyst

The current implementation has a critical persona conflict:

| Aspect | Expected Behavior | Current Behavior |
|--------|-------------------|------------------|
| Welcome Message | "I'm your Analyst Assistant for livestock sector data..." | Farm assistant message about animal records |
| Quick Actions | "View National Stats", "Breeding Trends", "Health Analytics" | "Log Activity", "Report Issue" (farmer actions) |
| Input Modes | Text only (Chat) | Chat, Voice, Image tabs shown |
| Role | Interpret aggregate data across ALL farms | Suggests recording farm-level data |
| Data Entry | NEVER - read-only analysis | Offers to log records |

**Root Cause**: The `DocAga.tsx` component doesn't customize:
1. Welcome message for government context
2. Quick actions for analyst role
3. Input method tabs (Voice/Image are farmer-specific)

### Issue 2: Missing Tag/Banner Definitions

The AI couldn't explain what "Urgent" means in the Expected Deliveries context because there's no centralized glossary. Currently, urgency definitions are scattered:

| Domain | Term | Definition | Location |
|--------|------|------------|----------|
| Deliveries | Urgent | Due within 30 days | `ExpectedDeliveriesTimeline.tsx` (hardcoded) |
| Health Alerts | Overdue | Past due date | `useUpcomingAlerts.ts` |
| Health Alerts | Urgent | Within 2 days | `useUpcomingAlerts.ts` |
| Feed Expiry | Critical | Within 7 days | `useFeedExpiryAlerts.ts` |
| Breeding | Critical | In heat now / repeat breeder | `useBreedingAlerts.ts` |
| Data Gaps | Critical | 3+ days without records | `useDataGapAlerts.ts` |
| Health Status | Critical | Mortality >= 20% | `AnimalHealthHeatmap.tsx` |
| Feedback | Urgent | Sentiment = urgent | `SentimentTrendChart.tsx` |

---

## Solution Design

### Part 1: Fix Government Analyst Persona

**File: `src/components/DocAga.tsx`**

Changes:
1. Add government-specific welcome message
2. Add government-specific quick actions
3. Hide Voice/Image tabs for government context (text-only analysis)
4. Remove "Recording Mode" and data entry intents for government

**Government Welcome Message:**
```
"I'm Doc Aga Analytics, your livestock sector intelligence assistant. I can:

• Provide national/regional livestock statistics
• Analyze breeding trends and AI success rates
• Track health patterns across all farms
• Monitor production metrics and forecasts
• Summarize farmer feedback and priority issues

I analyze aggregate data across all registered farms. How can I help you today?"
```

**Government Quick Actions:**
```typescript
[
  { icon: BarChart3, label: "National Overview", prompt: "Show me national livestock statistics", color: "text-blue-600" },
  { icon: TrendingUp, label: "Breeding Analytics", prompt: "What are the breeding trends and AI success rates?", color: "text-green-600" },
  { icon: Activity, label: "Health Trends", prompt: "Show me health patterns across the sector", color: "text-orange-600" },
  { icon: MessageSquare, label: "Farmer Feedback", prompt: "Summarize recent farmer feedback and priority issues", color: "text-purple-600" },
]
```

### Part 2: Create Centralized Tag/Banner Glossary

**New File: `src/lib/urgencyGlossary.ts`**

This will be the Single Source of Truth (SSOT) for all urgency/status definitions used app-wide, with:
- English and Tagalog labels
- Precise thresholds
- Context-specific meanings
- Color mappings

**Structure:**
```typescript
export interface UrgencyDefinition {
  level: string;
  label: string;
  labelTagalog: string;
  description: string;
  descriptionTagalog: string;
  threshold: string;
  color: string;
  textClass: string;
  bgClass: string;
}

export const URGENCY_GLOSSARY = {
  // Domain-specific urgency definitions
  expectedDeliveries: { ... },
  healthAlerts: { ... },
  feedExpiry: { ... },
  breedingAlerts: { ... },
  dataGaps: { ... },
  healthStatus: { ... },
  feedback: { ... },
};
```

### Part 3: Update Government Analyst System Prompt

**File: `supabase/functions/doc-aga/index.ts`**

Enhance `getGovernmentAnalystPrompt()` to include:
1. Explicit prohibition on data recording/entry suggestions
2. Reference to the urgency glossary for accurate term definitions
3. Dashboard context awareness

**Enhanced Prompt Addition:**
```
CRITICAL RESTRICTIONS:
- You are a READ-ONLY analyst. You CANNOT and should NOT:
  - Suggest recording data
  - Offer to log activities
  - Ask about individual animal records
  - Prompt for voice or image inputs
- If asked to record something, clarify: "As an analyst assistant, I provide insights from existing data. For data entry, please use the farm dashboard directly."

DASHBOARD TERMINOLOGY:
When explaining dashboard metrics, use these exact definitions:

Expected Deliveries:
- "Urgent" = Due within 30 days from today
- Shows animals with confirmed pregnancies and calculated expected_delivery_date

Breeding Analytics:
- "AI Success Rate" = (Confirmed pregnancies / Total AI procedures performed) × 100
- "Currently Pregnant" = Animals with pregnancy_confirmed = true

Health Status Severity:
- "Critical" = Mortality/morbidity rate >= 20%
- "High" = Rate >= 10%
- "Moderate" = Rate >= 5%
- "Low" = Rate < 5%

Feed Security:
- "Critical" = Less than 7 days of stock remaining
- "Warning" = Less than 30 days of stock remaining
```

---

## Implementation Steps

### Step 1: Create Urgency Glossary (New File)
Create `src/lib/urgencyGlossary.ts` with comprehensive definitions for all urgency/status terms.

### Step 2: Update DocAga Component
Modify `src/components/DocAga.tsx`:
- Add conditional welcome message
- Add conditional quick actions
- Conditionally hide Voice/Image tabs
- Import glossary for reference

### Step 3: Enhance Government Analyst Prompt
Update `supabase/functions/doc-aga/index.ts`:
- Add explicit read-only restrictions
- Include dashboard terminology section
- Reference urgency definitions

---

## Expected Outcomes

### Doc Aga - Analyst After Fix:

| Aspect | Behavior |
|--------|----------|
| Welcome | "I'm your livestock sector intelligence assistant..." |
| Quick Actions | National Overview, Breeding Analytics, Health Trends, Farmer Feedback |
| Input | Text chat only (no Voice/Image tabs) |
| Responses | Never suggests recording, only interprets data |
| Terminology | Uses precise definitions (e.g., "Urgent = due within 30 days") |

### Glossary Benefits:

1. **Consistency**: All components reference same definitions
2. **AI Context**: Doc Aga can accurately explain dashboard terms
3. **Maintainability**: Single place to update thresholds
4. **Bilingual**: English and Tagalog support built-in
5. **Documentation**: Serves as developer and user reference

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/urgencyGlossary.ts` | CREATE | SSOT for all urgency/status definitions |
| `src/components/DocAga.tsx` | MODIFY | Government-specific UI and behavior |
| `supabase/functions/doc-aga/index.ts` | MODIFY | Enhanced analyst prompt with restrictions |

---

## Technical Details

### Urgency Glossary Structure

```typescript
// Example structure for src/lib/urgencyGlossary.ts

export const EXPECTED_DELIVERIES_URGENCY = {
  urgent: {
    level: 'urgent',
    label: 'Urgent',
    labelTagalog: 'Kagyat',
    description: 'Expected delivery within 30 days',
    descriptionTagalog: 'Inaasahang panganganak sa loob ng 30 araw',
    threshold: '<= 30 days',
    textClass: 'text-destructive',
    bgClass: 'bg-orange-500/5',
  },
  upcoming: {
    level: 'upcoming',
    label: 'Upcoming',
    labelTagalog: 'Paparating',
    description: 'Expected delivery beyond 30 days',
    descriptionTagalog: 'Inaasahang panganganak lampas sa 30 araw',
    threshold: '> 30 days',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
  },
};

export const HEALTH_ALERT_URGENCY = {
  overdue: {
    level: 'overdue',
    label: 'Overdue',
    labelTagalog: 'Lampas na',
    description: 'Past the scheduled date',
    descriptionTagalog: 'Lagpas na sa nakatakdang petsa',
    threshold: 'days_until_due < 0',
    textClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  urgent: {
    level: 'urgent',
    label: 'Urgent',
    labelTagalog: 'Kagyat',
    description: 'Due within 2 days',
    descriptionTagalog: 'Kailangan sa loob ng 2 araw',
    threshold: 'days_until_due <= 2',
    textClass: 'text-orange-600',
    bgClass: 'bg-orange-50',
  },
  soon: {
    level: 'soon',
    label: 'Soon',
    labelTagalog: 'Malapit na',
    description: 'Due within 7 days',
    descriptionTagalog: 'Kailangan sa loob ng 7 araw',
    threshold: 'days_until_due <= 7',
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-50',
  },
  upcoming: {
    level: 'upcoming',
    label: 'Upcoming',
    labelTagalog: 'Paparating',
    description: 'Scheduled beyond 7 days',
    descriptionTagalog: 'Nakatakda lampas sa 7 araw',
    threshold: 'days_until_due > 7',
    textClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
  },
};

// Similar structures for:
// - FEED_EXPIRY_URGENCY
// - BREEDING_ALERT_URGENCY  
// - DATA_GAP_URGENCY
// - HEALTH_STATUS_SEVERITY
// - FEEDBACK_SENTIMENT

// Helper function for Doc Aga prompt
export function getUrgencyGlossaryForPrompt(): string {
  return `
DASHBOARD TERMINOLOGY DEFINITIONS:

Expected Deliveries Timeline:
- "Urgent" = Due within 30 days from current date
- Shows pregnant animals with expected_delivery_date set

Health Alerts:
- "Overdue" = Past the scheduled vaccination/deworming date
- "Urgent" = Due within 2 days
- "Soon" = Due within 7 days
- "Upcoming" = Scheduled beyond 7 days

Feed Inventory:
- "Expired" = Past expiry date
- "Critical" = Expires within 7 days
- "Warning" = Expires within 14 days
- "Upcoming" = Expires within 30 days

Breeding Alerts:
- "Critical" = Animal in heat now OR repeat breeder (5+ failed services)
- "Warning" = Pregnancy check overdue OR proestrus (1 day to heat)
- "Info" = VWP ending soon OR proestrus (2-3 days to heat)

Data Recording Gaps:
- "Critical" = 3+ days without milking/feeding records
- "Warning" = 2 days without records
- "Info" = 1 day gap

Health Status Severity (for regions/municipalities):
- "Critical" = Mortality/morbidity rate >= 20%
- "High" = Rate >= 10%
- "Moderate" = Rate >= 5%
- "Low" = Rate < 5%

Farmer Feedback Sentiment:
- "Urgent" = Requires immediate government attention
- "Negative" = Concern or complaint
- "Neutral" = General inquiry or observation
- "Positive" = Appreciation or success story
`;
}
```
