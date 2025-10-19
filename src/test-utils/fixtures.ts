export const mockAnimal = {
  id: 'animal-123',
  farm_id: 'farm-123',
  ear_tag: 'COW001',
  name: 'Bessie',
  breed: 'Holstein',
  gender: 'female',
  birth_date: '2022-01-15',
  life_stage: 'cow',
  milking_stage: 'lactating',
  current_weight_kg: 550,
  created_at: '2022-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  is_deleted: false,
  mother_id: null,
  father_id: null,
  milking_start_date: '2023-05-01',
  client_generated_id: null,
  avatar_url: null,
};

export const mockFeedInventory = [
  {
    id: 'inv-1',
    farm_id: 'farm-123',
    feed_type: 'corn silage',
    quantity_kg: 1000,
    unit: 'bales',
    weight_per_unit: 25,
    cost_per_unit: 150,
    supplier: 'Local Farm',
    reorder_threshold: 200,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    last_updated: '2024-01-01T00:00:00Z',
    created_by: 'user-123',
  },
  {
    id: 'inv-2',
    farm_id: 'farm-123',
    feed_type: 'concentrates',
    quantity_kg: 500,
    unit: 'bags',
    weight_per_unit: 50,
    cost_per_unit: 800,
    supplier: 'Feed Store',
    reorder_threshold: 100,
    notes: null,
    created_at: '2024-01-01T00:00:00Z',
    last_updated: '2024-01-01T00:00:00Z',
    created_by: 'user-123',
  },
];

export const mockUser = {
  id: 'user-123',
  email: 'farmer@example.com',
  full_name: 'Test Farmer',
  role: 'farmer_owner' as const,
};

export const mockFarm = {
  id: 'farm-123',
  name: 'Test Farm',
  owner_id: 'user-123',
  region: 'Central Luzon',
  gps_lat: 15.4817,
  gps_lng: 120.7121,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  is_deleted: false,
  client_generated_id: null,
};

export const mockActivityData = {
  activity_type: 'feeding',
  animal_id: 'animal-123',
  quantity: 10,
  unit: 'bales',
  feed_type: 'corn silage',
  notes: 'Regular feeding',
  timestamp: new Date().toISOString(),
};

export const mockMultiFeedActivityData = {
  activity_type: 'feeding',
  distribution: 'bulk',
  total_animals: 15,
  multiple_feeds: true,
  feeds: [
    {
      feed_type: 'hay',
      quantity: 10,
      unit: 'bales',
      weight_per_unit: 25,
      total_kg: 250,
      distribution_amount: 16.67,
      distributions: [
        {
          animal_id: 'animal-123',
          animal_name: 'Bessie',
          ear_tag: 'COW001',
          weight_kg: 550,
          proportion: 0.067,
          feed_amount: 16.67,
        },
      ],
    },
    {
      feed_type: 'concentrates',
      quantity: 5,
      unit: 'bags',
      weight_per_unit: 50,
      total_kg: 250,
      distribution_amount: 16.67,
      distributions: [
        {
          animal_id: 'animal-123',
          animal_name: 'Bessie',
          ear_tag: 'COW001',
          weight_kg: 550,
          proportion: 0.067,
          feed_amount: 16.67,
        },
      ],
    },
  ],
  timestamp: new Date().toISOString(),
};

export const mockMilkingActivity = {
  activity_type: 'milking',
  animal_id: 'animal-123',
  animal_identifier: 'COW001 (Bessie)',
  quantity: 12,
  notes: 'Morning milking session',
  timestamp: new Date().toISOString(),
};

export const mockWeightActivity = {
  activity_type: 'weight_measurement',
  animal_id: 'animal-123',
  animal_identifier: 'COW001 (Bessie)',
  quantity: 580,
  notes: 'Monthly weight check',
  timestamp: new Date().toISOString(),
};

export const mockHealthActivity = {
  activity_type: 'health_observation',
  animal_id: 'animal-123',
  animal_identifier: 'COW001 (Bessie)',
  notes: 'Animal appears to be limping on left front leg',
  timestamp: new Date().toISOString(),
};

export const mockInjectionActivity = {
  activity_type: 'injection',
  animal_id: 'animal-123',
  animal_identifier: 'COW001 (Bessie)',
  medicine_name: 'Ivermectin',
  dosage: '10ml',
  notes: 'Deworming treatment',
  timestamp: new Date().toISOString(),
};

export const mockInventoryBatches = [
  {
    id: 'batch-1',
    farm_id: 'farm-123',
    feed_type: 'corn silage',
    quantity_kg: 500,
    unit: 'bales',
    weight_per_unit: 25,
    cost_per_unit: 150,
    supplier: 'Local Farm',
    created_at: '2024-01-01T00:00:00Z',
    last_updated: '2024-01-01T00:00:00Z',
  },
  {
    id: 'batch-2',
    farm_id: 'farm-123',
    feed_type: 'corn silage',
    quantity_kg: 300,
    unit: 'bales',
    weight_per_unit: 25,
    cost_per_unit: 150,
    supplier: 'Local Farm',
    created_at: '2024-01-15T00:00:00Z',
    last_updated: '2024-01-15T00:00:00Z',
  },
];
