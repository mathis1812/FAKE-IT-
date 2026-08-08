create or replace function public.spend_credits(p_user_id uuid, p_amount integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_rows integer;
begin
  update public.profiles
  set credits = credits - p_amount
  where id = p_user_id and credits >= p_amount;

  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

create or replace function public.refund_credits(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id;
end;
$$;

-- Ces fonctions débitent/créditent un solde sans vérifier auth.uid() : elles
-- ne doivent être appelables QUE par le serveur (client service_role), jamais
-- par un client authentifié ou anonyme via supabase.rpc(...).
revoke execute on function public.spend_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, integer) to service_role;
grant execute on function public.refund_credits(uuid, integer) to service_role;
