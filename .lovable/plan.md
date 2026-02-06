
# RICO Persistent Memory Implementation Plan

## Problem Statement

RICO currently has **no persistent memory** across sessions. Each time a government user opens the RICO chat panel, a fresh `conversationId` is generated and previous discussions are lost. This is problematic because:

1. **Multiple government users** will use RICO for different oversight areas
2. **Users expect continuity** - "Remember we discussed Region VIII feed issues yesterday?"
3. **Topic specialization** - A user monitoring breeding programs shouldn't re-explain their focus each session

---

## Current Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        CURRENT STATE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RicoChat Component                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ conversationId = crypto.randomUUID() ← NEW EACH MOUNT       │   │
│  │ messages = [] ← STARTS EMPTY                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  RICO Edge Function                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Receives: messages[], conversationId, dataCategory          │   │
│  │ Logs to: doc_aga_queries                                    │   │
│  │ NO TOOL to retrieve past conversations                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Gap**: Data is logged but never retrieved. RICO cannot access previous user discussions.

---

## Proposed Solution

### Phase 1: Add Conversation Context Tool (Immediate)

Add a `get_user_conversation_context` tool to RICO (similar to Doc Aga's `get_conversation_context`).

**New Tool Definition:**
```text
get_user_conversation_context
├── Description: Retrieve recent conversation history for the current user
├── Parameters:
│   ├── hours: number (default: 168 = 7 days)
│   └── topic_keywords: string (optional filter)
└── Returns:
    ├── has_recent_context: boolean
    ├── total_conversations: number
    ├── topics_discussed: string[] (extracted from questions)
    └── recent_conversations: Array<{question, answer_preview, date}>
```

**SSOT Compliance:**
- Queries `doc_aga_queries` filtered by `user_id` only
- No dataCategory filter needed (conversations are user-specific, not farm-specific)
- Returns summarized context, not raw data

### Phase 2: Update System Prompt

Add context awareness to RICO's system prompt:

```text
CONVERSATION CONTINUITY:
- You have access to the user's previous discussions via get_user_conversation_context
- When a user references past topics ("like we discussed" / "remember the Region VIII issue"), 
  use this tool to recall context
- Acknowledge returning users: "Welcome back! Last time we discussed X..."
- Track the user's areas of focus to provide more relevant insights
```

### Phase 3: Session Persistence (Frontend)

Update `RicoChat.tsx` to optionally load previous conversation from the same user:

**Option A: Auto-load recent context**
- On mount, fetch last 3 Q&A pairs from `doc_aga_queries` for this user
- Pre-populate messages array with context

**Option B: Offer to continue**
- On mount, check if user has recent conversations
- Show "Continue previous discussion?" button

---

## Technical Implementation

### File: `supabase/functions/_shared/analyst-tools.ts`

Add new function:

```typescript
async function getUserConversationContext(
  args: any,
  supabase: SupabaseClient,
  userId: string,
  _dataCategory?: DataCategory // Not used but kept for SSOT consistency
) {
  const hours = args.hours || 168; // Default 7 days
  const topicKeywords = args.topic_keywords;
  const sinceTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  console.log(`[RICO] getUserConversationContext: Fetching last ${hours} hours for user`);

  let query = supabase
    .from('doc_aga_queries')
    .select('question, answer, created_at, conversation_id')
    .eq('user_id', userId)
    .is('farm_id', null) // RICO conversations have null farm_id
    .gte('created_at', sinceTime)
    .order('created_at', { ascending: false })
    .limit(20);

  // Optional keyword filter
  if (topicKeywords) {
    query = query.or(`question.ilike.%${topicKeywords}%,answer.ilike.%${topicKeywords}%`);
  }

  const { data: recentQueries, error } = await query;

  if (error) {
    console.error('[RICO] getUserConversationContext error:', error);
    return { error: error.message };
  }

  if (!recentQueries || recentQueries.length === 0) {
    return {
      has_recent_context: false,
      message: "This appears to be a new user or no recent RICO conversations found."
    };
  }

  // Extract topic patterns from questions
  const topicPatterns = extractTopics(recentQueries.map(q => q.question));

  return {
    has_recent_context: true,
    hours_covered: hours,
    total_conversations: recentQueries.length,
    unique_sessions: new Set(recentQueries.map(q => q.conversation_id)).size,
    topics_discussed: topicPatterns,
    recent_conversations: recentQueries.slice(0, 5).map(q => ({
      question: q.question.slice(0, 200),
      answer_preview: q.answer?.slice(0, 300),
      date: q.created_at
    }))
  };
}

// Helper to extract topic patterns
function extractTopics(questions: string[]): string[] {
  const topicKeywords = [
    'semen', 'breeding', 'AI', 'genetics',
    'grant', 'program', 'ROI',
    'feed', 'security', 'shortage',
    'vaccination', 'health', 'mortality',
    'market', 'price', 'revenue',
    'compliance', 'audit', 'discrepancy',
    'Region', 'province', 'national'
  ];
  
  const found = new Set<string>();
  questions.forEach(q => {
    topicKeywords.forEach(keyword => {
      if (q.toLowerCase().includes(keyword.toLowerCase())) {
        found.add(keyword);
      }
    });
  });
  
  return Array.from(found);
}
```

### File: `supabase/functions/rico/index.ts`

**1. Add tool to `getAnalystTools()`:**

```typescript
{
  type: "function",
  function: {
    name: "get_user_conversation_context",
    description: "Get the current user's recent RICO conversation history. Use this when the user references previous discussions, says 'remember when we discussed', or asks to continue from before. Also use at the start to understand the user's focus areas.",
    parameters: {
      type: "object",
      properties: {
        hours: { type: "number", description: "Lookback period in hours (default: 168 = 7 days)" },
        topic_keywords: { type: "string", description: "Optional: filter by topic like 'breeding', 'feed security', 'Region VIII'" }
      }
    }
  }
}
```

**2. Update System Prompt:**

Add to RICO's personality:

```text
CONVERSATION MEMORY & CONTINUITY:
- You have access to the user's previous RICO discussions via get_user_conversation_context
- When a user references past topics ("like we discussed", "remember the Region VIII issue", "following up on..."), use this tool to recall context
- For returning users, acknowledge continuity: "Based on our previous discussions about X..."
- Track the user's areas of focus (breeding, feed security, regional monitoring) to provide more relevant insights
- If a question seems to reference prior context but is ambiguous, use the tool to clarify before answering
```

**3. Add to `executeAnalystToolCall()`:**

```typescript
case 'get_user_conversation_context':
  return await getUserConversationContext(args, supabase, userId, dataCategory);
```

---

## Database Considerations

### Current `doc_aga_queries` Schema (No Changes Needed)

| Column | Type | Usage |
|--------|------|-------|
| `user_id` | uuid | ✅ User isolation |
| `farm_id` | uuid | NULL for RICO (government-level) |
| `question` | text | ✅ Stores user query |
| `answer` | text | ✅ Stores RICO response |
| `conversation_id` | uuid | ✅ Session grouping |
| `message_index` | integer | ✅ Order within session |
| `created_at` | timestamp | ✅ Time-based queries |

The existing schema supports user-specific memory retrieval without modification.

---

## Optional Enhancement: User Focus Areas

For deeper personalization, consider adding a `government_user_context` table:

```sql
CREATE TABLE government_user_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  focus_areas text[] DEFAULT '{}', -- e.g., ['breeding', 'Region VIII']
  preferred_regions text[] DEFAULT '{}',
  last_active_at timestamptz DEFAULT now(),
  conversation_summary text, -- AI-generated summary of interests
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS: Users can only see/update their own context
ALTER TABLE government_user_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own context" ON government_user_context
  FOR ALL USING (auth.uid() = user_id);
```

This would allow RICO to:
- Remember "This user always focuses on Region VIII and breeding programs"
- Auto-filter recommendations to their areas of interest
- Provide personalized greetings: "Good morning! Ready to check on Region VIII breeding stats?"

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/analyst-tools.ts` | Add `getUserConversationContext()` function (~60 lines) |
| `supabase/functions/rico/index.ts` | Add tool definition, update system prompt, add case to dispatcher |

---

## Testing Plan

1. **First-time user test**: RICO should note "no recent context"
2. **Returning user test**: After asking about feed security, close chat, reopen, ask "what did we discuss?" - RICO should recall
3. **Topic filter test**: Ask RICO to recall "breeding discussions" - should filter appropriately
4. **Multi-user isolation**: Ensure User A cannot see User B's conversations

---

## Summary

| Feature | Current | After Implementation |
|---------|---------|---------------------|
| Session memory | ✅ | ✅ |
| Cross-session memory | ❌ | ✅ via tool |
| Topic tracking | ❌ | ✅ extracted from history |
| User focus areas | ❌ | ✅ (optional table) |
| Data isolation | N/A | ✅ by user_id |

This implementation follows SSOT principles by:
- Querying the existing `doc_aga_queries` table (single source)
- Using user_id filtering (not dataCategory, as conversations are user-specific)
- Logging all interactions for future context retrieval
