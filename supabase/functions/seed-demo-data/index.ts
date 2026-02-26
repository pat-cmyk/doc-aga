import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Deterministic pseudo-random from animal ID + date string
function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs((Math.sin(hash) * 10000) % 1)
}

function randBetween(min: number, max: number, seed: string): number {
  return min + seededRandom(seed) * (max - min)
}

function roundTo(n: number, decimals: number): number {
  const f = Math.pow(10, decimals)
  return Math.round(n * f) / f
}

interface SpeciesConfig {
  milkMin: number
  milkMax: number
  feedMin: number
  feedMax: number
  bcsMin: number
  bcsMax: number
  weightRanges: Record<string, [number, number]>
}

const SPECIES_CONFIG: Record<string, SpeciesConfig> = {
  cattle: {
    milkMin: 8, milkMax: 25,
    feedMin: 8, feedMax: 15,
    bcsMin: 2.5, bcsMax: 4.0,
    weightRanges: {
      'Calf': [40, 120], 'Weaner': [120, 250], 'Yearling': [250, 380],
      'Heifer': [300, 450], 'Mature Cow': [400, 600], 'Mature Bull': [500, 800],
      default: [300, 500],
    },
  },
  goat: {
    milkMin: 1, milkMax: 5,
    feedMin: 2, feedMax: 5,
    bcsMin: 2.5, bcsMax: 3.5,
    weightRanges: {
      'Kid': [3, 15], 'Yearling': [15, 30], 'Mature Doe': [30, 60],
      'Mature Buck': [40, 80], default: [25, 45],
    },
  },
  carabao: {
    milkMin: 4, milkMax: 10,
    feedMin: 10, feedMax: 20,
    bcsMin: 2.5, bcsMax: 4.0,
    weightRanges: {
      'Calf': [50, 150], 'Yearling': [150, 300], 'Mature Carabao': [400, 700],
      default: [350, 550],
    },
  },
}

const HEALTH_CHECKS = [
  { diagnosis: 'Routine Deworming', treatment: 'Albendazole 10mg/kg administered orally' },
  { diagnosis: 'Vaccination - FMD', treatment: 'FMD vaccine administered IM' },
  { diagnosis: 'General Health Check', treatment: 'No issues found, animal in good condition' },
  { diagnosis: 'Vitamin Supplementation', treatment: 'Vitamin B complex injection administered' },
  { diagnosis: 'Hoof Trimming', treatment: 'Routine hoof maintenance performed' },
]

interface InventoryItem {
  id: string
  feed_type: string
  category: string | null
  quantity_kg: number
  cost_per_unit: number | null
}

/**
 * Pick a feed source from inventory (prefer roughage), or fallback to Fresh Cut & Carry.
 * Returns { feed_inventory_id, feed_type, cost_per_kg_at_time } and deducts from localBalances.
 */
function pickFeedSource(
  inventory: InventoryItem[],
  localBalances: Map<string, number>,
  kg: number,
  seed: string,
): { feed_inventory_id: string | null; feed_type: string; cost_per_kg_at_time: number } {
  // Filter to items with remaining balance
  const available = inventory.filter(i => (localBalances.get(i.id) ?? 0) > 0)
  if (available.length === 0) {
    return { feed_inventory_id: null, feed_type: 'Fresh Cut & Carry', cost_per_kg_at_time: 0 }
  }

  // Prefer roughage
  const roughage = available.filter(i => (i.category || '').toLowerCase() === 'roughage')
  const pool = roughage.length > 0 ? roughage : available

  const idx = Math.floor(seededRandom(seed) * pool.length)
  const picked = pool[idx]
  const balance = localBalances.get(picked.id) ?? 0
  const deduct = Math.min(balance, kg)
  localBalances.set(picked.id, balance - deduct)

  return {
    feed_inventory_id: picked.id,
    feed_type: picked.feed_type,
    cost_per_kg_at_time: picked.cost_per_unit ?? 0,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Auth: allow cron (service role) or admin JWT
    let userId: string | null = null
    const body = await req.json().catch(() => ({}))
    const isCron = body?.source === 'cron'

    if (!isCron) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }

      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })

      const token = authHeader.replace('Bearer ', '')
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
      }
      userId = claimsData.claims.sub as string

      const { data: isAdmin } = await userClient.rpc('is_super_admin', { _user_id: userId })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden: super admin only' }), { status: 403, headers: corsHeaders })
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 1. Fetch demo farms
    const { data: demoFarms, error: farmErr } = await supabase
      .from('farms')
      .select('id, name, livestock_type')
      .eq('data_category', 'demo')
      .eq('is_deleted', false)

    if (farmErr) throw farmErr
    if (!demoFarms?.length) {
      return new Response(JSON.stringify({ message: 'No demo farms found', summary: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    const summary: Array<{
      farm_id: string
      farm_name: string
      livestock_type: string
      animals_processed: number
      milking_inserted: number
      weight_inserted: number
      health_inserted: number
      bcs_inserted: number
      feeding_inserted: number
      inventory_linked: number
      zero_cost_fallback: number
    }> = []

    for (const farm of demoFarms) {
      const { data: animals, error: animErr } = await supabase
        .from('animals')
        .select('id, gender, life_stage, is_currently_lactating, birth_date, unique_code, livestock_type')
        .eq('farm_id', farm.id)
        .eq('is_deleted', false)
        .is('exit_date', null)

      if (animErr || !animals?.length) continue

      const animalIds = animals.map((a: any) => a.id)

      // Fetch existing records + farm inventory in parallel
      const [milkRes, weightRes, healthRes, bcsRes, feedRes, invRes] = await Promise.all([
        supabase.from('milking_records').select('animal_id, record_date, session').in('animal_id', animalIds).gte('record_date', sevenDaysAgoStr),
        supabase.from('weight_records').select('animal_id').in('animal_id', animalIds).gte('measurement_date', thirtyDaysAgoStr),
        supabase.from('health_records').select('animal_id').in('animal_id', animalIds).gte('visit_date', thirtyDaysAgoStr),
        supabase.from('body_condition_scores').select('animal_id').in('animal_id', animalIds).gte('assessment_date', thirtyDaysAgoStr),
        supabase.from('feeding_records').select('animal_id, record_datetime').in('animal_id', animalIds).gte('record_datetime', sevenDaysAgo.toISOString()),
        supabase.from('feed_inventory').select('id, feed_type, category, quantity_kg, cost_per_unit').eq('farm_id', farm.id).gt('quantity_kg', 0).order('created_at', { ascending: true }),
      ])

      // Build sets for existing data
      const existingMilk = new Set((milkRes.data || []).map((r: any) => `${r.animal_id}_${r.record_date}_${r.session}`))
      const animalsWithWeight = new Set((weightRes.data || []).map((r: any) => r.animal_id))
      const animalsWithHealth = new Set((healthRes.data || []).map((r: any) => r.animal_id))
      const animalsWithBCS = new Set((bcsRes.data || []).map((r: any) => r.animal_id))
      const existingFeed = new Set((feedRes.data || []).map((r: any) => {
        const d = new Date(r.record_datetime).toISOString().split('T')[0]
        return `${r.animal_id}_${d}`
      }))

      // Inventory: build local balance tracker (FIFO deduction)
      const farmInventory: InventoryItem[] = (invRes.data || []) as InventoryItem[]
      const localBalances = new Map<string, number>()
      for (const item of farmInventory) {
        localBalances.set(item.id, Number(item.quantity_kg))
      }

      const milkInserts: any[] = []
      const weightInserts: any[] = []
      const healthInserts: any[] = []
      const bcsInserts: any[] = []
      const feedInserts: any[] = []
      let inventoryLinked = 0
      let zeroCostFallback = 0

      for (const animal of animals) {
        const animalSpecies = (animal.livestock_type || farm.livestock_type || 'cattle').toLowerCase()
        const config = SPECIES_CONFIG[animalSpecies] || SPECIES_CONFIG.cattle
        const isFemale = animal.gender === 'Female' || animal.gender === 'female'
        const isLactating = animal.is_currently_lactating || (isFemale && (animal.life_stage || '').match(/Cow|Doe|Carabao|Mature/i))

        // Milking: only for lactating females, single "Full Day" record per day
        if (isLactating && isFemale) {
          for (let d = 1; d <= 7; d++) {
            const date = new Date(now)
            date.setDate(date.getDate() - d)
            const dateStr = date.toISOString().split('T')[0]

            const hasAM = existingMilk.has(`${animal.id}_${dateStr}_AM`)
            const hasPM = existingMilk.has(`${animal.id}_${dateStr}_PM`)
            const hasFullDay = existingMilk.has(`${animal.id}_${dateStr}_Full Day`)

            if (!hasAM && !hasPM && !hasFullDay) {
              const liters = roundTo(randBetween(config.milkMin, config.milkMax, `${animal.id}_${dateStr}_FD`), 1)
              milkInserts.push({
                animal_id: animal.id,
                record_date: dateStr,
                session: 'Full Day',
                liters,
              })
            }
          }
        }

        // Weight: if none in last 30 days
        if (!animalsWithWeight.has(animal.id)) {
          const lifeStage = animal.life_stage || 'default'
          const range = config.weightRanges[lifeStage] || config.weightRanges.default
          const weight = roundTo(randBetween(range[0], range[1], `${animal.id}_weight`), 1)
          weightInserts.push({
            animal_id: animal.id,
            weight_kg: weight,
            measurement_date: yesterdayStr,
            measurement_method: 'Estimated',
            notes: 'Auto-seeded demo data',
          })
        }

        // Health: if none in last 30 days
        if (!animalsWithHealth.has(animal.id)) {
          const checkIdx = Math.floor(seededRandom(`${animal.id}_health`) * HEALTH_CHECKS.length)
          const check = HEALTH_CHECKS[checkIdx]
          const visitDate = new Date(yesterday)
          visitDate.setDate(visitDate.getDate() - Math.floor(seededRandom(`${animal.id}_hdate`) * 14))
          healthInserts.push({
            animal_id: animal.id,
            visit_date: visitDate.toISOString().split('T')[0],
            diagnosis: check.diagnosis,
            treatment: check.treatment,
            notes: 'Auto-seeded demo data',
          })
        }

        // BCS: if none in last 30 days
        if (!animalsWithBCS.has(animal.id)) {
          const score = roundTo(randBetween(config.bcsMin, config.bcsMax, `${animal.id}_bcs`), 1)
          const roundedScore = Math.round(score * 2) / 2
          bcsInserts.push({
            animal_id: animal.id,
            farm_id: farm.id,
            score: roundedScore,
            assessment_date: yesterdayStr,
            notes: 'Auto-seeded demo data',
          })
        }

        // Feeding: daily for last 7 days — linked to inventory
        for (let d = 1; d <= 7; d++) {
          const date = new Date(now)
          date.setDate(date.getDate() - d)
          const dateStr = date.toISOString().split('T')[0]
          const feedKey = `${animal.id}_${dateStr}`

          if (!existingFeed.has(feedKey)) {
            const kg = roundTo(randBetween(config.feedMin, config.feedMax, `${animal.id}_fkg_${dateStr}`), 1)
            const source = pickFeedSource(farmInventory, localBalances, kg, `${animal.id}_finv_${dateStr}`)

            if (source.feed_inventory_id) {
              inventoryLinked++
            } else {
              zeroCostFallback++
            }

            feedInserts.push({
              animal_id: animal.id,
              record_datetime: `${dateStr}T07:00:00+08:00`,
              feed_type: source.feed_type,
              kilograms: kg,
              feed_inventory_id: source.feed_inventory_id,
              cost_per_kg_at_time: source.cost_per_kg_at_time,
              notes: 'Auto-seeded demo data',
            })
          }
        }
      }

      // Batch insert all records
      const batchSize = 500
      let milkCount = 0, weightCount = 0, healthCount = 0, bcsCount = 0, feedCount = 0

      for (let i = 0; i < milkInserts.length; i += batchSize) {
        const { error } = await supabase.from('milking_records').insert(milkInserts.slice(i, i + batchSize))
        if (!error) milkCount += Math.min(batchSize, milkInserts.length - i)
      }
      for (let i = 0; i < weightInserts.length; i += batchSize) {
        const { error } = await supabase.from('weight_records').insert(weightInserts.slice(i, i + batchSize))
        if (!error) weightCount += Math.min(batchSize, weightInserts.length - i)
      }
      for (let i = 0; i < healthInserts.length; i += batchSize) {
        const { error } = await supabase.from('health_records').insert(healthInserts.slice(i, i + batchSize))
        if (!error) healthCount += Math.min(batchSize, healthInserts.length - i)
      }
      for (let i = 0; i < bcsInserts.length; i += batchSize) {
        const { error } = await supabase.from('body_condition_scores').insert(bcsInserts.slice(i, i + batchSize))
        if (!error) bcsCount += Math.min(batchSize, bcsInserts.length - i)
      }
      for (let i = 0; i < feedInserts.length; i += batchSize) {
        const { error } = await supabase.from('feeding_records').insert(feedInserts.slice(i, i + batchSize))
        if (!error) feedCount += Math.min(batchSize, feedInserts.length - i)
      }

      // Batch update inventory balances (deduct consumed amounts)
      for (const item of farmInventory) {
        const originalQty = Number(item.quantity_kg)
        const newBalance = localBalances.get(item.id) ?? originalQty
        if (newBalance < originalQty) {
          await supabase
            .from('feed_inventory')
            .update({ quantity_kg: newBalance, last_updated: new Date().toISOString() })
            .eq('id', item.id)
        }
      }

      summary.push({
        farm_id: farm.id,
        farm_name: farm.name,
        livestock_type: farm.livestock_type,
        animals_processed: animals.length,
        milking_inserted: milkCount,
        weight_inserted: weightCount,
        health_inserted: healthCount,
        bcs_inserted: bcsCount,
        feeding_inserted: feedCount,
        inventory_linked: inventoryLinked,
        zero_cost_fallback: zeroCostFallback,
      })
    }

    const totalRecords = summary.reduce((sum, s) =>
      sum + s.milking_inserted + s.weight_inserted + s.health_inserted + s.bcs_inserted + s.feeding_inserted, 0)

    return new Response(JSON.stringify({
      success: true,
      farms_processed: summary.length,
      total_records_inserted: totalRecords,
      summary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('seed-demo-data error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
