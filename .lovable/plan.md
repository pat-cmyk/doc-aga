

# Seed Demo Farmer Feedback Data

## Problem
The Farmer Voice tab shows empty dashboards for demo farms because the `seed-demo-data` edge function does not generate `farmer_feedback` records. All sub-components (Priority Queue, Geo Heatmap, Sentiment Trends, Cluster View, Smart Insights) rely on this table.

## Solution
Extend the existing `seed-demo-data` edge function to also seed realistic `farmer_feedback` records for each demo farm. This follows the same SSOT pattern already used for milking, weight, health, BCS, feeding, and AI records.

## What Gets Seeded
For each demo farm, generate 5-15 feedback records spread across the last 90 days with:
- **Categories**: All 9 feedback categories (policy_concern, market_access, veterinary_support, training_request, infrastructure, financial_assistance, emergency_support, disease_outbreak, feed_shortage) distributed realistically
- **Priorities**: Weighted distribution (critical ~10%, high ~20%, medium ~40%, low ~30%) with matching `priority_score` (0-100)
- **Sentiments**: urgent, negative, neutral, positive — correlated with priority
- **Statuses**: Mix of submitted, acknowledged, under_review, action_taken, resolved, closed — older records more likely resolved
- **Transcriptions**: Species-aware Filipino farmer voice messages (realistic text per category)
- **Tags**: Category-relevant tags for cluster analysis
- **Detected entities**: JSON with diseases/locations for disease_outbreak category
- **AI summaries**: Short summaries for the Smart Insights panel
- **Timestamps**: acknowledged_at, reviewed_at, resolution_date set appropriately based on status

## Idempotency
Check for existing feedback per farm before inserting (same pattern as other record types). Skip farms that already have feedback in the last 90 days.

## Technical Changes

### File: `supabase/functions/seed-demo-data/index.ts`
1. Add feedback templates array with category-specific transcriptions, tags, and detected_entities
2. After the existing animal-level seeding loop, add a farm-level feedback seeding block:
   - Query existing `farmer_feedback` for this farm in last 90 days
   - If count < 5, generate feedback records using the farm's owner (from `farm_memberships`) as `user_id`
   - Use seeded random for deterministic but varied output
   - Batch insert into `farmer_feedback`
3. Add `feedback_inserted` to the summary output

### File: `src/components/admin/SeedDemoDataButton.tsx`
- Add "Feedback" column to the results table and totals grid

### No other files change
- The `useGovernmentFeedback` hook already queries `farmer_feedback` with full filter support
- All Farmer Voice sub-components already consume this data
- The dashboard filter props were connected in the previous restructuring

## SSOT Compliance
- Zero new hooks, RPCs, or tables
- Reuses the existing `seed-demo-data` edge function pattern
- Data flows through existing `farmer_feedback` table to existing `useGovernmentFeedback` hook to existing dashboard components
- Service role key bypasses RLS (same as all other demo seeding)

