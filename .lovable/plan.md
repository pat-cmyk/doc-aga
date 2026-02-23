

# Admin Analytics for Doc Aga FAQ Usage

## Current State
- The FAQ Management tab shows a basic "Match Count" badge per FAQ, computed via N+1 queries (one count query per FAQ -- inefficient)
- No dedicated view showing FAQ usage trends, top performers, unused FAQs, or match rate over time
- The `doc_aga_queries.matched_faq_id` FK already links queries to FAQs, so all data exists -- it just needs proper aggregation and visualization

## Plan

### 1. Database: Create an RPC for efficient FAQ usage stats
Instead of N+1 client-side count queries, create a single RPC `get_faq_usage_stats` that returns all FAQ usage data in one call:
- FAQ id, question, category, is_active, created_at
- Total match count (all time)
- Match count last 30 days
- Match count last 7 days
- Last matched date

This replaces the N+1 pattern on lines 183-194 of DocAgaManagement.tsx.

### 2. New Component: `FaqUsageAnalyticsTab.tsx`
A new tab "FAQ Usage" added to the DocAgaManagement tabs, containing:

**Summary cards row:**
- Total FAQ matches (all time)
- Match rate (matched queries / total queries as %)
- Most used FAQ (name + count)
- Unused FAQs count (active FAQs with 0 matches)

**Top FAQs bar chart:**
- Horizontal bar chart showing top 10 FAQs by match count (last 30 days)
- Uses the existing recharts + ChartContainer pattern

**Unused FAQs alert table:**
- Table of active FAQs with 0 matches in the last 30 days
- Actionable: edit or deactivate buttons
- Helps admins prune stale knowledge base entries

**FAQ match timeline:**
- Line chart showing daily FAQ match volume over last 30 days (total, not per-FAQ)
- Reuses existing responsive chart hooks

### 3. Wire into DocAgaManagement.tsx
- Add a new tab trigger "FAQ Usage" with a BarChart3 icon between "FAQ Candidates" and "Recent Queries"
- Render `<FaqUsageAnalyticsTab />` in the new TabsContent
- Replace the N+1 `faqsWithMatches` query with the new RPC for the FAQ Management tab as well
- Pass `dataCategory` prop for farm-level filtering

### 4. Documentation
- Update `changelog.md`

## Files Changed

| File | Change |
|------|--------|
| Migration SQL | New `get_faq_usage_stats` RPC |
| `src/components/admin/FaqUsageAnalyticsTab.tsx` | NEW -- dedicated FAQ usage analytics component |
| `src/components/admin/DocAgaManagement.tsx` | Add tab, replace N+1 query with RPC call |
| `changelog.md` | Log the change |

