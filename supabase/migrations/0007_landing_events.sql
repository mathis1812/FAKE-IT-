-- Suivi des visites et clics CTA sur /landing, pour comparer les
-- conversions (visite -> inscription) dans le temps sans introduire de
-- service d'analytics tiers.
--
-- Même principe que gallery_entries (0004) et les crédits (0003) : toutes
-- les écritures passent par une route serveur (clé service_role), aucune
-- lecture ni écriture directe depuis le client.
create table public.landing_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('page_view', 'cta_click')),
  cta_id text,
  path text not null default '/landing',
  referrer text,
  session_id text,
  created_at timestamptz not null default now()
);

alter table public.landing_events enable row level security;

-- Pas de policy select/insert pour authenticated/anon : écritures uniquement
-- via /api/track (service_role), lecture réservée au dashboard Supabase /
-- requêtes admin (service_role également).

create index landing_events_type_created_at_idx
  on public.landing_events (event_type, created_at desc);
