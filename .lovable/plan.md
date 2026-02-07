
# Admin Dashboard Data Category Toggle Enhancement

## Overview

This enhancement adds a Live/Demo data toggle to the Admin Dashboard header, similar to the Government Dashboard. The toggle will filter all analytics data across all tabs (Dashboard, Operations, AI & Voice) so admins can clearly distinguish between production and demo data.

## Current State

- **Government Dashboard**: Already has a data category selector (`live` | `demo` | `all`) in the filter controls that affects all analytics via the `dataCategory` state variable
- **Admin Dashboard**: No data category filtering - shows all data combined
- **FarmOversight**: Already shows `data_category` column per farm and allows editing, but doesn't filter the view
- **SystemOverview**: Uses `get_system_health_metrics` RPC which doesn't support data category filtering
- **DocAgaManagement**: Fetches all queries without data category filtering

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        AdminLayout Header                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  [Shield Icon] Admin Dashboard      [Live ▼] [Search] [Network] │  │
│  │                System Administration            ↑                │  │
│  │                                           Data Toggle            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ dataCategory prop propagates down
┌─────────────────────────────────────────────────────────────────────────┐
│  AdminDashboard.tsx (state owner: dataCategory in URL params)           │
│                                                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │ Dashboard │ │  People   │ │Operations │ │ AI & Voice│ │  System   │ │
│  │   Tab     │ │   Tab     │ │    Tab    │ │    Tab    │ │   Tab     │ │
│  │     ✓     │ │    N/A    │ │     ✓     │ │     ✓     │ │    N/A    │ │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │
│       │                            │              │                     │
│       ▼                            ▼              ▼                     │
│  SystemOverview            FarmOversight    DocAgaManagement           │
│  (filtered metrics)        (filtered list)  (filtered queries)          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Changes Overview

| Component | Action | Description |
|-----------|--------|-------------|
| `AdminDashboard.tsx` | Modify | Add `dataCategory` state synced to URL params |
| `AdminLayout.tsx` | Modify | Add data category selector in header |
| `useSystemHealth.ts` | Modify | Accept optional `dataCategory` parameter |
| `get_system_health_metrics` RPC | Modify | Add `data_category_filter` parameter |
| `FarmOversight.tsx` | Modify | Accept `dataCategory` prop and filter farms |
| `DocAgaManagement.tsx` | Modify | Accept `dataCategory` prop and filter queries by farm data category |
| `OperationsTab.tsx` | Modify | Pass `dataCategory` prop to child components |
| `AIVoiceTab.tsx` | Modify | Pass `dataCategory` prop to DocAgaManagement |

---

## Part 1: State Management in AdminDashboard

**File: `src/pages/AdminDashboard.tsx`**

Add data category state synced to URL params:

```typescript
import { DataCategory, DEFAULT_DATA_CATEGORY } from "@/types/government";

// Add state initialization from URL
const [dataCategory, setDataCategory] = useState<DataCategory>(() => 
  (searchParams.get("data_source") as DataCategory) || DEFAULT_DATA_CATEGORY
);

// Sync to URL when changed
useEffect(() => {
  const params = new URLSearchParams(searchParams);
  params.set('tab', activeTab);
  params.set('data_source', dataCategory);
  setSearchParams(params, { replace: true });
}, [activeTab, dataCategory, setSearchParams]);
```

Pass to child components:

```typescript
<AdminLayout 
  activeTab={activeTab} 
  onTabChange={setActiveTab}
  dataCategory={dataCategory}
  onDataCategoryChange={setDataCategory}
>
  <TabsContent value="dashboard">
    <SystemOverview dataCategory={dataCategory} />
  </TabsContent>
  
  <TabsContent value="operations">
    <OperationsTab dataCategory={dataCategory} />
  </TabsContent>

  <TabsContent value="ai-voice">
    <AIVoiceTab dataCategory={dataCategory} />
  </TabsContent>
  ...
</AdminLayout>
```

---

## Part 2: AdminLayout Header Toggle

**File: `src/components/admin/AdminLayout.tsx`**

Add data category selector to header:

```typescript
interface AdminLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  dataCategory: DataCategory;
  onDataCategoryChange: (category: DataCategory) => void;
}

// In the header, add selector before AdminGlobalSearch:
<Select value={dataCategory} onValueChange={onDataCategoryChange}>
  <SelectTrigger className="w-[130px]">
    <Database className="h-4 w-4 mr-2" />
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="live">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Live Data
      </div>
    </SelectItem>
    <SelectItem value="demo">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        Demo Data
      </div>
    </SelectItem>
    <SelectItem value="all">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-gray-500" />
        All Data
      </div>
    </SelectItem>
  </SelectContent>
</Select>
```

Visual layout in header:
```text
┌──────────────────────────────────────────────────────────────────────┐
│ [Shield] Admin Dashboard          [Live Data ▼] [🔍] [●] [user@...]  │
│          System Administration                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Database Migration - Update RPC

**New Migration**

Update `get_system_health_metrics` to accept a data category filter:

```sql
DROP FUNCTION IF EXISTS public.get_system_health_metrics(text);
DROP FUNCTION IF EXISTS public.get_system_health_metrics();

CREATE OR REPLACE FUNCTION public.get_system_health_metrics(
  data_category_filter text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  farm_filter text;
BEGIN
  -- Build farm filter based on data category
  IF data_category_filter = 'all' THEN
    farm_filter := '';
  ELSE
    farm_filter := format(' AND f.data_category = %L', data_category_filter);
  END IF;

  SELECT jsonb_build_object(
    'users', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM profiles),
      'new_24h', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '24 hours'),
      'new_7d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '7 days'),
      'new_30d', (SELECT COUNT(*) FROM profiles WHERE created_at > now() - interval '30 days'),
      'active_24h', (SELECT COUNT(DISTINCT user_id) FROM user_activity_logs WHERE created_at > now() - interval '24 hours'),
      'disabled', COALESCE((SELECT COUNT(*) FROM profiles WHERE is_disabled = true), 0)
    ),
    'farms', jsonb_build_object(
      'total', (
        SELECT COUNT(*) FROM farms 
        WHERE is_deleted = false 
          AND (data_category_filter = 'all' OR data_category = data_category_filter)
      ),
      'new_7d', (
        SELECT COUNT(*) FROM farms 
        WHERE created_at > now() - interval '7 days' 
          AND is_deleted = false
          AND (data_category_filter = 'all' OR data_category = data_category_filter)
      ),
      'new_30d', (
        SELECT COUNT(*) FROM farms 
        WHERE created_at > now() - interval '30 days' 
          AND is_deleted = false
          AND (data_category_filter = 'all' OR data_category = data_category_filter)
      )
    ),
    'animals', jsonb_build_object(
      'total', (
        SELECT COUNT(*) FROM animals a
        JOIN farms f ON a.farm_id = f.id
        WHERE a.is_deleted = false
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'new_7d', (
        SELECT COUNT(*) FROM animals a
        JOIN farms f ON a.farm_id = f.id
        WHERE a.created_at > now() - interval '7 days' 
          AND a.is_deleted = false
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      ),
      'exits_30d', (
        SELECT COUNT(*) FROM animals a
        JOIN farms f ON a.farm_id = f.id
        WHERE a.exit_date > now() - interval '30 days'
          AND (data_category_filter = 'all' OR f.data_category = data_category_filter)
      )
    ),
    -- doc_aga, stt, approvals, support, feedback, sync, activity_trend 
    -- remain unchanged (user-centric, not farm-data-centric)
    ...
  ) INTO result;
  
  RETURN result;
END;
$$;
```

---

## Part 4: Update useSystemHealth Hook

**File: `src/hooks/useSystemHealth.ts`**

Accept optional data category parameter:

```typescript
import { DataCategory } from "@/types/government";

export function useSystemHealth(dataCategory: DataCategory = 'all') {
  return useQuery({
    queryKey: ["admin-system-health", dataCategory],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_health_metrics", {
        data_category_filter: dataCategory
      });
      if (error) throw error;
      return data as unknown as SystemHealthMetrics;
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
```

---

## Part 5: Update SystemOverview

**File: `src/components/admin/SystemOverview.tsx`**

Accept dataCategory prop:

```typescript
interface SystemOverviewProps {
  dataCategory?: DataCategory;
}

export const SystemOverview = ({ dataCategory = 'all' }: SystemOverviewProps) => {
  const { data: metrics, isLoading, error, refetch, dataUpdatedAt } = useSystemHealth(dataCategory);
  // ... rest unchanged
};
```

---

## Part 6: Update OperationsTab & FarmOversight

**File: `src/components/admin/tabs/OperationsTab.tsx`**

```typescript
interface OperationsTabProps {
  dataCategory?: DataCategory;
}

export const OperationsTab = ({ dataCategory = 'all' }: OperationsTabProps) => {
  return (
    <div className="space-y-6">
      <Tabs value={subtab} onValueChange={handleSubtabChange}>
        ...
        <TabsContent value="farms" className="mt-6">
          <FarmOversight dataCategory={dataCategory} />
        </TabsContent>
        ...
      </Tabs>
    </div>
  );
};
```

**File: `src/components/admin/FarmOversight.tsx`**

Add dataCategory prop and filter:

```typescript
interface FarmOversightProps {
  dataCategory?: DataCategory;
}

export const FarmOversight = ({ dataCategory = 'all' }: FarmOversightProps) => {
  const { data: farms, isLoading } = useQuery<FarmWithDetails[]>({
    queryKey: ["admin-farms", statusFilter, dataCategory],
    queryFn: async (): Promise<FarmWithDetails[]> => {
      let query = supabase.from("farms").select(`...`);

      // Apply data category filter
      if (dataCategory !== 'all') {
        query = query.eq("data_category", dataCategory);
      }

      // Apply status filter
      if (statusFilter === "active") {
        query = query.eq("is_deleted", false);
      } else if (statusFilter === "deactivated") {
        query = query.eq("is_deleted", true);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      // ...
    },
  });
};
```

---

## Part 7: Update AIVoiceTab & DocAgaManagement

**File: `src/components/admin/tabs/AIVoiceTab.tsx`**

```typescript
interface AIVoiceTabProps {
  dataCategory?: DataCategory;
}

export const AIVoiceTab = ({ dataCategory = 'all' }: AIVoiceTabProps) => {
  return <DocAgaManagement dataCategory={dataCategory} />;
};
```

**File: `src/components/admin/DocAgaManagement.tsx`**

Filter queries by farm data category:

```typescript
interface DocAgaManagementProps {
  dataCategory?: DataCategory;
}

export const DocAgaManagement = ({ dataCategory = 'all' }: DocAgaManagementProps) => {
  // Modify queries to filter by farm data category
  const { data: recentQueries } = useQuery({
    queryKey: ["admin-recent-queries", dataCategory],
    queryFn: async () => {
      // First get farm IDs matching the category
      let farmQuery = supabase.from("farms").select("id");
      if (dataCategory !== 'all') {
        farmQuery = farmQuery.eq("data_category", dataCategory);
      }
      const { data: farms } = await farmQuery;
      const farmIds = farms?.map(f => f.id) || [];

      // Then filter queries by those farm IDs
      let query = supabase
        .from("doc_aga_queries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (dataCategory !== 'all' && farmIds.length > 0) {
        query = query.in("farm_id", farmIds);
      } else if (dataCategory !== 'all' && farmIds.length === 0) {
        return []; // No farms match the category
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Similarly update queryStats, queryTimeline, etc.
};
```

---

## Tabs Not Requiring Data Category Filtering

The following tabs/components don't need data category filtering as they are user-centric rather than farm-data-centric:

- **People Tab**: User management, activity logs, role debugger - not tied to farm data
- **System Tab**: System-wide settings, not farm-specific
- **Support Tickets**: User support tickets, not filtered by farm data category
- **Merchant Oversight**: Merchants are separate from farm data categories

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/AdminDashboard.tsx` | Modify | Add dataCategory state, sync to URL, pass as props |
| `src/components/admin/AdminLayout.tsx` | Modify | Add data category selector in header |
| `src/hooks/useSystemHealth.ts` | Modify | Accept dataCategory parameter |
| `supabase/migrations/xxx.sql` | Create | Update RPC to filter by data category |
| `src/components/admin/SystemOverview.tsx` | Modify | Accept dataCategory prop |
| `src/components/admin/tabs/OperationsTab.tsx` | Modify | Accept and pass dataCategory prop |
| `src/components/admin/FarmOversight.tsx` | Modify | Filter farms by dataCategory |
| `src/components/admin/tabs/AIVoiceTab.tsx` | Modify | Accept and pass dataCategory prop |
| `src/components/admin/DocAgaManagement.tsx` | Modify | Filter queries by farm dataCategory |

---

## Testing Points

1. Navigate to Admin Dashboard - verify toggle appears in header
2. Switch to "Demo Data" - verify farm counts, animal counts change on Dashboard tab
3. Navigate to Operations > Farms - verify only demo farms are shown
4. Switch to "Live Data" - verify farms list updates to show only live farms
5. Navigate to AI & Voice - verify Doc Aga queries are filtered by farm category
6. Switch to "All Data" - verify all data is shown across all tabs
7. Refresh page - verify the selected filter persists in URL
8. People tab should remain unchanged (user data, not filtered)
