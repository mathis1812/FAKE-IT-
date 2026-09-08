-- Aligne la contrainte de `profiles.plan` sur les paliers que le code écrit.
--
-- `0002_add_stripe_fields.sql` a créé la colonne avec
-- `check (plan in ('decouverte', 'essentiel', 'ultimate'))` — les anciens
-- noms français. Le code utilise depuis `('lite', 'pro', 'max')`
-- (`PLAN_ORDER` dans `lib/stripe.ts`), et aucune migration n'a suivi.
--
-- Conséquence, si la contrainte est bien restée telle quelle en production :
-- le webhook Stripe ne peut PAS enregistrer un abonnement. Son `update` sur
-- `plan` est rejeté par la contrainte, donc un client qui paie n'obtient
-- jamais son palier. C'est une panne silencieuse côté base — le webhook
-- répond, Stripe est content, et seul le client constate qu'il n'a rien.
--
-- Les trois valeurs héritées restent acceptées. Deux raisons : sans elles,
-- l'`alter table` échouerait si une seule ligne les porte encore, et
-- `asPlanId()` traite déjà toute valeur inconnue comme « sans abonnement »,
-- donc leur présence n'accorde aucun droit.
--
-- Ce fichier ne CONVERTIT volontairement aucune ligne. Réécrire
-- 'essentiel' → 'pro' accorderait des droits à des comptes qui n'en ont
-- aucun aujourd'hui : c'est une décision commerciale, pas un correctif de
-- schéma. À faire séparément, en connaissance de cause.
--
-- Ré-exécutable : les contraintes existantes sont retirées avant l'ajout.

do $$
declare
  existing_constraint text;
begin
  -- Le nom exact n'est pas garanti : `0002` déclarait la contrainte en
  -- ligne, PostgreSQL l'a donc nommée lui-même (`profiles_plan_check` selon
  -- la convention), mais elle a pu être recréée à la main sous un autre nom.
  -- On retire toute contrainte CHECK de `profiles` qui porte sur `plan`.
  for existing_constraint in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%plan%'
  loop
    execute format(
      'alter table public.profiles drop constraint %I',
      existing_constraint
    );
  end loop;
end
$$;

alter table public.profiles
  add constraint profiles_plan_check
  check (
    plan is null
    or plan in (
      -- Paliers actuels, ceux que le webhook Stripe écrit.
      'lite', 'pro', 'max',
      -- Paliers hérités, tolérés pour que la migration passe sur une base
      -- qui en contient encore. Aucun droit ne leur est associé.
      'decouverte', 'essentiel', 'ultimate'
    )
  );
