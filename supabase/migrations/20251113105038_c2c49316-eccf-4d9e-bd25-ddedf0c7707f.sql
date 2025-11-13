-- Just create the farm structure
DO $$
DECLARE v_farm_id uuid; v_user_id uuid := 'c8514ae7-f603-415e-8603-039515f7189e';
BEGIN
  SELECT id INTO v_farm_id FROM public.farms WHERE name = 'Laguna Multi-Species Dairy Cooperative [TEST]' AND owner_id = v_user_id LIMIT 1;
  IF v_farm_id IS NULL THEN
    INSERT INTO public.farms (name, owner_id, region, province, municipality, livestock_type, gps_lat, gps_lng, is_deleted)
    VALUES ('Laguna Multi-Species Dairy Cooperative [TEST]', v_user_id, 'Region IV-A (CALABARZON)', 'Laguna', 'Bay', 'cattle', 14.1800, 121.2863, false)
    RETURNING id INTO v_farm_id;
  END IF;
  INSERT INTO public.farm_memberships (farm_id, user_id, role_in_farm, invitation_status)
  VALUES (v_farm_id, v_user_id, 'farmer_owner', 'accepted')
  ON CONFLICT DO NOTHING;
END $$;