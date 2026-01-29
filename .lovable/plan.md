

# Milk Inventory Species-Based Segmentation Plan

## Current State Analysis

### What Exists Today

| Component | Current Behavior | Gap |
|-----------|-----------------|-----|
| **milk_inventory table** | Stores `animal_id` but no `livestock_type` | No direct species column; requires join to animals |
| **MilkInventoryItem interface** | Has `animal_id`, `animal_name`, `ear_tag` | Missing `livestock_type` field |
| **MilkStockList UI** | Groups inventory "By Animal" only | No grouping by species type |
| **RecordMilkSaleDialog** | Single price input for all milk | No species-aware pricing |
| **useLastMilkPrice hook** | Returns farm-wide last price (defaults to ₱65) | No species-specific pricing |
| **useMilkInventory hook** | Fetches from `animals(name, ear_tag)` join | Does not include `livestock_type` |
| **MilkInventorySummary** | `totalLiters`, `oldestDate`, `byAnimal` | No `bySpecies` breakdown |

### Database Reality (Current Data)

```text
Species     | Inventory Records | Liters Available | Avg Sale Price
----------- | ----------------- | ---------------- | --------------
Carabao     | 5,349             | 52,493.83 L      | (no sales yet)
Cattle      | 24,583            | 326,571.47 L     | ₱30.31/L
Goat        | 7,623             | 65,745.10 L      | ₱44.45/L
```

The data confirms goat milk is priced ~47% higher than cattle milk (₱44.45 vs ₱30.31).

---

## Solution Architecture

```text
SPECIES-SEGMENTED MILK INVENTORY:
┌─────────────────────────────────────────────────────────────────────────┐
│                     MilkInventoryTab.tsx                                │
│                             │                                           │
│                             ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ LEVEL 1: Species Summary Cards (NEW)                               │ │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                    │ │
│  │ │ 🐄 Cattle   │ │ 🐐 Goat     │ │ 🐃 Carabao  │                    │ │
│  │ │ 326,571 L   │ │ 65,745 L    │ │ 52,494 L    │                    │ │
│  │ │ ₱30/L avg   │ │ ₱45/L avg   │ │ ₱--/L       │                    │ │
│  │ │ [Sell]      │ │ [Sell]      │ │ [Sell]      │                    │ │
│  │ └─────────────┘ └─────────────┘ └─────────────┘                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                             │                                           │
│                             ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ LEVEL 2: Collapsible Species Sections                              │ │
│  │ ▼ Cattle (100 animals) ────────────────────────────────────────    │ │
│  │   • Bessie (Tag 001) ............ 5.2 L                            │ │
│  │   • Daisy (Tag 002) ............. 3.8 L                            │ │
│  │                                                                     │ │
│  │ ▼ Goat (33 animals) ───────────────────────────────────────────    │ │
│  │   • Nanny (Tag G01) ............. 1.2 L                            │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                             │                                           │
│                             ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ LEVEL 3: Species-Specific Sale Dialog                              │ │
│  │ ┌─────────────────────────────────────────────────────────────┐   │ │
│  │ │ Record Goat Milk Sale                                        │   │ │
│  │ │                                                              │   │ │
│  │ │ Available: 65,745 L from 33 animals                          │   │ │
│  │ │ Last Price: ₱44.45/L                                         │   │ │
│  │ │                                                              │   │ │
│  │ │ [Liters: ____] [Price/L: 44.45]                              │   │ │
│  │ └─────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Update Data Layer

#### 1.1 Update useMilkInventory Hook

**File:** `src/hooks/useMilkInventory.ts`

Add `livestock_type` to the query and update interfaces:

```typescript
// Updated MilkInventoryItem interface
export interface MilkInventoryItem {
  id: string;
  milking_record_id: string;
  animal_id: string;
  animal_name: string | null;
  ear_tag: string | null;
  livestock_type: string;        // NEW
  record_date: string;
  liters_original: number;
  liters_remaining: number;
  is_available: boolean;
  created_at: string;
}

// NEW: Species-level summary
export interface SpeciesSummary {
  livestock_type: string;
  total_liters: number;
  animal_count: number;
  oldest_date: string | null;
  avg_price: number | null;      // Last known price for this species
}

// Updated MilkInventorySummary
export interface MilkInventorySummary {
  totalLiters: number;
  oldestDate: string | null;
  bySpecies: SpeciesSummary[];   // NEW
  byAnimal: { ... }[];
}
```

Update the Supabase query to include `livestock_type`:

```typescript
// In serverQuery queryFn
const { data, error } = await supabase
  .from("milk_inventory")
  .select(`
    id, milking_record_id, animal_id, record_date,
    liters_original, liters_remaining, is_available, created_at,
    animals!inner(name, ear_tag, livestock_type)  // ADD livestock_type
  `)
  .eq("farm_id", farmId)
  .eq("is_available", true)
  .gte("liters_remaining", 0.05)
  .order("record_date", { ascending: true });
```

Add species grouping to the summary calculation:

```typescript
// Group by species
const speciesMap = new Map<string, {
  total_liters: number;
  animal_ids: Set<string>;
  oldest_date: string;
}>();

items.forEach(item => {
  const type = item.livestock_type;
  const existing = speciesMap.get(type);
  if (existing) {
    existing.total_liters += item.liters_remaining;
    existing.animal_ids.add(item.animal_id);
    if (item.record_date < existing.oldest_date) {
      existing.oldest_date = item.record_date;
    }
  } else {
    speciesMap.set(type, {
      total_liters: item.liters_remaining,
      animal_ids: new Set([item.animal_id]),
      oldest_date: item.record_date,
    });
  }
});

const bySpecies = Array.from(speciesMap.entries()).map(([livestock_type, data]) => ({
  livestock_type,
  total_liters: data.total_liters,
  animal_count: data.animal_ids.size,
  oldest_date: data.oldest_date,
  avg_price: null, // Will be fetched separately
})).sort((a, b) => b.total_liters - a.total_liters);
```

#### 1.2 Create Species-Aware Price Hook

**File:** `src/hooks/useRevenues.ts`

Add a new hook for species-specific pricing:

```typescript
export function useLastMilkPriceBySpecies(farmId: string) {
  return useQuery({
    queryKey: ["last-milk-price-by-species", farmId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milking_records")
        .select(`
          price_per_liter, 
          animal_id, 
          created_at,
          animals!inner(farm_id, livestock_type)
        `)
        .eq("animals.farm_id", farmId)
        .eq("is_sold", true)
        .not("price_per_liter", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by species, take most recent price
      const priceMap: Record<string, number> = {};
      const seen = new Set<string>();
      
      for (const record of data || []) {
        const type = record.animals?.livestock_type;
        if (type && !seen.has(type)) {
          priceMap[type] = record.price_per_liter;
          seen.add(type);
        }
      }

      // Defaults if no sales history
      return {
        cattle: priceMap.cattle ?? 30,
        goat: priceMap.goat ?? 45,
        carabao: priceMap.carabao ?? 35,
        sheep: priceMap.sheep ?? 50,
      };
    },
    enabled: !!farmId,
  });
}
```

### Phase 2: Update UI Components

#### 2.1 Create Species Summary Cards Component

**File:** `src/components/milk-inventory/MilkSpeciesSummary.tsx` (NEW)

```typescript
// Component showing summary cards for each species
// Each card displays: Icon, Species Name, Total Liters, Avg Price, Sell Button
// Clicking "Sell" opens RecordMilkSaleDialog pre-filtered to that species
```

#### 2.2 Update MilkStockList Component

**File:** `src/components/milk-inventory/MilkStockList.tsx`

Changes:
1. Add species summary cards at the top (before "By Animal" section)
2. Group animals under species collapsibles
3. Add species filter to the breakdown section
4. Add species icon/badge to each animal row

#### 2.3 Update RecordMilkSaleDialog Component

**File:** `src/components/milk-inventory/RecordMilkSaleDialog.tsx`

Changes:
1. Accept optional `filterSpecies?: string` prop
2. Filter `availableItems` by species when set
3. Use species-specific default price from `useLastMilkPriceBySpecies`
4. Update dialog title to show species (e.g., "Record Goat Milk Sale")
5. Show species-specific inventory in the preview

### Phase 3: Update Cache Layer

**File:** `src/lib/dataCache.ts`

Update `MilkInventoryCacheItem` interface to include `livestock_type`:

```typescript
export interface MilkInventoryCacheItem {
  id: string;
  milking_record_id: string;
  animal_id: string;
  animal_name: string | null;
  ear_tag: string | null;
  livestock_type: string;        // NEW
  record_date: string;
  liters_original: number;
  liters_remaining: number;
  is_available: boolean;
  created_at: string;
  client_generated_id?: string;
  syncStatus: 'synced' | 'pending';
}
```

---

## Files to Modify

| # | File | Action | Changes |
|---|------|--------|---------|
| 1 | `src/hooks/useMilkInventory.ts` | MODIFY | Add `livestock_type` to query, add `bySpecies` to summary |
| 2 | `src/hooks/useRevenues.ts` | MODIFY | Add `useLastMilkPriceBySpecies` hook |
| 3 | `src/lib/dataCache.ts` | MODIFY | Add `livestock_type` to `MilkInventoryCacheItem` |
| 4 | `src/components/milk-inventory/MilkSpeciesSummary.tsx` | CREATE | New species summary cards component |
| 5 | `src/components/milk-inventory/MilkStockList.tsx` | MODIFY | Add species grouping, integrate summary cards |
| 6 | `src/components/milk-inventory/RecordMilkSaleDialog.tsx` | MODIFY | Add species filter & species-specific pricing |
| 7 | `src/components/milk-inventory/MilkSalesHistory.tsx` | MODIFY | Add species column/filter to sales history |

---

## UI Mockup

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 🥛 Milk Inventory                                            [Refresh] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐           │
│  │ 🐄 CATTLE       │ │ 🐐 GOAT         │ │ 🐃 CARABAO      │           │
│  │                 │ │                 │ │                 │           │
│  │ 326,571.5 L     │ │ 65,745.1 L      │ │ 52,493.8 L      │           │
│  │ 100 animals     │ │ 33 animals      │ │ 22 animals      │           │
│  │ ~₱30/L          │ │ ~₱45/L          │ │ No sales yet    │           │
│  │                 │ │                 │ │                 │           │
│  │ [💰 Sell Cattle]│ │ [💰 Sell Goat]  │ │ [💰 Sell Cara]  │           │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘           │
│                                                                         │
│  ──────────────────────────────────────────────────────────────────    │
│                                                                         │
│  📊 By Species                                                          │
│                                                                         │
│  ▼ Cattle (100 animals) ─────────────────────── 326,571.5 L            │
│    │                                                                    │
│    │ ▶ Bessie (Tag C001) ──────────── Fresh ──── 12.5 L                │
│    │ ▶ Daisy (Tag C002) ───────────── Aging ──── 8.3 L                 │
│    │ ...                                                                │
│                                                                         │
│  ▼ Goat (33 animals) ────────────────────────── 65,745.1 L             │
│    │                                                                    │
│    │ ▶ Nanny (Tag G001) ──────────── Fresh ──── 2.1 L                  │
│    │ ...                                                                │
│                                                                         │
│  ▶ Carabao (22 animals) ─────────────────────── 52,493.8 L             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Government Portal Integration

The government portal will automatically benefit from species-segregated data through the existing `get_government_stats_timeseries` RPC. However, to provide proper milk market price reporting:

### Future Enhancement (Separate Task)

Add a new government analytics component showing:
- Average milk prices by species across regions
- Price trends over time by species
- Production volume by species
- Market price comparison tool

This would require:
1. New RPC function: `get_milk_price_analytics_by_species`
2. New component: `MilkPriceAnalyticsCard` in government dashboard

---

## Expected Outcomes

| Capability | Before | After |
|------------|--------|-------|
| View milk by species | ❌ | ✅ Separate cards per species |
| Sell specific species | ❌ | ✅ Species-filtered sale dialog |
| Species-specific pricing | ❌ | ✅ Default prices by species |
| FIFO within species | ❌ | ✅ Oldest of selected species first |
| Track price per species | Partial | ✅ Full history with species tag |
| Government price reporting | ❌ | ✅ (Future enhancement) |

