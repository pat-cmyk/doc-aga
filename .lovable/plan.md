

# Cooperative Module -- Research, Competitive Analysis, and Implementation Plan

## Part 1: Industry Research -- Existing Cooperative Platforms

### Platforms Analyzed

| Platform | Type | Strengths | Gaps |
|----------|------|-----------|------|
| **MyEasyFarm** (France) | Crop cooperative data aggregation | Aggregates field data across member farms; compatible with major precision tools; multi-farm dashboards | Crop-only -- no livestock, no milk/production tracking; no invitation-based membership |
| **Rooted Farmers** (USA) | Flower hub/collective sales | Aggregates inventory and sales across member farms; seamless buyer-facing storefront | Sales-only -- no production data, health records, or herd analytics |
| **Farmbrite** (USA) | General farm management + cooperative | Task management, livestock tracking, multi-farm views | No cooperative-specific consolidation dashboard; no role isolation; every user sees everything |
| **AgriERP** (India) | Full ERP for livestock | Deep financial/supply chain tracking; covers planning to sales | Heavy ERP -- overkill for small cooperatives; no member invitation flow; expensive |
| **xFarm** (Italy) | Multi-company farm management | Manage multiple companies simultaneously; task distribution; compliance | No cooperative aggregation layer -- it is multi-farm for a single owner, not a cooperative view |
| **NZ Farm Source / Fonterra** (New Zealand) | Dairy cooperative digital tools | Milk quality service, production reports, farm dairy records, compliance data sharing | Proprietary and locked to Fonterra members; built around milk payment systems, not general livestock |
| **IFCN Dairy Platform** (Global) | Dairy industry intelligence | BI dashboards, benchmarking, global cost-of-production data | Research/analytics focus -- not operational management; no individual farm data integration |

### Key Gaps Across All Platforms

1. **No invitation-only membership**: Most platforms use open registration or bulk import. None enforce "must already have a farm in the system" as a prerequisite.
2. **No read-only aggregation over sovereign farm data**: Cooperatives either see everything or nothing. No platform lets a cooperative admin view consolidated data from independent farms without those farms losing control.
3. **No livestock-specific cooperative analytics**: Milk yield aggregation, herd health summaries, breed distribution across members -- none of the platforms offer this natively.
4. **No Philippine context**: No platform handles Philippine-specific needs like PCC programs, carabao breed tracking, barangay/municipality grouping, or bilingual (English/Filipino) interfaces.

### Doc Aga's Unique Advantage

Doc Aga already has the **individual farm data** (animals, milking records, health records, breeding, feed inventory, financials). The cooperative module simply adds a **read-only aggregation layer on top of existing SSOT data** -- no data duplication, no new data entry for farmers.

---

## Part 2: Cooperative Module Design

### Core Principles

1. **Complete isolation**: New role (`cooperative`), new pages, new route (`/cooperative`). Zero changes to farmer, merchant, vet, or government code.
2. **Read-only consolidation**: The cooperative dashboard queries existing farm data (animals, milking_records, health_records, etc.) across member farms. No writes to farm data.
3. **Invitation-only membership**: Cooperative admin invites farms by the farm owner's email. The farm must already exist in the system. No self-registration.
4. **Single admin per cooperative**: One user manages the cooperative dashboard. No multi-admin complexity in v1.

### Database Schema

#### New Tables

**`cooperatives`** -- One row per cooperative organization

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `name` | TEXT NOT NULL | Cooperative name |
| `admin_user_id` | UUID FK -> auth.users | The single admin |
| `region` | TEXT | Province/region |
| `municipality` | TEXT | Municipality |
| `logo_url` | TEXT | Optional branding |
| `created_at` | TIMESTAMPTZ | |

**`cooperative_memberships`** -- Links farms to cooperatives via invitation

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `cooperative_id` | UUID FK -> cooperatives | |
| `farm_id` | UUID FK -> farms | Must be an existing, non-deleted farm |
| `invited_email` | TEXT | Farm owner's email |
| `invitation_status` | TEXT | `pending` / `accepted` / `declined` |
| `invitation_token` | UUID | For acceptance link |
| `token_expires_at` | TIMESTAMPTZ | 7-day expiry |
| `invited_at` | TIMESTAMPTZ | |
| `accepted_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

#### New Role

Add `cooperative` to the `user_roles` table (existing role system). This follows the same pattern as `government`, `merchant`, etc.

#### RLS Policies

- `cooperatives`: Admin can SELECT/UPDATE their own cooperative. No public access.
- `cooperative_memberships`: Admin can SELECT/INSERT/UPDATE/DELETE for their own cooperative. Farm owners can SELECT/UPDATE their own invitations (to accept/decline).
- Cross-farm data access: A SECURITY DEFINER function `get_cooperative_farm_ids(cooperative_id)` returns all `farm_id` values for accepted memberships. The cooperative dashboard uses this to query existing farm-scoped tables (animals, milking_records, etc.) through dedicated read-only RPCs.

### Read-Only Aggregation RPCs

These are SECURITY DEFINER functions that validate the caller is the cooperative admin, then aggregate data across member farms:

| RPC | Returns |
|-----|---------|
| `get_cooperative_herd_summary` | Total animals, breed distribution, species breakdown, avg age across all member farms |
| `get_cooperative_milk_production` | Daily/weekly/monthly milk totals, per-farm breakdown, quality stats |
| `get_cooperative_health_overview` | Active health issues, vaccination coverage, mortality rates |
| `get_cooperative_financial_summary` | Aggregated milk revenue, feed costs, herd investment across members |
| `get_cooperative_member_farms` | List of member farms with basic stats (animal count, milk production, location) |

Each RPC takes the cooperative_id, verifies the caller is the admin via `auth.uid()`, and queries only farms in `cooperative_memberships` with `invitation_status = 'accepted'`.

### Frontend Architecture

All new files live in isolated directories:

```
src/pages/CooperativeAuth.tsx          -- Login page (email/password only)
src/pages/CooperativeDashboard.tsx     -- Main dashboard shell
src/components/cooperative/            -- All cooperative components
  CooperativeOverview.tsx              -- Summary cards (total farms, animals, milk)
  CooperativeMemberFarms.tsx           -- Member list with per-farm stats
  CooperativeMilkAnalytics.tsx         -- Aggregated milk production charts
  CooperativeHerdSummary.tsx           -- Breed distribution, species breakdown
  CooperativeHealthOverview.tsx        -- Health stats across all farms
  CooperativeFinancials.tsx            -- Revenue, costs, investment rollup
  CooperativeInviteFarmDialog.tsx      -- Email invitation dialog
  CooperativePendingInvitations.tsx    -- Track sent invitations
src/hooks/useCooperative.ts            -- Hooks for cooperative data
```

### Auth & Routing

- New route: `/auth/cooperative` -- login page with "Log in as Cooperative" branding
- New route: `/cooperative` -- protected dashboard (requires `cooperative` role)
- Auth.tsx gets a "Log in as Cooperative" link/button (same pattern as the existing "Admin" and "Government" login links) -- this is a **link to a separate page**, not a modification of the farmer login logic
- The cooperative user is created by the super admin (same as government accounts) via the existing Admin Create User flow, which assigns the `cooperative` role

### Invitation Flow

```
1. Cooperative admin enters farm owner's email
2. System checks: Does a farm exist where owner's email matches?
   - YES: Create cooperative_membership row (pending), send invitation email
   - NO: Show error "No farm found for this email"
3. Farm owner receives email with acceptance link
4. Farm owner clicks link -> /cooperative/invite/accept/:token
   - If logged in: Accept/decline inline
   - If not logged in: Redirect to /auth with redirect back
5. On accept: cooperative_membership.invitation_status = 'accepted'
6. Cooperative dashboard now includes that farm's data in aggregations
```

### Dashboard Tabs (v1)

| Tab | Content |
|-----|---------|
| **Overview** | KPI cards: total member farms, total animals, total daily milk production, active health alerts. Map showing farm locations. |
| **Member Farms** | List of all member farms with: name, location, animal count, daily milk avg, last activity. Click to see per-farm detail (read-only). |
| **Milk Production** | Aggregated charts: daily/weekly/monthly production trends, per-farm comparison, quality breakdown (good vs rejected). |
| **Herd Summary** | Total animals by species, breed distribution pie chart, age distribution, growth trends. |
| **Health** | Vaccination coverage rates, active health issues, mortality summary. |
| **Financials** | Aggregated milk revenue, total feed costs, cooperative-wide investment summary. |
| **Settings** | Invite farms, manage pending invitations, cooperative profile. |

---

## Part 3: Implementation Sequence

### Phase 1 -- Database + Auth (1 migration)
- Create `cooperatives` and `cooperative_memberships` tables
- Add RLS policies
- Create aggregation RPCs (herd summary, milk production, etc.)
- Create `get_cooperative_farm_ids` SECURITY DEFINER helper

### Phase 2 -- Auth + Routing
- Create `CooperativeAuth.tsx` login page
- Add `/auth/cooperative` and `/cooperative` routes to `App.tsx`
- Add "Log in as Cooperative" link to the main Auth page (link only -- no logic changes)
- Create `CooperativeRoute` protected wrapper (checks `cooperative` role)

### Phase 3 -- Dashboard Shell + Member Management
- Create `CooperativeDashboard.tsx` with tab layout
- Build `CooperativeInviteFarmDialog.tsx` and `CooperativePendingInvitations.tsx`
- Build invitation acceptance page
- Create `useCooperative.ts` hooks

### Phase 4 -- Analytics Tabs
- Build Overview, Milk Production, Herd Summary, Health, and Financials tabs
- Each tab calls its corresponding RPC and renders charts/tables

### Phase 5 -- Documentation
- Update `docs/data-relationships-map.md` with cooperative schema
- Update `docs/ssot-architecture.md` with cooperative data flow

---

## Part 4: What This Does NOT Touch

| Area | Status |
|------|--------|
| Farmer dashboard/components | Untouched |
| Merchant dashboard/components | Untouched |
| Vet functionality | Untouched |
| Government dashboard/components | Untouched |
| Farmhand dashboard | Untouched |
| Existing farm RLS policies | Untouched -- cooperative reads via SECURITY DEFINER RPCs |
| Admin dashboard | Minor: ability to create users with `cooperative` role (already generic) |

## Files Summary (estimated)

| Category | Files | Action |
|----------|-------|--------|
| Migration | 1 | CREATE -- tables, RLS, RPCs |
| Pages | 2 | CREATE -- CooperativeAuth, CooperativeDashboard |
| Components | ~10 | CREATE -- all in `src/components/cooperative/` |
| Hooks | 1 | CREATE -- `useCooperative.ts` |
| Routing | 1 | EDIT -- `App.tsx` (add 2 routes + lazy import) |
| Auth link | 1 | EDIT -- `Auth.tsx` (add "Log in as Cooperative" link) |
| Documentation | 2 | EDIT -- DRM + SSOT docs |
| **Total** | **~18** | |

