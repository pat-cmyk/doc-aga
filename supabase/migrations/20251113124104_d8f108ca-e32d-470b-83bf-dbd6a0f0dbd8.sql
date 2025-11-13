-- Drop the existing constraint
ALTER TABLE animals DROP CONSTRAINT IF EXISTS valid_life_stage;

-- Create updated constraint with all detailed stage names for each species
ALTER TABLE animals ADD CONSTRAINT valid_life_stage CHECK (
  life_stage IS NULL OR life_stage IN (
    -- Cattle stages (female)
    'Calf', 'Heifer Calf', 'Yearling Heifer', 'Breeding Heifer', 
    'Pregnant Heifer', 'First-Calf Heifer', 'Mature Cow',
    
    -- Cattle stages (male)
    'Bull Calf', 'Young Bull', 'Mature Bull', 'Bull',
    
    -- Carabao stages (female) - DETAILED
    'Carabao Calf', 'Young Carabao', 'Breeding Carabao', 
    'Pregnant Carabao', 'First-Time Mother', 'Mature Carabao',
    
    -- Carabao stages (male)
    'Young Bull Carabao', 'Mature Bull Carabao',
    
    -- Goat stages (female) - DETAILED
    'Kid', 'Doeling', 'Breeding Doe', 'Pregnant Doe', 
    'First Freshener', 'Mature Doe',
    
    -- Goat stages (male)
    'Young Buck', 'Buck',
    
    -- Sheep stages (female) - DETAILED
    'Lamb', 'Ewe Lamb', 'Breeding Ewe', 'Pregnant Ewe', 
    'First-Time Mother Ewe', 'Mature Ewe',
    
    -- Sheep stages (male)
    'Young Ram', 'Ram'
  )
);