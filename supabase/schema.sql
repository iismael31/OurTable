-- =====================================================================
--  Nuestros Restaurantes — Esquema de base de datos para Supabase
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run
--  Es idempotente: se puede volver a ejecutar sin romper nada.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Perfiles: un perfil por usuario autorizado. Ser "miembro" = tener
--    perfil. Para revocar el acceso a alguien basta con borrar su perfil.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  color        text not null default '#e11d48' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at   timestamptz not null default now()
);

-- Crea el perfil automáticamente al dar de alta un usuario desde el panel.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios ya existentes antes de ejecutar este script.
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ¿El usuario actual es miembro?
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Restaurantes (compartidos por los dos)
-- ---------------------------------------------------------------------
create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  cuisine     text check (cuisine is null or char_length(cuisine) <= 60),
  address     text check (address is null or char_length(address) <= 240),
  lat         double precision check (lat is null or lat between -90 and 90),
  lng         double precision check (lng is null or lng between -180 and 180),
  want_to_go  boolean not null default false,
  notes       text check (notes is null or char_length(notes) <= 1000),
  links       jsonb not null default '[]'::jsonb
              check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10),
  created_by  uuid not null default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint restaurants_coords_both_or_none check ((lat is null) = (lng is null))
);

-- Instalaciones anteriores a la lista de pendientes y los enlaces:
alter table public.restaurants add column if not exists want_to_go boolean not null default false;
alter table public.restaurants add column if not exists notes text;
alter table public.restaurants add column if not exists links jsonb not null default '[]'::jsonb;

create index if not exists restaurants_name_idx on public.restaurants (lower(name));
create index if not exists restaurants_want_idx on public.restaurants (want_to_go) where want_to_go;

-- ---------------------------------------------------------------------
-- 3. Valoraciones (una por visita y persona)
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id               uuid primary key default gen_random_uuid(),
  restaurant_id    uuid not null references public.restaurants (id) on delete cascade,
  author_id        uuid not null default auth.uid() references public.profiles (id),
  visit_date       date not null default current_date,
  rating           smallint not null check (rating between 1 and 5),
  rating_food      smallint check (rating_food between 1 and 5),
  rating_service   smallint check (rating_service between 1 and 5),
  rating_ambience  smallint check (rating_ambience between 1 and 5),
  rating_value     smallint check (rating_value between 1 and 5),
  price_per_person numeric(7, 2) check (price_per_person is null or price_per_person between 0 and 10000),
  dishes           jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(dishes) = 'array' and jsonb_array_length(dishes) <= 30),
  drinks           text check (drinks is null or char_length(drinks) <= 500),
  comment          text check (comment is null or char_length(comment) <= 4000),
  would_return     boolean,
  photos           jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 12),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists reviews_restaurant_idx on public.reviews (restaurant_id);
create index if not exists reviews_visit_date_idx on public.reviews (visit_date desc, created_at desc);
create index if not exists reviews_author_idx on public.reviews (author_id);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

-- Al guardar la primera valoración de un sitio "pendiente", pasa a visitado.
create or replace function public.mark_restaurant_visited()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.restaurants set want_to_go = false
  where id = new.restaurant_id and want_to_go;
  return new;
end;
$$;

drop trigger if exists reviews_mark_visited on public.reviews;
create trigger reviews_mark_visited
  after insert on public.reviews
  for each row execute function public.mark_restaurant_visited();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Seguridad: Row Level Security. Denegar por defecto.
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.restaurants enable row level security;
alter table public.reviews     enable row level security;

-- Perfiles
drop policy if exists "profiles: members read"      on public.profiles;
drop policy if exists "profiles: own update"        on public.profiles;
create policy "profiles: members read" on public.profiles
  for select to authenticated using (public.is_member());
create policy "profiles: own update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Restaurantes: los dos miembros pueden leer, crear, editar y borrar
drop policy if exists "restaurants: members read"   on public.restaurants;
drop policy if exists "restaurants: members insert" on public.restaurants;
drop policy if exists "restaurants: members update" on public.restaurants;
drop policy if exists "restaurants: members delete" on public.restaurants;
create policy "restaurants: members read" on public.restaurants
  for select to authenticated using (public.is_member());
create policy "restaurants: members insert" on public.restaurants
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy "restaurants: members update" on public.restaurants
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "restaurants: members delete" on public.restaurants
  for delete to authenticated using (public.is_member());

-- Valoraciones: ambos leen; solo el autor crea, edita y borra las suyas
drop policy if exists "reviews: members read"  on public.reviews;
drop policy if exists "reviews: author insert" on public.reviews;
drop policy if exists "reviews: author update" on public.reviews;
drop policy if exists "reviews: author delete" on public.reviews;
create policy "reviews: members read" on public.reviews
  for select to authenticated using (public.is_member());
create policy "reviews: author insert" on public.reviews
  for insert to authenticated with check (public.is_member() and author_id = auth.uid());
create policy "reviews: author update" on public.reviews
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "reviews: author delete" on public.reviews
  for delete to authenticated using (author_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5. Tiempo real: cuando uno guarda, al otro le aparece al instante
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'restaurants'
  ) then
    alter publication supabase_realtime add table public.restaurants;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Fotos: bucket privado (se sirven con URLs firmadas temporales)
--    Máximo 3 MB por archivo; la app comprime antes de subir.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos: members read"   on storage.objects;
drop policy if exists "photos: members upload" on storage.objects;
drop policy if exists "photos: owner delete"   on storage.objects;
create policy "photos: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and public.is_member());
create policy "photos: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member());
create policy "photos: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and owner_id = (select auth.uid())::text);

-- Fin. Recuerda además, en el panel:
--   · Authentication → Providers → Email → desactivar "Allow new users to sign up"
--   · Authentication → Users → crear las dos cuentas con "Auto Confirm User"
--   · Authentication → URL Configuration → Site URL = dirección de GitHub Pages
