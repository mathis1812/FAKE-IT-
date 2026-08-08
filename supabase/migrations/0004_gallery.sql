create table public.gallery_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('image', 'video')),
  result_url text not null,
  label text not null,
  created_at timestamptz not null default now()
);

alter table public.gallery_entries enable row level security;

create policy "Users can read own gallery entries"
  on public.gallery_entries for select
  using (auth.uid() = user_id);

-- Pas de policy insert/update/delete pour authenticated : les écritures se
-- font uniquement via la clé service_role (routes de génération), même
-- principe que les crédits (0003_credit_functions.sql).

create index gallery_entries_user_id_created_at_idx
  on public.gallery_entries (user_id, created_at desc);

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy "Public read access to gallery bucket"
  on storage.objects for select
  using (bucket_id = 'gallery');

-- Écritures dans le bucket réservées à service_role (upload fait uniquement
-- depuis les routes serveur, jamais depuis le client).
