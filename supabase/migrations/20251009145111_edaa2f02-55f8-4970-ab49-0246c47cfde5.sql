-- Fix pat.ebuna@gmail.com role data
-- Add the correct role to user_roles table (using 'farmhand' not 'farmer_staff')
INSERT INTO user_roles (user_id, role) 
VALUES ('9297ba26-7a0b-4109-b087-c655d19b44e3', 'farmhand')
ON CONFLICT (user_id, role) DO NOTHING;

-- Update the profile to reflect farmhand status
UPDATE profiles 
SET role = 'farmhand'
WHERE id = '9297ba26-7a0b-4109-b087-c655d19b44e3';