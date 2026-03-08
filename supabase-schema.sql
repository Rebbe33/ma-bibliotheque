-- ============================================================
-- SCHÉMA SUPABASE — Ma Bibliothèque
-- Copiez-collez ce SQL dans l'éditeur SQL de Supabase
-- ============================================================

-- Extension pour générer des UUIDs
create extension if not exists "uuid-ossp";

-- ── TABLE : profils utilisateurs ──
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  avatar_url text,
  created_at timestamptz default now()
);

-- ── TABLE : livres ──
create table public.books (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  -- Infos de base
  title text not null,
  author text not null,
  genre text,
  year integer,
  pages integer,
  publisher text,
  isbn text,
  series_name text,
  series_number numeric,
  cover_url text,
  -- Lecture
  status text check (status in ('À lire','En cours','Lu','Abandonné')) default 'À lire',
  rating integer check (rating >= 0 and rating <= 5) default 0,
  notes text,
  -- Google Books
  google_books_id text,
  -- Dates
  date_added timestamptz default now(),
  date_updated timestamptz default now()
);

-- ── TABLE : liste de souhaits ──
create table public.wishlist (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  author text,
  genre text,
  priority text check (priority in ('Haute','Moyenne','Basse')) default 'Moyenne',
  where_to_find text,
  notes text,
  cover_url text,
  google_books_id text,
  publisher text,
  year integer,
  date_added timestamptz default now()
);

-- ── ROW LEVEL SECURITY ──
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.wishlist enable row level security;

-- Profiles : chacun voit/modifie uniquement son profil
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Books : chacun accède uniquement à ses livres
create policy "books_select" on public.books for select using (auth.uid() = user_id);
create policy "books_insert" on public.books for insert with check (auth.uid() = user_id);
create policy "books_update" on public.books for update using (auth.uid() = user_id);
create policy "books_delete" on public.books for delete using (auth.uid() = user_id);

-- Wishlist : idem
create policy "wishlist_select" on public.wishlist for select using (auth.uid() = user_id);
create policy "wishlist_insert" on public.wishlist for insert with check (auth.uid() = user_id);
create policy "wishlist_update" on public.wishlist for update using (auth.uid() = user_id);
create policy "wishlist_delete" on public.wishlist for delete using (auth.uid() = user_id);

-- ── TRIGGER : mise à jour automatique de date_updated ──
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.date_updated = now();
  return new;
end;
$$ language plpgsql;

create trigger books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- ── TRIGGER : créer un profil automatiquement à l'inscription ──
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── INDEX pour les performances ──
create index books_user_id_idx on public.books(user_id);
create index books_status_idx on public.books(user_id, status);
create index wishlist_user_id_idx on public.wishlist(user_id);
