
# AI Learning & Feedback Enhancement Plan

## Overview

This plan implements two interconnected learning features for Doc Aga:

1. **Thumbs Up/Down Feedback** - Farmers rate AI responses for quality tracking
2. **Automatic FAQ Candidate Extraction** - System identifies frequent unmatched questions for knowledge base enrichment

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Farmer Interface                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DocAgaConsultation.tsx                                 │   │
│  │  [AI Response] [👍] [👎]                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database Layer                               │
│  ┌──────────────────────┐    ┌─────────────────────────────┐   │
│  │ doc_aga_queries      │    │ faq_candidates              │   │
│  │ + feedback_rating    │    │ (NEW TABLE)                 │   │
│  │ + feedback_comment   │    │ - question_text             │   │
│  │ + feedback_at        │    │ - similar_count             │   │
│  └──────────────────────┘    │ - sample_query_ids          │   │
│                              │ - status (pending/approved) │   │
│                              └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Admin Dashboard                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DocAgaManagement.tsx                                   │   │
│  │  - Feedback Analytics Tab                               │   │
│  │  - FAQ Candidates Tab (review & approve)                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Changes Overview

| Component | Changes |
|-----------|---------|
| Database Migration | Add feedback columns to `doc_aga_queries`, create `faq_candidates` table |
| Edge Function | New `extract-faq-candidates` for clustering similar questions |
| DocAgaConsultation.tsx | Add thumbs up/down buttons after AI responses |
| DocAgaManagement.tsx | Add Feedback Analytics tab and FAQ Candidates review tab |
| New Hook | `useDocAgaFeedback.ts` for submitting ratings |

---

## Part 1: Thumbs Up/Down Feedback Mechanism

### 1.1 Database Schema Changes

Add columns to `doc_aga_queries`:

```sql
ALTER TABLE public.doc_aga_queries
ADD COLUMN feedback_rating text CHECK (feedback_rating IN ('positive', 'negative')),
ADD COLUMN feedback_comment text,
ADD COLUMN feedback_at timestamptz;
```

RLS policies already allow users to update their own queries.

### 1.2 UI Component Changes

**File: `src/components/farmhand/DocAgaConsultation.tsx`**

Add to Message interface:
```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  showText?: boolean;
  queryId?: string;        // NEW: Links to doc_aga_queries.id
  feedbackRating?: 'positive' | 'negative' | null;  // NEW
}
```

Add feedback buttons below each assistant message:
```typescript
{message.role === "assistant" && message.queryId && (
  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
    <span className="text-xs text-muted-foreground mr-2">Nakatulong ba?</span>
    <Button
      size="sm"
      variant={message.feedbackRating === 'positive' ? 'default' : 'ghost'}
      className="h-7 w-7 p-0"
      onClick={() => handleFeedback(index, 'positive')}
    >
      <ThumbsUp className="h-3.5 w-3.5" />
    </Button>
    <Button
      size="sm"
      variant={message.feedbackRating === 'negative' ? 'destructive' : 'ghost'}
      className="h-7 w-7 p-0"
      onClick={() => handleFeedback(index, 'negative')}
    >
      <ThumbsDown className="h-3.5 w-3.5" />
    </Button>
  </div>
)}
```

Visual result:
```text
┌────────────────────────────────────────┐
│ 🤖 Dok Aga                             │
│ Ang mastitis ay infection sa udder...  │
│ ───────────────────────────────────    │
│ Nakatulong ba?  [👍] [👎]              │
└────────────────────────────────────────┘
```

### 1.3 Feedback Hook

**New File: `src/hooks/useDocAgaFeedback.ts`**

```typescript
export const useDocAgaFeedback = () => {
  const submitFeedback = async (queryId: string, rating: 'positive' | 'negative') => {
    const { error } = await supabase
      .from('doc_aga_queries')
      .update({
        feedback_rating: rating,
        feedback_at: new Date().toISOString()
      })
      .eq('id', queryId);
    
    if (error) throw error;
  };
  
  return { submitFeedback };
};
```

### 1.4 Edge Function Update

**File: `supabase/functions/doc-aga/index.ts`**

Modify `logQuery` to return the inserted record ID so the frontend can track which query to update:

```typescript
async function logQuery(...) {
  const { data, error } = await supabase
    .from('doc_aga_queries')
    .insert({...})
    .select('id')
    .single();
  
  return data?.id;  // Return ID for feedback tracking
}
```

Return the query ID in the response so the frontend can link it to the message.

---

## Part 2: Automatic FAQ Candidate Extraction

### 2.1 New Database Table

```sql
CREATE TABLE public.faq_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_pattern text NOT NULL,
  normalized_text text NOT NULL,
  occurrence_count integer DEFAULT 1,
  sample_query_ids uuid[] DEFAULT '{}',
  suggested_answer text,
  suggested_category text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  converted_faq_id uuid REFERENCES doc_aga_faqs(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz
);

-- RLS: Only admins can manage
ALTER TABLE public.faq_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_candidates" ON public.faq_candidates
FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));
```

### 2.2 Edge Function: FAQ Candidate Extraction

**New File: `supabase/functions/extract-faq-candidates/index.ts`**

This function runs on-demand (or can be scheduled) to:
1. Fetch unmatched queries from the last 30 days
2. Normalize questions (lowercase, remove punctuation, stem common words)
3. Group similar questions using text similarity
4. Create/update FAQ candidates for patterns appearing 3+ times

```typescript
// Pseudocode for clustering logic
const unmatched = await supabase
  .from('doc_aga_queries')
  .select('id, question')
  .is('matched_faq_id', null)
  .gte('created_at', thirtyDaysAgo);

// Normalize and cluster
const clusters = clusterSimilarQuestions(unmatched);

// Upsert candidates for clusters with 3+ occurrences
for (const cluster of clusters.filter(c => c.count >= 3)) {
  await supabase.from('faq_candidates').upsert({
    question_pattern: cluster.representative,
    normalized_text: cluster.normalized,
    occurrence_count: cluster.count,
    sample_query_ids: cluster.queryIds.slice(0, 5),
  });
}
```

### 2.3 Admin Dashboard Updates

**File: `src/components/admin/DocAgaManagement.tsx`**

Add new tabs:

#### Feedback Analytics Tab
- Positive vs negative feedback ratio (pie chart)
- Questions with most negative feedback (table)
- Feedback trend over time (line chart)

#### FAQ Candidates Tab
- List of pending candidates with:
  - Question pattern
  - Occurrence count
  - Sample queries (expandable)
  - Actions: Approve → Convert to FAQ, Reject, Edit

```text
┌─────────────────────────────────────────────────────────────────┐
│ FAQ Candidates                                          [Run Extraction] │
├─────────────────────────────────────────────────────────────────┤
│ Question Pattern                    │ Count │ Status  │ Actions │
├─────────────────────────────────────┼───────┼─────────┼─────────┤
│ "Paano magpagamot ng mastitis?"     │  12   │ Pending │ ✓ ✗ 📝  │
│ "Ano ang magandang feeds para sa..."│   8   │ Pending │ ✓ ✗ 📝  │
│ "Kailan dapat i-breed ang baka?"    │   5   │ Pending │ ✓ ✗ 📝  │
└─────────────────────────────────────┴───────┴─────────┴─────────┘
```

**Convert to FAQ Flow:**
1. Admin clicks "Approve" on a candidate
2. Dialog opens with pre-filled question and AI-suggested answer
3. Admin reviews/edits the answer
4. On save: creates new FAQ entry, marks candidate as `converted`

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/xxx.sql` | Create | Add feedback columns, create faq_candidates table |
| `src/hooks/useDocAgaFeedback.ts` | Create | Hook for submitting feedback ratings |
| `src/components/farmhand/DocAgaConsultation.tsx` | Modify | Add thumbs up/down UI, track queryId per message |
| `supabase/functions/doc-aga/index.ts` | Modify | Return query ID after logging |
| `supabase/functions/extract-faq-candidates/index.ts` | Create | Question clustering and candidate extraction |
| `src/components/admin/DocAgaManagement.tsx` | Modify | Add Feedback Analytics and FAQ Candidates tabs |

---

## Technical Details

### Question Similarity Algorithm

For clustering similar questions, we'll use a lightweight approach suitable for Tagalog/Taglish:

1. **Normalization**: Lowercase, remove punctuation, common stopwords
2. **Tokenization**: Split on whitespace
3. **Jaccard Similarity**: Compare word sets (threshold: 0.6 similarity)
4. **Grouping**: Union-find clustering for transitive similarity

This runs efficiently in an edge function without external ML dependencies.

### Mobile Considerations

The thumbs up/down buttons are designed for touch:
- Minimum 44px touch target (7x7 units with padding)
- Clear visual feedback on selection
- No text required (icons are universally understood)

### Data Privacy

- Feedback is anonymous (no farmer identifying info exposed to admins)
- Candidates show question patterns, not specific user details
- Sample queries are displayed without user attribution

---

## Testing Points

1. Send a message to Doc Aga
2. Verify thumbs up/down buttons appear below the response
3. Click thumbs up - verify it highlights and persists on page refresh
4. Click thumbs down - verify it switches from thumbs up
5. Check admin dashboard for feedback analytics
6. Run FAQ extraction and verify candidates appear
7. Approve a candidate and verify it creates a new FAQ
8. Send a new query that matches the new FAQ - verify it gets matched
