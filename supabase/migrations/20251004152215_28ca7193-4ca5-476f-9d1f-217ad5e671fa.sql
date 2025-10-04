-- Storage policies for merchant-logos and product-images buckets
-- Enable authenticated users (merchants) to upload into their own folder, keep reads public

-- Drop existing policies if they exist
drop policy if exists "Public read merchant-logos" on storage.objects;
drop policy if exists "Users can upload merchant logos to own folder" on storage.objects;
drop policy if exists "Users can update own merchant logos" on storage.objects;
drop policy if exists "Users can delete own merchant logos" on storage.objects;
drop policy if exists "Public read product-images" on storage.objects;
drop policy if exists "Merchants can upload product images to own folder" on storage.objects;
drop policy if exists "Merchants can update own product images" on storage.objects;
drop policy if exists "Merchants can delete own product images" on storage.objects;

-- Merchant logos: public read
create policy "Public read merchant-logos"
  on storage.objects for select
  using (bucket_id = 'merchant-logos');

-- Merchant logos: insert/update/delete only within own folder (user-id prefix)
create policy "Users can upload merchant logos to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'merchant-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update own merchant logos"
  on storage.objects for update
  using (
    bucket_id = 'merchant-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own merchant logos"
  on storage.objects for delete
  using (
    bucket_id = 'merchant-logos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Product images: public read
create policy "Public read product-images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Product images: merchants can write within their own folder
create policy "Merchants can upload product images to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.is_merchant(auth.uid())
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Merchants can update own product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and public.is_merchant(auth.uid())
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Merchants can delete own product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.is_merchant(auth.uid())
    and auth.uid()::text = (storage.foldername(name))[1]
  );