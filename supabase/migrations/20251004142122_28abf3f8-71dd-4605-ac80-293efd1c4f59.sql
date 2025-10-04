-- Create app_role enum type (only if not exists)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'farmer_owner', 'farmer_staff', 'merchant', 'distributor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table (replacing role column in profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is a merchant
CREATE OR REPLACE FUNCTION public.is_merchant(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(_user_id, 'merchant')
$$;

-- Merchants table
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  business_description TEXT,
  business_logo_url TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  business_address TEXT,
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

-- Product categories table
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.product_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL CHECK (price > 0),
  unit TEXT NOT NULL,
  image_url TEXT,
  stock_quantity NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Ad campaigns table
CREATE TABLE public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  target_region TEXT,
  target_farm_size_min INTEGER,
  target_farm_size_max INTEGER,
  budget NUMERIC NOT NULL CHECK (budget > 0),
  spent NUMERIC NOT NULL DEFAULT 0,
  cost_per_click NUMERIC NOT NULL DEFAULT 0.5,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

-- Ad impressions table
CREATE TABLE public.ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.ad_campaigns(id) ON DELETE CASCADE NOT NULL,
  farmer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  clicked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  farmer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  status order_status NOT NULL DEFAULT 'received',
  total_amount NUMERIC NOT NULL CHECK (total_amount >= 0),
  notes TEXT,
  delivery_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price > 0),
  subtotal NUMERIC NOT NULL CHECK (subtotal >= 0)
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Distributors table
CREATE TABLE public.distributors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  gps_lat NUMERIC NOT NULL,
  gps_lng NUMERIC NOT NULL,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_type message_party NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_type message_party NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- RLS Policies for merchants
CREATE POLICY "Merchants can view own data" ON public.merchants
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Verified merchants visible to authenticated users" ON public.merchants
  FOR SELECT USING (is_verified = true);

CREATE POLICY "Users can create merchant profile" ON public.merchants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Merchants can update own data" ON public.merchants
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for product_categories
CREATE POLICY "Categories visible to all authenticated users" ON public.product_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage categories" ON public.product_categories
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for products
CREATE POLICY "Active products visible to authenticated users" ON public.products
  FOR SELECT USING (
    is_active = true OR 
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())
  );

CREATE POLICY "Merchants can insert own products" ON public.products
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())
  );

CREATE POLICY "Merchants can update own products" ON public.products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())
  );

CREATE POLICY "Merchants can delete own products" ON public.products
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())
  );

-- RLS Policies for ad_campaigns
CREATE POLICY "Merchants can view own campaigns" ON public.ad_campaigns
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = ad_campaigns.merchant_id AND merchants.user_id = auth.uid()) OR
    has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Merchants can create campaigns" ON public.ad_campaigns
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = ad_campaigns.merchant_id AND merchants.user_id = auth.uid())
  );

CREATE POLICY "Merchants can update own campaigns" ON public.ad_campaigns
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = ad_campaigns.merchant_id AND merchants.user_id = auth.uid())
  );

-- RLS Policies for ad_impressions
CREATE POLICY "System can insert impressions" ON public.ad_impressions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Merchants can view campaign impressions" ON public.ad_impressions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ad_campaigns ac
      JOIN public.merchants m ON m.id = ac.merchant_id
      WHERE ac.id = ad_impressions.campaign_id AND m.user_id = auth.uid()
    )
  );

-- RLS Policies for orders
CREATE POLICY "Farmers can view own orders" ON public.orders
  FOR SELECT USING (farmer_id = auth.uid());

CREATE POLICY "Merchants can view their orders" ON public.orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid())
  );

CREATE POLICY "Farmers can create orders" ON public.orders
  FOR INSERT WITH CHECK (farmer_id = auth.uid());

CREATE POLICY "Merchants can update order status" ON public.orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid())
  );

-- RLS Policies for order_items
CREATE POLICY "Order items visible to order parties" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND (orders.farmer_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid()))
    )
  );

CREATE POLICY "Farmers can insert order items" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.farmer_id = auth.uid())
  );

-- RLS Policies for invoices
CREATE POLICY "Invoices visible to order parties" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = invoices.order_id 
      AND (orders.farmer_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid()))
    )
  );

CREATE POLICY "Merchants can create invoices" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.merchants m ON m.id = o.merchant_id
      WHERE o.id = invoices.order_id AND m.user_id = auth.uid()
    )
  );

-- RLS Policies for distributors
CREATE POLICY "Active distributors visible to authenticated users" ON public.distributors
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can view own distributors" ON public.distributors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = distributors.merchant_id AND merchants.user_id = auth.uid())
  );

CREATE POLICY "Merchants can insert distributors" ON public.distributors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = distributors.merchant_id AND merchants.user_id = auth.uid())
  );

CREATE POLICY "Merchants can update own distributors" ON public.distributors
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = distributors.merchant_id AND merchants.user_id = auth.uid())
  );

CREATE POLICY "Merchants can delete own distributors" ON public.distributors
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = distributors.merchant_id AND merchants.user_id = auth.uid())
  );

-- RLS Policies for messages
CREATE POLICY "Users can view own messages" ON public.messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can mark messages as read" ON public.messages
  FOR UPDATE USING (recipient_id = auth.uid());

-- Database functions
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp();

CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp();

CREATE TRIGGER update_distributors_updated_at
  BEFORE UPDATE ON public.distributors
  FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp();

-- Insert default product categories
INSERT INTO public.product_categories (name, icon) VALUES
  ('Animal Feed', 'wheat'),
  ('Veterinary Supplies', 'syringe'),
  ('Farm Equipment', 'wrench'),
  ('Dairy Products', 'milk'),
  ('Seeds & Plants', 'sprout'),
  ('Other', 'package');

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('merchant-logos', 'merchant-logos', true),
  ('product-images', 'product-images', true),
  ('ad-campaign-images', 'ad-campaign-images', true);

-- Storage policies for merchant-logos
CREATE POLICY "Merchant logos publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'merchant-logos');

CREATE POLICY "Merchants can upload own logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'merchant-logos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Merchants can update own logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'merchant-logos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for product-images
CREATE POLICY "Product images publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Merchants can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Merchants can update product images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'product-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for ad-campaign-images
CREATE POLICY "Ad campaign images publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'ad-campaign-images');

CREATE POLICY "Merchants can upload ad images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'ad-campaign-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Merchants can update ad images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'ad-campaign-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );