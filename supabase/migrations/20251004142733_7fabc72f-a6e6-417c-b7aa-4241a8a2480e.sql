-- Drop everything and start fresh
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP FUNCTION IF EXISTS public.is_merchant CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Add merchant & distributor to user_role enum  
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'merchant' AND enumtypid = 'user_role'::regtype) THEN ALTER TYPE public.user_role ADD VALUE 'merchant'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'distributor' AND enumtypid = 'user_role'::regtype) THEN ALTER TYPE public.user_role ADD VALUE 'distributor'; END IF; END $$;

-- Create enums
DO $$ BEGIN CREATE TYPE public.order_status AS ENUM ('received', 'in_process', 'in_transit', 'delivered', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.message_party AS ENUM ('farmer', 'merchant'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create user_roles table fresh
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE OR REPLACE FUNCTION public.is_merchant(_user_id UUID) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT has_role(_user_id, 'merchant'::user_role) $$;

-- Create tables
CREATE TABLE IF NOT EXISTS public.merchants (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE, business_name TEXT NOT NULL, business_description TEXT, business_logo_url TEXT, contact_email TEXT NOT NULL, contact_phone TEXT, business_address TEXT, gps_lat NUMERIC, gps_lng NUMERIC, is_verified BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.product_categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE NOT NULL, icon TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL, category_id UUID REFERENCES public.product_categories(id), name TEXT NOT NULL, description TEXT, price NUMERIC NOT NULL CHECK (price > 0), unit TEXT NOT NULL, image_url TEXT, stock_quantity NUMERIC NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ad_campaigns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL, product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT, image_url TEXT, target_region TEXT, target_farm_size_min INTEGER, target_farm_size_max INTEGER, budget NUMERIC NOT NULL CHECK (budget > 0), spent NUMERIC NOT NULL DEFAULT 0, cost_per_click NUMERIC NOT NULL DEFAULT 0.5, impressions INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, start_date DATE NOT NULL, end_date DATE NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK (end_date >= start_date));
CREATE TABLE IF NOT EXISTS public.ad_impressions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID REFERENCES public.ad_campaigns(id) ON DELETE CASCADE NOT NULL, farmer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, clicked BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number TEXT UNIQUE NOT NULL, farmer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL, status order_status NOT NULL DEFAULT 'received', total_amount NUMERIC NOT NULL CHECK (total_amount >= 0), notes TEXT, delivery_address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL, product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL, quantity NUMERIC NOT NULL CHECK (quantity > 0), unit_price NUMERIC NOT NULL CHECK (unit_price > 0), subtotal NUMERIC NOT NULL CHECK (subtotal >= 0));
CREATE TABLE IF NOT EXISTS public.invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number TEXT UNIQUE NOT NULL, order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE, issued_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE, amount NUMERIC NOT NULL CHECK (amount >= 0), tax_amount NUMERIC NOT NULL DEFAULT 0, is_paid BOOLEAN NOT NULL DEFAULT false, paid_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.distributors (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL, name TEXT NOT NULL, contact_person TEXT, phone TEXT NOT NULL, email TEXT, address TEXT NOT NULL, gps_lat NUMERIC NOT NULL, gps_lng NUMERIC NOT NULL, region TEXT, is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID NOT NULL, sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, sender_type message_party NOT NULL, recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, recipient_type message_party NOT NULL, order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, message TEXT NOT NULL, is_read BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Enable RLS
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants can view own data" ON public.merchants FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::user_role)); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Verified merchants visible" ON public.merchants FOR SELECT USING (is_verified = true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users can create merchant profile" ON public.merchants FOR INSERT WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants can update own data" ON public.merchants FOR UPDATE USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Categories visible to authenticated" ON public.product_categories FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage categories" ON public.product_categories FOR ALL USING (has_role(auth.uid(), 'admin'::user_role)); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Active products visible" ON public.products FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants can insert products" ON public.products FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants can update products" ON public.products FOR UPDATE USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants can delete products" ON public.products FOR DELETE USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = products.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants view own campaigns" ON public.ad_campaigns FOR SELECT USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = ad_campaigns.merchant_id AND merchants.user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::user_role)); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants create campaigns" ON public.ad_campaigns FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = ad_campaigns.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants update campaigns" ON public.ad_campaigns FOR UPDATE USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = ad_campaigns.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "System insert impressions" ON public.ad_impressions FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants view impressions" ON public.ad_impressions FOR SELECT USING (EXISTS (SELECT 1 FROM public.ad_campaigns ac JOIN public.merchants m ON m.id = ac.merchant_id WHERE ac.id = ad_impressions.campaign_id AND m.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Farmers view own orders" ON public.orders FOR SELECT USING (farmer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants view their orders" ON public.orders FOR SELECT USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Farmers create orders" ON public.orders FOR INSERT WITH CHECK (farmer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants update order status" ON public.orders FOR UPDATE USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Order items visible to parties" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.farmer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid())))); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Farmers insert order items" ON public.order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.farmer_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Invoices visible to parties" ON public.invoices FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = invoices.order_id AND (orders.farmer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = orders.merchant_id AND merchants.user_id = auth.uid())))); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants create invoices" ON public.invoices FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.orders o JOIN public.merchants m ON m.id = o.merchant_id WHERE o.id = invoices.order_id AND m.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Active distributors visible" ON public.distributors FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::user_role)); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants view own distributors" ON public.distributors FOR SELECT USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = distributors.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants insert distributors" ON public.distributors FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = distributors.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants update distributors" ON public.distributors FOR UPDATE USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = distributors.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants delete distributors" ON public.distributors FOR DELETE USING (EXISTS (SELECT 1 FROM public.merchants WHERE merchants.id = distributors.merchant_id AND merchants.user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users view own messages" ON public.messages FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users send messages" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Users mark messages read" ON public.messages FOR UPDATE USING (recipient_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Functions
CREATE OR REPLACE FUNCTION public.generate_order_number() RETURNS TEXT LANGUAGE plpgsql AS $$ DECLARE new_number TEXT; BEGIN new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'); RETURN new_number; END; $$;

-- Triggers
DO $$ BEGIN CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp(); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp(); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TRIGGER update_ad_campaigns_updated_at BEFORE UPDATE ON public.ad_campaigns FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp(); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp(); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TRIGGER update_distributors_updated_at BEFORE UPDATE ON public.distributors FOR EACH ROW EXECUTE FUNCTION public.handle_timestamp(); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Insert data
INSERT INTO public.product_categories (name, icon) SELECT 'Animal Feed', 'wheat' WHERE NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Animal Feed');
INSERT INTO public.product_categories (name, icon) SELECT 'Veterinary Supplies', 'syringe' WHERE NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Veterinary Supplies');
INSERT INTO public.product_categories (name, icon) SELECT 'Farm Equipment', 'wrench' WHERE NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Farm Equipment');
INSERT INTO public.product_categories (name, icon) SELECT 'Dairy Products', 'milk' WHERE NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Dairy Products');
INSERT INTO public.product_categories (name, icon) SELECT 'Seeds & Plants', 'sprout' WHERE NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Seeds & Plants');
INSERT INTO public.product_categories (name, icon) SELECT 'Other', 'package' WHERE NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Other');

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) SELECT 'merchant-logos', 'merchant-logos', true WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'merchant-logos');
INSERT INTO storage.buckets (id, name, public) SELECT 'product-images', 'product-images', true WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images');
INSERT INTO storage.buckets (id, name, public) SELECT 'ad-campaign-images', 'ad-campaign-images', true WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ad-campaign-images');

-- Storage policies
DO $$ BEGIN CREATE POLICY "Merchant logos readable" ON storage.objects FOR SELECT USING (bucket_id = 'merchant-logos'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'merchant-logos' AND auth.uid()::text = (storage.foldername(name))[1]); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'merchant-logos' AND auth.uid()::text = (storage.foldername(name))[1]); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Product images readable" ON storage.objects FOR SELECT USING (bucket_id = 'product-images'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants upload products" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants update products" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Ad images readable" ON storage.objects FOR SELECT USING (bucket_id = 'ad-campaign-images'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants upload ads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ad-campaign-images' AND auth.uid()::text = (storage.foldername(name))[1]); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "Merchants update ads" ON storage.objects FOR UPDATE USING (bucket_id = 'ad-campaign-images' AND auth.uid()::text = (storage.foldername(name))[1]); EXCEPTION WHEN duplicate_object THEN null; END $$;