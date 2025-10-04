-- Create a secure function to handle merchant signup
CREATE OR REPLACE FUNCTION public.handle_merchant_signup(
  _user_id uuid,
  _full_name text,
  _business_name text,
  _business_description text,
  _contact_phone text,
  _contact_email text,
  _business_address text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _merchant_id uuid;
  _result json;
BEGIN
  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'merchant'::user_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Update profile with full name
  UPDATE public.profiles
  SET full_name = _full_name
  WHERE id = _user_id;
  
  -- Insert into merchants table
  INSERT INTO public.merchants (
    user_id,
    business_name,
    business_description,
    contact_phone,
    contact_email,
    business_address
  )
  VALUES (
    _user_id,
    _business_name,
    _business_description,
    _contact_phone,
    _contact_email,
    _business_address
  )
  RETURNING id INTO _merchant_id;
  
  -- Return success response
  _result := json_build_object(
    'success', true,
    'merchant_id', _merchant_id,
    'message', 'Merchant signup completed successfully'
  );
  
  RETURN _result;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error response
  _result := json_build_object(
    'success', false,
    'error', SQLERRM
  );
  RETURN _result;
END;
$$;