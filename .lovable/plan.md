
# Enhancement: Trending Topics & Topic-Based FAQ Curation

## Overview

This plan enhances the existing Admin Dashboard's Doc Aga Management section by adding trending topic analysis and topic-based FAQ curation. This avoids duplication with existing features while filling the gap of category-level insights for knowledge base enrichment.

## Current State Analysis

The admin dashboard already has:
- **FAQ Candidates Tab**: Auto-clusters similar questions by text similarity
- **Analytics Tab**: Shows unmatched queries list (first 10)
- **FAQ Management Tab**: CRUD for the knowledge base

What's missing is the ability to see **which topic areas** have the most unmatched queries and need FAQ coverage.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                   Doc Aga Management                            │
├─────────────────────────────────────────────────────────────────┤
│  Tabs: Analytics | Feedback | FAQ Candidates | ...              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           ENHANCED Analytics Tab                          │  │
│  │                                                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐               │  │
│  │  │ Query Timeline  │  │ Trending Topics │  <-- NEW      │  │
│  │  │     Chart       │  │   Bar Chart     │               │  │
│  │  └─────────────────┘  └─────────────────┘               │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │        Topic Coverage Analysis (NEW)                │  │  │
│  │  │  Shows topics with most unmatched vs matched       │  │  │
│  │  │  queries - identifies knowledge gaps               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │     Browse by Topic (NEW)                          │  │  │
│  │  │  [Mastitis] [Breeding] [Feeding] [Digestive]...    │  │  │
│  │  │  Click topic -> Filtered unmatched queries         │  │  │
│  │  │  -> Quick "Create FAQ" action per query            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Changes Overview

| Component | Action | Description |
|-----------|--------|-------------|
| `src/lib/queryTopicCategorizer.ts` | Create | Shared topic categorization logic (extracted from FarmerQueriesTopics) |
| `src/components/admin/TrendingTopicsCard.tsx` | Create | Bar chart showing query distribution by topic |
| `src/components/admin/TopicCoverageCard.tsx` | Create | Shows matched vs unmatched ratio per topic |
| `src/components/admin/TopicBrowseCard.tsx` | Create | Topic pills + filtered query list with quick FAQ create |
| `DocAgaManagement.tsx` | Modify | Add new cards to Analytics tab |

---

## Part 1: Shared Topic Categorization Utility

### File: `src/lib/queryTopicCategorizer.ts`

Extract the categorization logic from `FarmerQueriesTopics.tsx` into a reusable utility:

```typescript
export const TOPIC_CATEGORIES = [
  { key: 'mastitis', label: 'Mastitis & Udder Health', keywords: ['mastitis', 'udder', 'milk infection', 'teat'] },
  { key: 'breeding', label: 'Pregnancy & Breeding', keywords: ['pregnan', 'calving', 'breeding', 'heat', 'insemination'] },
  { key: 'feeding', label: 'Feeding & Nutrition', keywords: ['feed', 'nutrition', 'diet', 'forage', 'supplement'] },
  { key: 'digestive', label: 'Digestive Issues', keywords: ['diarrhea', 'scours', 'digestive', 'loose stool'] },
  { key: 'bloat', label: 'Bloat & Stomach Issues', keywords: ['bloat', 'gas', 'stomach', 'rumen'] },
  { key: 'lameness', label: 'Lameness & Hoof Care', keywords: ['lame', 'hoof', 'leg', 'limping', 'foot rot'] },
  { key: 'vaccination', label: 'Vaccination & Treatment', keywords: ['vaccine', 'injection', 'medicine', 'deworming'] },
  { key: 'milk', label: 'Milk Production', keywords: ['milk yield', 'low milk', 'milking'] },
  { key: 'general', label: 'General Health & Management', keywords: [] }
] as const;

export function categorizeQuery(question: string): string {
  const lower = question.toLowerCase();
  
  for (const category of TOPIC_CATEGORIES) {
    if (category.keywords.some(kw => lower.includes(kw))) {
      return category.label;
    }
  }
  return 'General Health & Management';
}

export function categorizeQueries(queries: { question: string; [key: string]: any }[]) {
  const grouped: Record<string, typeof queries> = {};
  
  queries.forEach(q => {
    const topic = categorizeQuery(q.question);
    if (!grouped[topic]) grouped[topic] = [];
    grouped[topic].push(q);
  });
  
  return grouped;
}
```

This will also be used to refactor `FarmerQueriesTopics.tsx` to use the shared utility.

---

## Part 2: Trending Topics Visualization

### File: `src/components/admin/TrendingTopicsCard.tsx`

A horizontal bar chart showing query volume by topic category:

```text
┌────────────────────────────────────────────────┐
│ Trending Topics (Last 30 Days)                 │
├────────────────────────────────────────────────┤
│ Mastitis & Udder Health     ████████████  45   │
│ Pregnancy & Breeding        █████████    38    │
│ Feeding & Nutrition         ███████      28    │
│ Digestive Issues            █████        20    │
│ Vaccination & Treatment     ████         16    │
│ General Health              ███          12    │
└────────────────────────────────────────────────┘
```

Features:
- Uses Recharts BarChart (horizontal layout)
- Pulls from `doc_aga_queries` for last 30 days
- Color-coded bars for visual clarity

---

## Part 3: Topic Coverage Analysis

### File: `src/components/admin/TopicCoverageCard.tsx`

Shows which topics have FAQ coverage gaps:

```text
┌────────────────────────────────────────────────────────────────┐
│ Topic Coverage Analysis                            [Refresh]   │
├────────────────────────────────────────────────────────────────┤
│ Topic                    │ Total │ Matched │ Unmatched │ Gap % │
├──────────────────────────┼───────┼─────────┼───────────┼───────┤
│ Mastitis & Udder Health  │  45   │   30    │    15     │  33%  │
│ Digestive Issues         │  20   │    5    │    15     │  75%  │ ⚠️
│ Bloat & Stomach Issues   │  18   │    3    │    15     │  83%  │ ⚠️
│ Pregnancy & Breeding     │  38   │   35    │     3     │   8%  │
└──────────────────────────┴───────┴─────────┴───────────┴───────┘

⚠️ = High gap percentage (>50%) - needs more FAQs
```

This helps admins prioritize which topic areas need knowledge base enrichment.

---

## Part 4: Topic-Based Query Browser

### File: `src/components/admin/TopicBrowseCard.tsx`

Interactive topic pills with filtered query browsing:

```text
┌────────────────────────────────────────────────────────────────┐
│ Browse Unmatched Queries by Topic                              │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ [🏷️ Mastitis (15)] [🏷️ Digestive (15)] [🏷️ Bloat (15)]       │
│ [Breeding (3)] [Feeding (8)] [Vaccination (5)] [General (10)]  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ Selected: Digestive Issues (15 unmatched)                      │
├────────────────────────────────────────────────────────────────┤
│ • "Ang baka ko may diarrhea na 3 days na..."      [+ Create]   │
│ • "Bakit madalas magkasakit ng tiyan ang..."      [+ Create]   │
│ • "Paano magagamot ang loose stool?"              [+ Create]   │
│ • "Ano ang pwedeng ibigay sa may scours?"         [+ Create]   │
└────────────────────────────────────────────────────────────────┘
```

Features:
- Topic pills with unmatched count badges
- Pills with high counts (>10) are highlighted
- Click pill to filter the query list below
- Each query has "Create FAQ" button that pre-fills the FAQ dialog

---

## Part 5: DocAgaManagement.tsx Updates

Modify the Analytics tab to include the new components:

```typescript
<TabsContent value="analytics" className="space-y-4">
  {/* Existing: Query Timeline */}
  <Card>...</Card>
  
  {/* NEW: Trending Topics Chart */}
  <TrendingTopicsCard queries={recentQueries} />
  
  {/* NEW: Topic Coverage Analysis */}
  <TopicCoverageCard />
  
  {/* NEW: Browse by Topic */}
  <TopicBrowseCard 
    onCreateFaq={(query) => {
      setFormData({
        question: query.question,
        answer: query.answer || "",
        category: categorizeQuery(query.question),
        is_active: true,
      });
      setIsDialogOpen(true);
    }}
  />
  
  {/* EXISTING: Unmatched Queries (keep as fallback) */}
  <Card>...</Card>
</TabsContent>
```

---

## Part 6: Refactor FarmerQueriesTopics.tsx

Update the government dashboard component to use the shared utility:

```typescript
import { categorizeQueries, TOPIC_CATEGORIES } from "@/lib/queryTopicCategorizer";

// Replace inline categorization with:
const topTopics = useMemo(() => {
  if (!queries || !Array.isArray(queries)) return [];
  return categorizeQueries(queries);
}, [queries]);
```

This ensures consistency between admin and government dashboards.

---

## Data Flow

```text
doc_aga_queries table
        │
        ├──> TrendingTopicsCard
        │       Fetches last 30 days
        │       Groups by topic using categorizeQuery()
        │       Displays bar chart
        │
        ├──> TopicCoverageCard
        │       Fetches all queries
        │       Calculates matched_faq_id ratio per topic
        │       Highlights gaps
        │
        └──> TopicBrowseCard
                Fetches unmatched queries
                Groups by topic
                Allows filtered browsing
                Links to FAQ creation
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/queryTopicCategorizer.ts` | Create | Shared categorization logic with keyword definitions |
| `src/components/admin/TrendingTopicsCard.tsx` | Create | Bar chart of query volume by topic |
| `src/components/admin/TopicCoverageCard.tsx` | Create | Table showing FAQ coverage gaps per topic |
| `src/components/admin/TopicBrowseCard.tsx` | Create | Interactive topic pills + filtered query list |
| `src/components/admin/DocAgaManagement.tsx` | Modify | Add new cards to Analytics tab |
| `src/components/government/FarmerQueriesTopics.tsx` | Modify | Refactor to use shared utility |

---

## Technical Notes

### Query Efficiency
- TrendingTopicsCard: Single query for last 30 days (~1000 rows max)
- TopicCoverageCard: Uses count queries per topic (efficient)
- TopicBrowseCard: Fetches only unmatched queries (~200-500 typical)

### Mobile Responsiveness
- Topic pills wrap on mobile
- Tables become scrollable horizontally
- Bar chart adjusts to container width

### Integration with Existing Features
- "Create FAQ" action uses the same dialog as existing FAQ Management
- Category field auto-populated based on topic selection
- Works alongside FAQ Candidates tab (which focuses on similar text patterns, not topics)

---

## Testing Points

1. Navigate to Admin Dashboard > Doc Aga > Analytics tab
2. Verify Trending Topics chart shows correct category distribution
3. Verify Topic Coverage table highlights high-gap categories
4. Click a topic pill - verify query list filters correctly
5. Click "Create FAQ" on a query - verify form pre-fills with question and auto-category
6. Verify the new FAQ appears in FAQ Management tab
7. Check government dashboard still works after refactor
