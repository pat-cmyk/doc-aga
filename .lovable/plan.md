
# Add Date Context and Farm Data Boundaries to Doc Aga

## Problem Summary

Doc Aga confused "January 25" (2026) with January 25, 2024 because:
1. **No current date in system prompt** - The AI doesn't know what "today" is
2. **No farm data boundaries** - The AI doesn't know when the farm was created or when records started
3. **No visual date reference** - Users have no banner showing the current Philippine date/time

## Solution Overview

### Part 1: Add Philippine Time Banner to Dashboard Headers
Display the current date and time (Philippine Standard Time, 12-hour format) prominently below the farm name in both farmer and farmhand dashboards.

### Part 2: Inject Date Context into Doc Aga System Prompt
Add current date/time and farm data boundaries directly into the system prompt so Doc Aga knows:
- Exact current date and time (Philippine timezone)
- Farm creation date (when the farm was established in the system)
- Earliest available record date (first milk/health/weight record)

### Part 3: Add Farm Context Tool for Comprehensive Date Boundaries
Create a new `get_farm_context` tool that fetches farm metadata and data boundaries, which Doc Aga can use when dates are ambiguous.

---

## Part 1: Philippine Time Banner Component

### New Component: `PhilippineTimeBanner.tsx`

A real-time clock display showing:
- Full date: "Monday, January 27, 2026"
- Time: "2:30 PM PHT"
- Updates every minute

```typescript
// src/components/ui/PhilippineTimeBanner.tsx
const PhilippineTimeBanner = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);
  
  // Format for Philippine timezone
  const formatter = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return (
    <div className="text-xs text-muted-foreground">
      📅 {formatter.format(currentTime)} PHT
    </div>
  );
};
```

### Integration Points

Add the banner to both dashboard headers:

1. **`src/pages/Dashboard.tsx`** - Farmer dashboard header (below farm name)
2. **`src/pages/FarmhandDashboard.tsx`** - Farmhand dashboard header (below "Farmhand Dashboard")

---

## Part 2: Enhanced System Prompt with Date Context

### Modified `getFarmerSystemPrompt()` in `doc-aga/index.ts`

Pass date context as a parameter and include it in the prompt:

```typescript
function getFarmerSystemPrompt(
  faqContext: string, 
  dateContext: { 
    currentDate: string; 
    farmCreatedAt: string | null; 
    earliestRecordDate: string | null 
  },
  recentContext?: string
): string {
  return `You are Doc Aga...

CRITICAL DATE CONTEXT:
- Current date and time: ${dateContext.currentDate} (Philippine Standard Time, UTC+8)
- Farm creation date: ${dateContext.farmCreatedAt || 'Unknown'}
- Earliest data record: ${dateContext.earliestRecordDate || 'No records yet'}

IMPORTANT DATE RULES:
1. When a user says a date without a year (e.g., "January 25"), ALWAYS assume the CURRENT year (2026) unless explicitly stated otherwise
2. If the requested date is BEFORE the earliest data record, politely inform the user: "Wala pa tayong records noon kasi ang farm ay na-register lang noong [farm creation date]"
3. If the date is in the future, clarify: "Hindi pa dumadating ang date na 'yan. Today is [current date]"
4. Always use Philippine Standard Time (UTC+8) for all date calculations

...rest of existing prompt...
`;
}
```

### Fetch Farm Context Before Building Prompt

In the main handler, fetch farm metadata including earliest record dates:

```typescript
// In serve() handler, after fetching farmId:
let dateContext = {
  currentDate: new Date().toLocaleString('en-PH', { 
    timeZone: 'Asia/Manila',
    weekday: 'long',
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) + ' PHT',
  farmCreatedAt: null as string | null,
  earliestRecordDate: null as string | null
};

if (farmId) {
  // Get farm creation date
  const { data: farmData } = await supabase
    .from('farms')
    .select('created_at')
    .eq('id', farmId)
    .single();
  
  if (farmData?.created_at) {
    dateContext.farmCreatedAt = new Date(farmData.created_at)
      .toLocaleDateString('en-PH', { 
        timeZone: 'Asia/Manila', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
  }
  
  // Get earliest record date across all record types
  const { data: earliestMilk } = await supabase
    .from('milking_records')
    .select('record_date, animals!inner(farm_id)')
    .eq('animals.farm_id', farmId)
    .order('record_date', { ascending: true })
    .limit(1);
  
  const { data: earliestHealth } = await supabase
    .from('health_records')
    .select('record_date, animals!inner(farm_id)')
    .eq('animals.farm_id', farmId)
    .order('record_date', { ascending: true })
    .limit(1);
  
  // Find the earliest of all record types
  const dates = [
    earliestMilk?.[0]?.record_date,
    earliestHealth?.[0]?.record_date
  ].filter(Boolean).map(d => new Date(d!));
  
  if (dates.length > 0) {
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    dateContext.earliestRecordDate = earliest.toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

// Then pass to prompt:
const systemPrompt = getFarmerSystemPrompt(faqContext, dateContext, recentContext);
```

---

## Part 3: New `get_farm_context` Tool (Optional Enhancement)

Add a tool for Doc Aga to explicitly request farm context when needed:

```typescript
// In getFarmerTools():
{
  type: "function",
  function: {
    name: "get_farm_context",
    description: "Get farm metadata including creation date, earliest data records, and data coverage summary. Use when user asks about dates that might be before the farm existed or when clarifying date context.",
    parameters: {
      type: "object",
      properties: {}
    }
  }
}

// In tools.ts - getFarmContext():
async function getFarmContext(supabase: SupabaseClient, farmId: string | undefined) {
  if (!farmId) return { error: "No farm found" };
  
  const { data: farm } = await supabase
    .from('farms')
    .select('name, created_at')
    .eq('id', farmId)
    .single();
  
  // Get data range for each record type
  const { data: milkRange } = await supabase
    .from('milking_records')
    .select('record_date, animals!inner(farm_id)')
    .eq('animals.farm_id', farmId)
    .order('record_date', { ascending: true });
  
  const milkDates = milkRange?.map(r => r.record_date) || [];
  
  return {
    farm_name: farm?.name,
    farm_created: farm?.created_at ? new Date(farm.created_at).toISOString().split('T')[0] : null,
    current_date: new Date().toISOString().split('T')[0],
    current_time_pht: new Date().toLocaleString('en-PH', { 
      timeZone: 'Asia/Manila', 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }),
    data_coverage: {
      milk_records: {
        earliest: milkDates[0] || null,
        latest: milkDates[milkDates.length - 1] || null,
        total_records: milkDates.length
      }
      // Can add health, weight, etc.
    },
    message: `This farm was created on ${farm?.created_at ? new Date(farm.created_at).toLocaleDateString() : 'unknown date'}. Data records exist from ${milkDates[0] || 'no records'} to ${milkDates[milkDates.length - 1] || 'no records'}.`
  };
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| **NEW** `src/components/ui/PhilippineTimeBanner.tsx` | Create real-time PHT clock component |
| `src/pages/Dashboard.tsx` | Add PhilippineTimeBanner below farm name in header |
| `src/pages/FarmhandDashboard.tsx` | Add PhilippineTimeBanner below "Farmhand Dashboard" |
| `supabase/functions/doc-aga/index.ts` | Fetch farm context, update getFarmerSystemPrompt with date context |
| `supabase/functions/doc-aga/tools.ts` | Add getFarmContext tool function |

---

## Example Conversations After Fix

### Before (Current Broken Behavior)

**User**: "Ilang litro ng gatas nung January 25?"
**Doc Aga**: "Base sa records, wala tayong naitalang gatas nung January 25, 2024."

### After (Fixed Behavior)

**User**: "Ilang litro ng gatas nung January 25?"
**Doc Aga**: "Checking records for January 25, 2026... Naka-collect tayo ng 32.5 liters!
- AM session: 18L
- PM session: 14.5L

Top producer si Bessie with 11L. May gusto ka pa bang malaman?"

### Edge Case: Date Before Farm Existed

**User**: "Anong records natin noong December 2023?"
**Doc Aga**: "Sorry po, wala pa tayong records noong December 2023 kasi ang farm ay na-register lang noong September 30, 2025. Ang earliest na data natin ay December 24, 2024.

Gusto mo bang tignan ang records mula December 2024?"

---

## Technical Details

### Philippine Time Calculation
```typescript
// Always use this for PHT
const phTime = new Date().toLocaleString('en-PH', { 
  timeZone: 'Asia/Manila',
  // ... format options
});
```

### Date Banner Format Examples
- Full: "Monday, January 27, 2026, 2:30 PM PHT"
- Compact (mobile): "Jan 27, 2026 • 2:30 PM"

### Performance Considerations
- Farm context query adds ~50-100ms to first request but provides critical context
- Date banner updates every 60 seconds (not every second) to minimize re-renders
- Earliest record query is cached implicitly by React Query if using hooks

---

## Testing Checklist

After implementation:
- [ ] PHT banner displays correctly in farmer dashboard header
- [ ] PHT banner displays correctly in farmhand dashboard header
- [ ] Banner updates time every minute
- [ ] Doc Aga responds with correct year (2026) for "January 25" queries
- [ ] Doc Aga correctly identifies dates before farm creation
- [ ] Doc Aga correctly identifies dates before earliest records
- [ ] get_farm_context tool returns accurate data boundaries
- [ ] Edge function logs show date context being passed
