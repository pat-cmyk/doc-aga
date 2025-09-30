-- ===============================
-- ENUMS
-- ===============================
create type user_role as enum ('farmer_owner','farmhand','merchant','vet','admin');
create type order_status as enum ('received','in_process','in_transit','delivered','cancelled');
create type animal_event_type as enum ('birth','pregnancy_confirmed','ai_scheduled','ai_performed','milking_started','health_diagnosis','treatment','note');
create type notification_type as enum ('order_update','vet_update','message','system');
create type message_party as enum ('farmer','merchant','vet','admin');

-- ===============================
-- CORE IDENTITIES
-- ===============================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.profiles(role);

-- ===============================
-- FARMS & MEMBERSHIPS
-- ===============================
create table public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  gps_lat numeric(9,6) not null,
  gps_lng numeric(9,6) not null,
  region text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  client_generated_id text
);

create index on public.farms(owner_id);

create table public.farm_memberships (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_in_farm user_role not null check (role_in_farm in ('farmer_owner','farmhand','vet')),
  created_at timestamptz not null default now(),
  unique(farm_id, user_id)
);

-- ===============================
-- ANIMALS & RECORDS
-- ===============================
create table public.animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  ear_tag text unique,
  name text,
  breed text,
  birth_date date,
  milking_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  client_generated_id text
);
create index on public.animals(farm_id);

create table public.animal_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  event_type animal_event_type not null,
  event_date date not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index on public.animal_events(animal_id, event_date);

create table public.milking_records (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  record_date date not null,
  liters numeric(10,2) not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(animal_id, record_date)
);

create table public.feeding_records (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  record_datetime timestamptz not null,
  feed_type text,
  kilograms numeric(10,2),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.injection_records (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  record_datetime timestamptz not null,
  medicine_name text,
  dosage text,
  instructions text,
  photo_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.ai_records (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  scheduled_date date,
  performed_date date,
  technician text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.health_records (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  visit_date date not null,
  diagnosis text,
  treatment text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.animal_photos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  taken_at timestamptz,
  photo_path text not null,
  label text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ===============================
-- DOC AGA
-- ===============================
create table public.doc_aga_faqs (
  id uuid primary key default gen_random_uuid(),
  category text,
  question text not null,
  answer text not null,
  tags text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.doc_aga_queries (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references public.farms(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  question text not null,
  answer text,
  matched_faq_id uuid references public.doc_aga_faqs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.doc_aga_queries(created_at);

-- ===============================
-- NOTIFICATIONS
-- ===============================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type notification_type not null,
  title text,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, read);

-- ===============================
-- RLS POLICIES
-- ===============================
alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_memberships enable row level security;
alter table public.animals enable row level security;
alter table public.animal_events enable row level security;
alter table public.milking_records enable row level security;
alter table public.feeding_records enable row level security;
alter table public.injection_records enable row level security;
alter table public.ai_records enable row level security;
alter table public.health_records enable row level security;
alter table public.animal_photos enable row level security;
alter table public.doc_aga_faqs enable row level security;
alter table public.doc_aga_queries enable row level security;
alter table public.notifications enable row level security;

-- Helper function
create or replace function public.can_access_farm(fid uuid)
returns boolean language sql stable security definer as $$
  select exists(
    select 1
    from public.farms f
    left join public.farm_memberships fm on fm.farm_id = f.id and fm.user_id = auth.uid()
    where f.id = fid and (f.owner_id = auth.uid() or fm.user_id = auth.uid())
  );
$$;

-- Profiles
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);

-- Farms
create policy "farms_select" on public.farms for select using (owner_id = auth.uid() or exists (select 1 from public.farm_memberships where farm_id = id and user_id = auth.uid()));
create policy "farms_insert" on public.farms for insert with check (owner_id = auth.uid());
create policy "farms_update" on public.farms for update using (owner_id = auth.uid());
create policy "farms_delete" on public.farms for delete using (owner_id = auth.uid());

-- Farm memberships
create policy "fm_select" on public.farm_memberships for select using (user_id = auth.uid() or exists (select 1 from public.farms f where f.id = farm_id and f.owner_id = auth.uid()));
create policy "fm_insert" on public.farm_memberships for insert with check (exists (select 1 from public.farms f where f.id = farm_id and f.owner_id = auth.uid()));
create policy "fm_delete" on public.farm_memberships for delete using (exists (select 1 from public.farms f where f.id = farm_id and f.owner_id = auth.uid()));

-- Animals
create policy "animals_select" on public.animals for select using (public.can_access_farm(farm_id));
create policy "animals_insert" on public.animals for insert with check (public.can_access_farm(farm_id));
create policy "animals_update" on public.animals for update using (public.can_access_farm(farm_id));
create policy "animals_delete" on public.animals for delete using (public.can_access_farm(farm_id));

-- Animal events
create policy "events_select" on public.animal_events for select using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "events_insert" on public.animal_events for insert with check (public.can_access_farm((select farm_id from public.animals where id = animal_id)));

-- Milking records
create policy "milking_select" on public.milking_records for select using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "milking_insert" on public.milking_records for insert with check (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "milking_update" on public.milking_records for update using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));

-- Feeding records
create policy "feeding_select" on public.feeding_records for select using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "feeding_insert" on public.feeding_records for insert with check (public.can_access_farm((select farm_id from public.animals where id = animal_id)));

-- Injection records
create policy "injection_select" on public.injection_records for select using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "injection_insert" on public.injection_records for insert with check (public.can_access_farm((select farm_id from public.animals where id = animal_id)));

-- AI records
create policy "ai_select" on public.ai_records for select using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "ai_insert" on public.ai_records for insert with check (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "ai_update" on public.ai_records for update using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));

-- Health records
create policy "health_select" on public.health_records for select using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "health_insert" on public.health_records for insert with check (public.can_access_farm((select farm_id from public.animals where id = animal_id)));

-- Animal photos
create policy "photos_select" on public.animal_photos for select using (public.can_access_farm((select farm_id from public.animals where id = animal_id)));
create policy "photos_insert" on public.animal_photos for insert with check (public.can_access_farm((select farm_id from public.animals where id = animal_id)));

-- Doc Aga
create policy "faq_select" on public.doc_aga_faqs for select using (is_active = true);
create policy "queries_select" on public.doc_aga_queries for select using (user_id = auth.uid());
create policy "queries_insert" on public.doc_aga_queries for insert with check (user_id = auth.uid());

-- Notifications
create policy "notif_select" on public.notifications for select using (user_id = auth.uid());
create policy "notif_update" on public.notifications for update using (user_id = auth.uid());

-- ===============================
-- TRIGGERS
-- ===============================
create or replace function public.handle_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger t_profiles_ts before update on public.profiles for each row execute function public.handle_timestamp();
create trigger t_farms_ts before update on public.farms for each row execute function public.handle_timestamp();
create trigger t_animals_ts before update on public.animals for each row execute function public.handle_timestamp();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'farmer_owner', coalesce(new.raw_user_meta_data->>'full_name', 'New User'));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed sample FAQs
insert into public.doc_aga_faqs (category, question, answer, tags) values
('Health', 'What are signs of mastitis in dairy cows?', 'Common signs include swollen udder, hot or painful teats, abnormal milk (clumpy, watery, or bloody), fever, and reduced appetite. Immediate veterinary attention is recommended.', array['health','dairy','mastitis']),
('Nutrition', 'How much feed should a lactating cow receive daily?', 'A lactating dairy cow typically needs 3-4% of her body weight in dry matter daily, split between forage and concentrates. Exact amounts depend on milk production level and body condition.', array['nutrition','feeding','dairy']),
('Breeding', 'When is the best time to breed after calving?', 'Cows should typically be bred 60-90 days after calving, once they have returned to normal cycling. Monitor heat detection and consult your vet for optimal timing.', array['breeding','reproduction','ai']),
('Management', 'How often should I check my cows for heat?', 'Check for heat signs at least twice daily, preferably morning and evening. Heat periods last 12-18 hours, so frequent observation increases breeding success.', array['management','breeding','heat detection']);