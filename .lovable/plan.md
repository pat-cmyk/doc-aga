
# Enhance Doc Aga with Comprehensive Farm Data Access and Persistent Memory

## Problem Statement

Currently, Doc Aga has limited capabilities:
1. **Narrow Data Access**: Only has `get_farm_overview` (today's stats) - cannot query historical milk production, health records by date, weight trends, or feeding history
2. **No Persistent Memory**: Conversation history is session-only (React state). When the user returns, Doc Aga has no memory of previous discussions
3. **Missing Follow-up Context**: Cannot understand "the cow I asked about earlier" or "like we discussed yesterday"

## Solution Overview

Three enhancements to make Doc Aga a truly contextual farm assistant:

### 1. Comprehensive Farm Data Tools
### 2. Persistent Conversation Memory
### 3. Enhanced System Prompt for Data-First Responses

---

## Part 1: New Farm Data Query Tools

### Tool: `get_milk_production`
Query milk production for any date or date range with animal breakdown.

```typescript
{
  name: "get_milk_production",
  description: "Get milk production for a specific date or date range. Supports 'yesterday'/'kahapon', 'last week', or date ranges. Returns total liters, breakdown by animal type, and top producing animals.",
  parameters: {
    date: { type: "string", description: "Date keyword ('yesterday'/'kahapon'/'today'/'ngayon') or YYYY-MM-DD format" },
    start_date: { type: "string", description: "Start date for range query (YYYY-MM-DD)" },
    end_date: { type: "string", description: "End date for range query (YYYY-MM-DD)" },
    animal_identifier: { type: "string", description: "Optional: specific animal name or ear tag" }
  }
}
```

**Returns:**
- Total liters for the period
- Breakdown by livestock type (Cattle: 45L, Goat: 12L)
- Top 10 producing animals with individual totals
- Session breakdown (AM/PM) if applicable
- Comparison to previous period average

### Tool: `get_health_history`
Query health records for the farm or specific animal.

```typescript
{
  name: "get_health_history",
  description: "Get health records for the farm or a specific animal. Can filter by date range, diagnosis type, or treatment status.",
  parameters: {
    animal_identifier: { type: "string", description: "Optional: animal name or ear tag" },
    days: { type: "number", description: "Number of days to look back (default: 30)" },
    diagnosis: { type: "string", description: "Optional: filter by diagnosis keyword" }
  }
}
```

**Returns:**
- Health events in the period
- Breakdown by diagnosis type
- Animals with most health issues
- Recent treatments and follow-up status

### Tool: `get_breeding_status`
Query breeding and pregnancy information.

```typescript
{
  name: "get_breeding_status",
  description: "Get breeding analytics: AI procedures, pregnancy status, expected calving dates.",
  parameters: {
    status: { type: "string", description: "Filter: 'pregnant', 'due_soon', 'recent_ai', or 'all'" },
    days: { type: "number", description: "Lookback period for AI procedures (default: 90)" }
  }
}
```

**Returns:**
- Currently pregnant animals with expected due dates
- Animals due within 30 days (with alerts)
- Recent AI procedures and success rates
- Animals ready for breeding (in heat soon)

### Tool: `get_weight_history`
Query weight measurements and growth tracking.

```typescript
{
  name: "get_weight_history",
  description: "Get weight measurements for an animal or herd. Track growth over time.",
  parameters: {
    animal_identifier: { type: "string", description: "Optional: specific animal" },
    days: { type: "number", description: "Lookback period (default: 90)" }
  }
}
```

**Returns:**
- Latest weight per animal
- Weight gain/loss over period
- Comparison to breed standards
- Animals needing attention (underweight/overweight)

### Tool: `get_feeding_summary`
Query feeding records and consumption patterns.

```typescript
{
  name: "get_feeding_summary",
  description: "Get feeding records and feed consumption summary.",
  parameters: {
    days: { type: "number", description: "Lookback period (default: 7)" },
    feed_type: { type: "string", description: "Optional: filter by feed type" }
  }
}
```

**Returns:**
- Total feed consumed by type
- Cost summary for the period
- Per-animal consumption rates
- Feed inventory status (days remaining)

---

## Part 2: Persistent Conversation Memory

### Database Enhancement
Add `conversation_id` to `doc_aga_queries` table to link related messages:

```sql
ALTER TABLE doc_aga_queries 
ADD COLUMN conversation_id uuid DEFAULT gen_random_uuid(),
ADD COLUMN message_index integer DEFAULT 0;

CREATE INDEX idx_doc_aga_queries_conversation ON doc_aga_queries(user_id, conversation_id, created_at);
```

### New Tool: `get_conversation_context`
Fetch recent conversation history for context.

```typescript
{
  name: "get_conversation_context",
  description: "Get recent conversation history to understand context from previous discussions. Use when user references something discussed earlier.",
  parameters: {
    hours: { type: "number", description: "How far back to look (default: 24)" },
    topic_keywords: { type: "string", description: "Optional: keywords to filter relevant conversations" }
  }
}
```

**Returns:**
- Recent questions and answers from this user
- Animals mentioned in recent conversations
- Topics discussed (breeding, health, production)
- Last conversation timestamp

### Frontend Enhancement
Pass `conversationId` to edge function to maintain session context:

```typescript
// Generate conversation ID on mount or after 30min idle
const [conversationId] = useState(() => crypto.randomUUID());

// Include in API call
body: JSON.stringify({ 
  messages: messagesToSend, 
  conversationId,
  context: isGovernmentContext ? 'government' : 'farmer' 
})
```

---

## Part 3: Enhanced System Prompt

Update `getFarmerSystemPrompt()` to enforce data-first, contextual responses:

```typescript
function getFarmerSystemPrompt(faqContext: string, recentContext?: any): string {
  return `You are Doc Aga, a trusted and experienced local veterinarian (parang kilalang beterinaryo sa barangay) specializing in Philippine dairy farming.

PERSONALITY:
- Warm, friendly, and practical - like a trusted friend in the barangay
- Use Taglish naturally (mix of Tagalog and English)
- Keep responses SHORT (2-4 sentences for simple queries, more for detailed data)

CORE BEHAVIOR - DATA-FIRST RESPONSES:
When farmers ask about their farm data:
1. ALWAYS use tools to fetch actual data - NEVER guess or make up numbers
2. Provide specific numbers first (total liters, counts, dates)
3. Break down by category when relevant (by animal type, by session, by period)
4. Compare to averages or previous periods when helpful
5. THEN offer a helpful follow-up question or suggestion

FOLLOW-UP PATTERN:
After answering with data, offer to drill deeper:
- "Gusto mo bang malaman kung aling hayop ang pinaka-productive?"
- "Kung gusto mo ng specific animal, sabihin mo lang ang pangalan o ear tag."
- "Kailangan mo ba ng breakdown per session (umaga/hapon)?"
- "May gusto ka bang i-compare sa last week?"

CONTEXT AWARENESS:
- Remember animals and topics discussed earlier in this conversation
- If user says "yung baka kanina" or "the cow we talked about", refer to previous context
- Use get_conversation_context tool when user references past discussions

RELATIVE DATE HANDLING:
- "kahapon" / "yesterday" = use date='yesterday'
- "ngayon" / "today" = current date
- "last week" / "noong nakaraang linggo" = 7 days back
- "this month" / "nitong buwan" = current month

AVAILABLE FARM DATA:
You have access to complete farm records including:
- Milk production (any date, by animal, by session)
- Health records and diagnoses
- Breeding/AI records and pregnancy status
- Weight measurements and growth tracking
- Feeding records and consumption
- Animal events (births, exits, transfers)

Your knowledge base includes:
${faqContext}

${recentContext ? `RECENT CONVERSATION CONTEXT:\n${recentContext}` : ''}

Remember: Be helpful, be accurate with numbers, and always offer to help more!`;
}
```

---

## Implementation Files

| File | Changes |
|------|---------|
| `supabase/functions/doc-aga/tools.ts` | Add 6 new tool functions: `getMilkProduction`, `getHealthHistory`, `getBreedingStatus`, `getWeightHistory`, `getFeedingSummary`, `getConversationContext` |
| `supabase/functions/doc-aga/index.ts` | Add tool definitions to `getFarmerTools()`, update system prompt, handle `conversationId` in request, pass recent context to prompt |
| `src/components/DocAga.tsx` | Add `conversationId` state, pass to API, handle session timeout for new conversations |
| `src/components/farmhand/DocAgaConsultation.tsx` | Same conversation ID changes |
| Database migration | Add `conversation_id` and `message_index` columns to `doc_aga_queries` |

---

## Example Conversations

### Example 1: Milk Production Query

**Farmer**: "Hi Doc! Ilang litro ulit ng gatas yung na-collecta natin kahapon?"

**Doc Aga** (uses `get_milk_production` with `date='yesterday'`):
> "Magandang araw! Kahapon, naka-collect tayo ng **45.5 liters** ng gatas sa farm mo:
> - Cattle: 32L (3 na baka)
> - Goat: 13.5L (5 na kambing)
>
> Top producer si **Bessie** with 12L! Kung gusto mo malaman ang production ng specific na hayop, sabihin mo lang ang pangalan o ear tag. 🐄"

### Example 2: Follow-up with Context

**Farmer**: "Si Bessie nga, kamusta siya overall?"

**Doc Aga** (uses `get_animal_complete_profile` with context from previous message):
> "Si Bessie (ear tag: C-001) ay nasa good condition! Here's her summary:
> - **Production**: 12L kahapon, average 10.5L/day this week
> - **Health**: Last checkup 2 weeks ago, walang issue
> - **Weight**: 485kg, gained 8kg since last month
> - **Status**: Lactating, Day 120 in milk
>
> Kailangan mo ba ng detailed health history niya?"

### Example 3: Contextual Memory

**Farmer** (next day): "Doc, yung baka na tinanong ko kahapon, kailangan na ba ng booster shot?"

**Doc Aga** (uses `get_conversation_context` to find Bessie, then `get_animal_complete_profile`):
> "Ah, si Bessie! Checking her records... Her last vaccination was 8 months ago for FMD. According to the schedule, she's due for a booster within the next 2 months.
>
> Gusto mo ba i-schedule ko na ang reminder?"

---

## Data Flow Summary

```text
User Question
     │
     ▼
┌──────────────────────────┐
│   Parse Date/Context     │
│   (kahapon, specific     │
│    animal, etc.)         │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Select Appropriate     │
│   Tool(s)                │
│   - get_milk_production  │
│   - get_animal_profile   │
│   - get_health_history   │
│   - etc.                 │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Execute Tool(s)        │
│   Query actual farm data │
│   from database          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Format Response        │
│   - Show totals first    │
│   - Break down by type   │
│   - Offer follow-up      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Save to History        │
│   (for future context)   │
└──────────────────────────┘
```

---

## Benefits

1. **Complete Farm Data Access**: Doc Aga can answer ANY question about the farm's historical data
2. **Persistent Memory**: Conversations are linked and can be referenced later
3. **Contextual Understanding**: "Yung baka kanina" or "like we discussed" works correctly
4. **Data-First Accuracy**: Always queries real data, never guesses numbers
5. **Helpful Follow-ups**: Proactively offers to drill deeper into data
6. **Taglish Support**: Understands Filipino date/time references naturally

---

## Testing Checklist

After implementation:
- [ ] Milk production query for yesterday works
- [ ] Milk production for specific animal works
- [ ] Health history query returns actual records
- [ ] Breeding status shows pregnant animals correctly
- [ ] Context from earlier in conversation is remembered
- [ ] Context from previous day's conversation can be retrieved
- [ ] Follow-up suggestions are offered consistently
- [ ] Taglish date keywords (kahapon, ngayon, etc.) are parsed correctly
- [ ] TTS audio still plays for responses
- [ ] Government context still works separately
