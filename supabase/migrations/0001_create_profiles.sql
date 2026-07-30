create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Pas de policy insert/update pour le rôle authenticated :
-- les écritures se font uniquement via la clé service_role
-- (chantiers Stripe / débit de crédits à venir).

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, credits) values (new.id, 0);
  return new;
end;
$$ language plpgsql security definer
set search_path = public, pg_temp;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
