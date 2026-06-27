import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildCorsHeaders } from "../_shared/cors.ts";

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

const GESTATION_DAYS: Record<string, number> = {
  cattle: 283,
  goat: 150,
  carabao: 310,
}

const SEMEN_CODES: Record<string, string[]> = {
  cattle: ['HF-2024-A', 'JER-2024-B', 'ANG-2024-C', 'SAH-2024-D'],
  goat: ['ALP-2024-A', 'SAA-2024-B', 'BOE-2024-C'],
  carabao: ['MUR-2024-A', 'CAR-2024-B'],
}

// ── Farmer Feedback Templates ──────────────────────────────────────────

interface FeedbackTemplate {
  category: string
  transcriptions: Record<string, string[]> // keyed by livestock_type
  tags: string[]
  detected_entities: any
  ai_summary: string
  department: string
}

const FEEDBACK_TEMPLATES: FeedbackTemplate[] = [
  {
    category: 'market_access',
    transcriptions: {
      cattle: [
        'Ang presyo ng baka sa palengke ay napakababa ngayon. Hindi na sulit ang gastos sa feeds. Kailangan namin ng tulong sa paghanap ng mas magandang buyer.',
        'Walang livestock auction dito sa amin. Kailangan naming pumunta pa sa kabilang probinsya para makapagbenta ng baka.',
      ],
      goat: [
        'Hirap kaming magbenta ng kambing dahil walang organized market dito. Gusto namin ng cooperative marketing.',
        'Ang presyo ng chevon ay bumaba. Paano namin mapapataas ang halaga ng aming mga kambing?',
      ],
      carabao: [
        'Wala kaming alam na buyer ng carabao milk sa aming lugar. Gusto namin ng market linkage.',
        'Ang carabao meat ay mababa ang demand dito. Kailangan ng promotion sa aming produkto.',
      ],
    },
    tags: ['market', 'pricing', 'buyer', 'auction'],
    detected_entities: null,
    ai_summary: 'Farmer reports difficulty accessing markets and getting fair prices for livestock products.',
    department: 'Department of Agriculture - Marketing',
  },
  {
    category: 'disease_outbreak',
    transcriptions: {
      cattle: [
        'May tatlong baka na biglang nagkasakit. Nilalagnat at hindi kumakain. Baka FMD po ito. Kailangan po agad ng veterinarian.',
        'Nakita ko na ang dalawang baka ay may sugat sa bibig at paa. Parang foot and mouth disease. Natatakot ako na kumalat sa ibang hayop.',
      ],
      goat: [
        'Maraming kambing ang nagtatae at nilalagnat. Parang peste des petits ruminants. Urgent po ito.',
        'May dalawang kambing na biglang namatay. Hindi ko alam kung anong sakit. Kailangan ng investigation.',
      ],
      carabao: [
        'Ang aming carabao ay may hemorrhagic septicemia symptoms. Nagmamanas ang leeg at hirap huminga.',
        'Tatlong carabao ang may surra symptoms - payat, malaki ang tiyan, at matamlay.',
      ],
    },
    tags: ['disease', 'outbreak', 'emergency', 'veterinary'],
    detected_entities: { diseases: ['FMD', 'hemorrhagic septicemia'], locations: ['farm'] },
    ai_summary: 'Urgent disease outbreak reported requiring immediate veterinary intervention.',
    department: 'Bureau of Animal Industry',
  },
  {
    category: 'veterinary_support',
    transcriptions: {
      cattle: [
        'Walang veterinarian sa aming barangay. Kung may sakit ang baka, kailangan pang mag-travel ng malayo.',
        'Kailangan namin ng regular veterinary visits para sa vaccination at deworming ng mga baka.',
      ],
      goat: [
        'Ang pinakamalapit na vet clinic ay dalawang oras ang layo. Kailangan namin ng mobile vet service para sa mga kambing.',
        'Gusto namin matuto kung paano mag-basic health check sa mga kambing. Training po sana.',
      ],
      carabao: [
        'Ang carabao namin ay nangangailangan ng AI service pero walang technician dito sa amin.',
        'Kailangan namin ng mas madalas na veterinary mission sa aming lugar para sa mga carabao.',
      ],
    },
    tags: ['veterinary', 'healthcare', 'access', 'rural'],
    detected_entities: null,
    ai_summary: 'Farmer lacks access to veterinary services in their area.',
    department: 'Provincial Veterinary Office',
  },
  {
    category: 'feed_shortage',
    transcriptions: {
      cattle: [
        'Dahil sa tag-init, wala nang halos damo para sa mga baka. Kailangan namin ng alternative feed source.',
        'Ang presyo ng commercial feeds ay tumaas ng malaki. Hindi na kaya ng aming budget.',
      ],
      goat: [
        'Nauubusan na kami ng pastulan para sa mga kambing. Sobrang init at tuyo na ang lahat.',
        'Walang available na concentrate feeds dito sa amin. Ang kambing ay pumapayat.',
      ],
      carabao: [
        'Ang rice straw ay hindi na sapat para sa aming mga carabao. Kailangan ng silage training.',
        'Tag-init at walang fresh grass. Ang carabao ay bumababa ang milk production.',
      ],
    },
    tags: ['feed', 'shortage', 'drought', 'nutrition'],
    detected_entities: null,
    ai_summary: 'Feed shortage reported due to drought or high commercial feed prices.',
    department: 'Department of Agriculture - Livestock',
  },
  {
    category: 'training_request',
    transcriptions: {
      cattle: [
        'Gusto naming matuto ng proper dairy farming techniques. Wala kaming training sa aming lugar.',
        'Paano po gumawa ng silage? Gusto naming matuto para hindi masayang ang damo sa tag-ulan.',
      ],
      goat: [
        'Kailangan namin ng training sa goat breeding at health management.',
        'Gusto naming matuto ng cheese making para ma-add value ang goat milk.',
      ],
      carabao: [
        'Gusto naming mag-training sa proper carabao milking techniques at milk handling.',
        'Kailangan ng seminar sa carabao management, lalo na sa reproductive health.',
      ],
    },
    tags: ['training', 'capacity-building', 'skills', 'education'],
    detected_entities: null,
    ai_summary: 'Farmer requests training programs for improved livestock management.',
    department: 'Agricultural Training Institute',
  },
  {
    category: 'infrastructure',
    transcriptions: {
      cattle: [
        'Kailangan namin ng concrete watering trough. Ang mga baka ay umiinom sa maruming ilog.',
        'Walang maayos na cattle shed sa aming farm. Kapag umuulan, basa lahat ng baka.',
      ],
      goat: [
        'Kailangan po namin ng elevated goat house. Ang mga kambing namin ay sa lupa lang natutulog.',
        'Walang proper fencing sa aming goat farm. Madalas nakakatakas ang mga kambing.',
      ],
      carabao: [
        'Ang milking parlor namin ay sira na. Kailangan ng repair o palitan.',
        'Walang wallow area ang mga carabao namin. Kailangan ng concrete wallow.',
      ],
    },
    tags: ['infrastructure', 'facilities', 'housing', 'water'],
    detected_entities: null,
    ai_summary: 'Farmer needs infrastructure improvements for livestock housing and facilities.',
    department: 'Department of Agriculture - Engineering',
  },
  {
    category: 'financial_assistance',
    transcriptions: {
      cattle: [
        'Gusto naming mag-loan para makabili ng mas maraming baka pero walang available na program sa amin.',
        'Kailangan po namin ng financial support para sa cattle fattening project.',
      ],
      goat: [
        'May program po ba na pwede kaming maka-avail ng goat dispersal? Gusto naming palakihin ang aming herd.',
        'Ang insurance ng kambing ay napakamahal. May subsidized insurance po ba?',
      ],
      carabao: [
        'Gusto naming mag-apply ng loan para sa dairy carabao enterprise pero hindi kami qualified sa bangko.',
        'Kailangan namin ng crop insurance na kasama ang carabao para protektado kami sa bagyo.',
      ],
    },
    tags: ['finance', 'loan', 'insurance', 'subsidy'],
    detected_entities: null,
    ai_summary: 'Farmer seeks financial assistance programs for livestock enterprise expansion.',
    department: 'Landbank - Agricultural Lending',
  },
  {
    category: 'policy_concern',
    transcriptions: {
      cattle: [
        'Bakit po ang importation ng beef ay patuloy? Bumababa tuloy ang presyo ng local na baka.',
        'Ang regulation sa livestock transport ay sobrang strict. Nahihirapan kaming mag-transport ng baka.',
      ],
      goat: [
        'Walang clear na policy sa goat farming standards dito sa amin. Sana may guidelines.',
        'Ang local ordinance ay nagbabawal ng goat raising sa residential areas. Paano kami?',
      ],
      carabao: [
        'Ang batas na nagbabawal ng carabao slaughter ay nakakaapekto sa aming kabuhayan.',
        'Kailangan ng mas malinaw na policy sa carabao dairy development.',
      ],
    },
    tags: ['policy', 'regulation', 'government', 'legislation'],
    detected_entities: null,
    ai_summary: 'Farmer raises concerns about agricultural policies affecting their livelihood.',
    department: 'Department of Agriculture - Policy',
  },
  {
    category: 'emergency_support',
    transcriptions: {
      cattle: [
        'Binaha ang farm namin. Tatlong baka ang namatay at sira ang lahat ng feeds namin. Kailangan ng agarang tulong.',
        'Tinamaan ng bagyo ang aming barn. Kailangan ng emergency shelter para sa mga baka.',
      ],
      goat: [
        'Nasunog ang goat house namin kagabi. Lahat ng kambing ay walang shelter ngayon.',
        'Landslide sa aming farm. May mga kambing na na-trap. Kailangan ng rescue.',
      ],
      carabao: [
        'Flash flood sa aming lugar. Kailangan ng emergency evacuation para sa mga carabao.',
        'Nasira ang lahat ng stored feeds dahil sa bagyo. Kailangan ng emergency feed supply.',
      ],
    },
    tags: ['emergency', 'disaster', 'flood', 'typhoon', 'urgent'],
    detected_entities: null,
    ai_summary: 'Farmer reports an emergency situation requiring immediate disaster response.',
    department: 'DSWD - Disaster Response',
  },
]

const PRIORITY_WEIGHTS = [
  { priority: 'critical', weight: 0.10, scoreMin: 85, scoreMax: 100, sentiments: ['urgent'] },
  { priority: 'high', weight: 0.20, scoreMin: 65, scoreMax: 84, sentiments: ['urgent', 'negative'] },
  { priority: 'medium', weight: 0.40, scoreMin: 35, scoreMax: 64, sentiments: ['negative', 'neutral'] },
  { priority: 'low', weight: 0.30, scoreMin: 0, scoreMax: 34, sentiments: ['neutral', 'positive'] },
]

const FEEDBACK_STATUSES = ['submitted', 'acknowledged', 'under_review', 'action_taken', 'resolved', 'closed']

function pickPriority(seed: string) {
  const r = seededRandom(seed)
  let cumulative = 0
  for (const p of PRIORITY_WEIGHTS) {
    cumulative += p.weight
    if (r < cumulative) return p
  }
  return PRIORITY_WEIGHTS[PRIORITY_WEIGHTS.length - 1]
}

function pickFeedbackStatus(daysAgo: number, seed: string): string {
  const r = seededRandom(seed)
  if (daysAgo > 60) {
    // Old: mostly resolved/closed
    if (r < 0.4) return 'resolved'
    if (r < 0.7) return 'closed'
    if (r < 0.85) return 'action_taken'
    return 'under_review'
  } else if (daysAgo > 30) {
    if (r < 0.2) return 'resolved'
    if (r < 0.4) return 'action_taken'
    if (r < 0.65) return 'under_review'
    if (r < 0.85) return 'acknowledged'
    return 'submitted'
  } else {
    // Recent: mostly new
    if (r < 0.4) return 'submitted'
    if (r < 0.65) return 'acknowledged'
    if (r < 0.8) return 'under_review'
    return 'action_taken'
  }
}

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
  const corsHeaders = buildCorsHeaders(req, "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version");
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
      ai_inserted: number
      feedback_inserted: number
      inventory_linked: number
      zero_cost_fallback: number
    }> = []

    for (const farm of demoFarms) {
      const { data: animals, error: animErr } = await supabase
        .from('animals')
        .select('id, gender, life_stage, is_currently_lactating, birth_date, unique_code, livestock_type, parity, last_calving_date, fertility_status')
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

      // Fetch existing AI records for this farm's animals
      const { data: existingAI } = await supabase
        .from('ai_records')
        .select('animal_id')
        .in('animal_id', animalIds)
        .gte('scheduled_date', thirtyDaysAgoStr)

      const animalsWithAI = new Set((existingAI || []).map((r: any) => r.animal_id))

      const milkInserts: any[] = []
      const weightInserts: any[] = []
      const healthInserts: any[] = []
      const bcsInserts: any[] = []
      const feedInserts: any[] = []
      const aiInserts: any[] = []
      const breedingEventInserts: any[] = []
      let inventoryLinked = 0
      let zeroCostFallback = 0

      for (const animal of animals) {
        // Use animal's species directly; never fall back to farm.livestock_type
        // which is now a category ('ruminant') not a species ('cattle')
        const animalSpecies = (animal.livestock_type || 'cattle').toLowerCase()
        const config = SPECIES_CONFIG[animalSpecies] || SPECIES_CONFIG.cattle
        const isFemale = animal.gender === 'Female' || animal.gender === 'female'
        const isCalf = !!(animal.life_stage || '').match(/Calf|Newborn|Baby/i)
        const isLactating = animal.is_currently_lactating || (isFemale && (animal.life_stage || '').match(/Cow|Doe|Carabao|Mature/i))
        // Mature female = non-calf female (used for AI eligibility)
        const isMatureFemale = isFemale && !isCalf
        // Milking eligibility requires calving evidence (parity > 0 or last_calving_date)
        // to avoid biologically impossible milking records for pre-breeding animals
        const hasCalved = (animal as any).parity > 0 || !!(animal as any).last_calving_date
        const isEligibleForMilking = isFemale && !isCalf && (hasCalved || animal.is_currently_lactating)

        // Milking: only for females with calving evidence (parity > 0 or lactating)
        if (isEligibleForMilking) {
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

        // AI Records: for mature females without a recent AI record
        // Skip pregnant animals (confirmed or suspected) — can't schedule AI for them
        const isPregnant = ((animal as any).fertility_status === 'confirmed_pregnant' ||
                            (animal as any).fertility_status === 'suspected_pregnant')
        if (isMatureFemale && !animalsWithAI.has(animal.id) && !isPregnant) {
          const daysAgo = Math.floor(seededRandom(`${animal.id}_ai_day`) * 7) + 1
          const scheduledDate = new Date(now)
          scheduledDate.setDate(scheduledDate.getDate() - daysAgo)
          const scheduledStr = scheduledDate.toISOString().split('T')[0]

          const performedOffset = Math.floor(seededRandom(`${animal.id}_ai_perf`) * 3)
          const performedDate = new Date(scheduledDate)
          performedDate.setDate(performedDate.getDate() + performedOffset)
          const performedStr = performedDate.toISOString().split('T')[0]

          const gestationDays = GESTATION_DAYS[animalSpecies] || GESTATION_DAYS.cattle
          const codes = SEMEN_CODES[animalSpecies] || SEMEN_CODES.cattle
          const semenCode = codes[Math.floor(seededRandom(`${animal.id}_semen`) * codes.length)]

          const isConfirmed = seededRandom(`${animal.id}_preg`) < 0.4
          let confirmedAt: string | null = null
          let expectedDelivery: string | null = null

          if (isConfirmed) {
            const confirmDate = new Date(performedDate)
            confirmDate.setDate(confirmDate.getDate() + 60)
            confirmedAt = confirmDate.toISOString()

            const deliveryDate = new Date(performedDate)
            deliveryDate.setDate(deliveryDate.getDate() + gestationDays)
            expectedDelivery = deliveryDate.toISOString().split('T')[0]
          }

          aiInserts.push({
            animal_id: animal.id,
            scheduled_date: scheduledStr,
            performed_date: performedStr,
            semen_code: semenCode,
            technician: 'Demo AI Tech',
            pregnancy_confirmed: isConfirmed,
            confirmed_at: confirmedAt,
            expected_delivery_date: expectedDelivery,
            notes: 'Auto-seeded demo data',
          })

          // Create corresponding breeding_events so the
          // update_animal_fertility_status trigger fires and keeps
          // fertility_status / parity / last_calving_date in sync.
          const heatDate = new Date(scheduledDate)
          heatDate.setDate(heatDate.getDate() - 1)
          breedingEventInserts.push({
            animal_id: animal.id,
            farm_id: farm.id,
            event_type: 'heat_detected',
            event_date: heatDate.toISOString(),
            notes: 'Auto-seeded demo data',
          })
          breedingEventInserts.push({
            animal_id: animal.id,
            farm_id: farm.id,
            event_type: 'ai_performed',
            event_date: `${performedStr}T08:00:00+08:00`,
            notes: 'Auto-seeded demo data',
          })

          if (isConfirmed) {
            // Non-return at ~21 days after AI
            const nonReturnDate = new Date(performedDate)
            nonReturnDate.setDate(nonReturnDate.getDate() + 21)
            breedingEventInserts.push({
              animal_id: animal.id,
              farm_id: farm.id,
              event_type: 'non_return',
              event_date: nonReturnDate.toISOString(),
              notes: 'Auto-seeded demo data',
            })
            // Pregnancy confirmed at ~60 days after AI
            breedingEventInserts.push({
              animal_id: animal.id,
              farm_id: farm.id,
              event_type: 'pregnancy_confirmed',
              event_date: confirmedAt!,
              notes: 'Auto-seeded demo data',
            })
          }
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
      let milkCount = 0, weightCount = 0, healthCount = 0, bcsCount = 0, feedCount = 0, aiCount = 0

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
      for (let i = 0; i < aiInserts.length; i += batchSize) {
        const { error } = await supabase.from('ai_records').insert(aiInserts.slice(i, i + batchSize))
        if (!error) aiCount += Math.min(batchSize, aiInserts.length - i)
      }
      // Insert breeding_events AFTER ai_records so the
      // update_animal_fertility_status trigger cascades properly
      for (let i = 0; i < breedingEventInserts.length; i += batchSize) {
        const { error } = await supabase.from('breeding_events').insert(breedingEventInserts.slice(i, i + batchSize))
        if (error) console.error('breeding_events insert error:', error.message)
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

      // ── Seed Farmer Feedback (farm-level, not per-animal) ──────────────
      let feedbackCount = 0
      const ninetyDaysAgo = new Date(now)
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const ninetyDaysAgoStr = ninetyDaysAgo.toISOString()

      const { count: existingFeedbackCount } = await supabase
        .from('farmer_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('farm_id', farm.id)
        .gte('created_at', ninetyDaysAgoStr)

      if ((existingFeedbackCount ?? 0) < 5) {
        // Get farm owner user_id
        const { data: membership } = await supabase
          .from('farm_memberships')
          .select('user_id')
          .eq('farm_id', farm.id)
          .eq('role_in_farm', 'farmer_owner')
          .not('user_id', 'is', null)
          .limit(1)
          .single()

        const ownerUserId = membership?.user_id
        if (ownerUserId) {
          const feedbackInserts: any[] = []
          const numFeedback = 5 + Math.floor(seededRandom(`${farm.id}_fbcount`) * 11) // 5-15
          // Determine species from the farm's animals (farm.livestock_type is now a
          // category like 'ruminant', not a species). Use most common animal species.
          const animalSpeciesList = (animals || []).map((a: any) => a.livestock_type).filter(Boolean)
          const species = (animalSpeciesList[0] || 'cattle').toLowerCase()

          for (let i = 0; i < numFeedback; i++) {
            const seed = `${farm.id}_fb_${i}`
            const templateIdx = Math.floor(seededRandom(`${seed}_cat`) * FEEDBACK_TEMPLATES.length)
            const template = FEEDBACK_TEMPLATES[templateIdx]

            const daysAgo = Math.floor(seededRandom(`${seed}_day`) * 90) + 1
            const feedbackDate = new Date(now)
            feedbackDate.setDate(feedbackDate.getDate() - daysAgo)

            const priorityInfo = pickPriority(`${seed}_pri`)
            const priorityScore = Math.floor(randBetween(priorityInfo.scoreMin, priorityInfo.scoreMax, `${seed}_score`))
            const sentiment = priorityInfo.sentiments[Math.floor(seededRandom(`${seed}_sent`) * priorityInfo.sentiments.length)]
            const status = pickFeedbackStatus(daysAgo, `${seed}_status`)

            const speciesTranscriptions = template.transcriptions[species] || template.transcriptions.cattle
            const transcription = speciesTranscriptions[Math.floor(seededRandom(`${seed}_txt`) * speciesTranscriptions.length)]

            // Set timestamps based on status
            let acknowledged_at: string | null = null
            let reviewed_at: string | null = null
            let resolution_date: string | null = null

            const statusIdx = FEEDBACK_STATUSES.indexOf(status)
            if (statusIdx >= 1) { // acknowledged or later
              const ackDate = new Date(feedbackDate)
              ackDate.setDate(ackDate.getDate() + Math.floor(seededRandom(`${seed}_ack`) * 3) + 1)
              acknowledged_at = ackDate.toISOString()
            }
            if (statusIdx >= 2) { // under_review or later
              const revDate = new Date(feedbackDate)
              revDate.setDate(revDate.getDate() + Math.floor(seededRandom(`${seed}_rev`) * 5) + 3)
              reviewed_at = revDate.toISOString()
            }
            if (statusIdx >= 4) { // resolved or closed
              const resDate = new Date(feedbackDate)
              resDate.setDate(resDate.getDate() + Math.floor(seededRandom(`${seed}_res`) * 14) + 7)
              resolution_date = resDate.toISOString().split('T')[0]
            }

            feedbackInserts.push({
              farm_id: farm.id,
              user_id: ownerUserId,
              transcription,
              ai_summary: template.ai_summary,
              primary_category: template.category,
              tags: template.tags,
              sentiment,
              priority_score: priorityScore,
              auto_priority: priorityInfo.priority,
              detected_entities: template.detected_entities,
              assigned_department: template.department,
              status,
              is_anonymous: seededRandom(`${seed}_anon`) < 0.15,
              acknowledged_at,
              reviewed_at,
              resolution_date,
              created_at: feedbackDate.toISOString(),
            })
          }

          for (let i = 0; i < feedbackInserts.length; i += batchSize) {
            const { error } = await supabase.from('farmer_feedback').insert(feedbackInserts.slice(i, i + batchSize))
            if (!error) feedbackCount += Math.min(batchSize, feedbackInserts.length - i)
          }
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
        ai_inserted: aiCount,
        feedback_inserted: feedbackCount,
        inventory_linked: inventoryLinked,
        zero_cost_fallback: zeroCostFallback,
      })
    }

    const totalRecords = summary.reduce((sum, s) =>
      sum + s.milking_inserted + s.weight_inserted + s.health_inserted + s.bcs_inserted + s.feeding_inserted + (s.ai_inserted || 0) + (s.feedback_inserted || 0), 0)

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
