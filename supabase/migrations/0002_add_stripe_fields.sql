alter table public.profiles
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column plan text check (plan in ('decouverte', 'essentiel', 'ultimate')),
  add column current_period_end timestamptz;
