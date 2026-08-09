-- Local development seed (Cursor Cloud / `supabase start`).
--
-- On hosted Supabase, the `anon` and `authenticated` roles receive table-level
-- privileges on `public` tables by default, and the RLS policies defined in the
-- migrations do the actual per-row gating. Some local Postgres images ship
-- default privileges that grant only TRUNCATE/REFERENCES/TRIGGER (not SELECT) to
-- these roles, which makes the RLS-protected reads in this app fail with
-- "permission denied for table ..." even though a matching RLS SELECT policy
-- exists (e.g. the /compte page reading public.profiles).
--
-- This seed restores the base grants so local behaviour matches hosted Supabase.
-- Seed files run automatically after migrations on `supabase start` / `db reset`
-- and are never applied to a deployed project, so this stays local-only.

grant select on public.profiles to anon, authenticated;
grant select on public.gallery_entries to anon, authenticated;
