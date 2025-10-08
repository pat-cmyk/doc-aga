-- Delete user pat.ebuna@gmail.com and all associated data
-- Step 1: Delete farms owned by the user (this cascades to animals, records, etc.)
DELETE FROM public.farms 
WHERE owner_id = '9647920d-8e3c-49ab-a65d-495e320369d8';

-- Step 2: Delete farm memberships
DELETE FROM public.farm_memberships 
WHERE user_id = '9647920d-8e3c-49ab-a65d-495e320369d8';

-- Step 3: Delete user roles
DELETE FROM public.user_roles 
WHERE user_id = '9647920d-8e3c-49ab-a65d-495e320369d8';

-- Step 4: Delete profile
DELETE FROM public.profiles 
WHERE id = '9647920d-8e3c-49ab-a65d-495e320369d8';

-- Step 5: Delete from auth.users
DELETE FROM auth.users 
WHERE id = '9647920d-8e3c-49ab-a65d-495e320369d8';