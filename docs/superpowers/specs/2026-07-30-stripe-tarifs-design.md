# Stripe + Page Tarifs — Design

Date : 2026-07-30
Statut : Approuvé

## Contexte

Chantier 1 (fondations Supabase — auth + table `profiles.credits`) est
mergé. La page `/tarifs` est toujours l'ancien encart statique
"Gratuit / Pro (bientôt disponible)" (voir
`docs/superpowers/specs/2026-07-29-pages-tarifs-a-propos-design.md`).

Un calculateur de rentabilité construit dans cette session a arrêté les
chiffres des 3 paliers (marge nette garantie même dans le pire cas
d'usage) :

| Palier | Prix | Crédits/mois | Note |
|---|---|---|---|
| Découverte | 9,90 €/mois | 2 000 | |
| Essentiel | 19,90 €/mois | 5 000 | |
| Ultimate | 39,90 €/mois | 12 000 | plafonné, pas d'illimité |

Barème sous-jacent (issu de la migration Gemini 3 Pro Image / Kling 3.0
Pro déjà mergée) : 120 crédits/photo, 650 crédits/vidéo.

Ce chantier couvre les chantiers 2 et 4 du plan pricing original :
l'intégration Stripe et la page Tarifs elle-même, branchée dessus. Le
chantier 3 (débit des crédits à la génération) reste séparé et non
commencé.

**Compte Stripe** : l'utilisateur a déjà un compte Stripe configuré et
prêt (paiements activés) — pas d'étape de création de compte nécessaire
pour ce chantier, contrairement au chantier Supabase.

## Objectifs

### Produits et prix Stripe (setup manuel/assisté, hors code)

3 produits Stripe, 1 prix mensuel récurrent chacun (9,90 €, 19,90 €,
39,90 €) — pas de prix annuel dans ce chantier. Les 3 `price_id` sont
fournis via variables d'environnement (`STRIPE_PRICE_DECOUVERTE`,
`STRIPE_PRICE_ESSENTIEL`, `STRIPE_PRICE_ULTIMATE`), pas codés en dur —
soit l'utilisateur les crée et les fournit, soit ils sont créés via le
dashboard Stripe assisté (navigateur connecté), au moment du plan
d'implémentation.

### Schéma de données

Extension de la table `public.profiles` (migration SQL versionnée,
`supabase/migrations/0002_add_stripe_fields.sql`) :

```sql
alter table public.profiles
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column plan text check (plan in ('decouverte', 'essentiel', 'ultimate')),
  add column current_period_end timestamptz;
```

Pas de nouvelle policy RLS nécessaire : la policy `select` existante sur
`profiles` couvre déjà la lecture de ces nouvelles colonnes par leur
propriétaire. Aucune policy d'écriture n'existe pour `authenticated` (déjà
le cas depuis le chantier 1) — les écritures sur ces champs se font
exclusivement via le webhook, avec la clé `service_role`.

### Flux d'abonnement

- Nouvelle route `app/api/stripe/checkout/route.ts` (POST) : reçoit
  `{ plan: "decouverte" | "essentiel" | "ultimate" }`, vérifie la session
  Supabase côté serveur (401 si absente), crée ou réutilise un
  `stripe_customer_id` pour cet utilisateur, crée une
  `stripe.checkout.sessions.create` en mode `subscription` avec le
  `price_id` correspondant, `success_url` vers `/compte?checkout=success`
  et `cancel_url` vers `/tarifs`, renvoie `{ url }` (l'URL de la session
  Checkout hébergée par Stripe).
- Le bouton "S'abonner" de la page Tarifs appelle cette route puis
  redirige le navigateur vers `url`. Si l'utilisateur n'est pas connecté,
  redirection immédiate vers `/connexion` sans appeler la route (pas
  d'attente d'une 401).
- Nouvelle route `app/api/stripe/portal/route.ts` (POST) : vérifie la
  session, crée une `stripe.billingPortal.sessions.create` pour le
  `stripe_customer_id` du profil, renvoie `{ url }`. Utilisée par le lien
  "Gérer mon abonnement" sur `/compte` et `/tarifs` quand un abonnement
  est déjà actif.

### Webhook Stripe

Nouvelle route `app/api/stripe/webhook/route.ts` (POST), vérifie la
signature via `STRIPE_WEBHOOK_SECRET` et `stripe.webhooks.constructEvent`
(rejette avec 400 si signature invalide — endpoint public, doit être
protégé uniquement par la vérification de signature, pas d'auth Supabase
ici puisque c'est Stripe qui appelle).

- `checkout.session.completed` : récupère l'`id` client Supabase depuis
  les metadata de la session (attachées à la création dans
  `checkout/route.ts`), met à jour `profiles` : `stripe_customer_id`,
  `stripe_subscription_id`, `plan`, `current_period_end`, et **crédite le
  solde initial** du palier (`credits = <valeur du palier>`, pas un ajout
  — un nouvel abonné part du solde plein du palier).
- `invoice.paid` (renouvellement, `billing_reason: subscription_cycle`) :
  **reset** `credits` à la valeur du palier associé au
  `stripe_subscription_id` (pas de cumul, confirmé) et met à jour
  `current_period_end`.
- `customer.subscription.deleted` (annulation) : met `plan = null`,
  `stripe_subscription_id = null`. Ne touche pas au solde `credits`
  existant — les crédits déjà là restent utilisables (le blocage réel de
  génération selon le solde est le chantier 3, hors périmètre ici).
- Toutes les écritures utilisent le client Supabase `service_role`
  (`lib/supabase/server.ts` ne convient pas ici car il utilise la clé
  anonyme liée aux cookies de session ; nouveau helper
  `lib/supabase/service.ts` avec `SUPABASE_SERVICE_ROLE_KEY`).

### Page Tarifs (`app/tarifs/page.tsx`, remplace le contenu actuel)

- Grille à 3 cartes (Découverte, Essentiel, Ultimate) avec prix, nombre de
  crédits/mois, une liste de fonctionnalités simple (génération image/
  vidéo, historique, support — pas de liste aussi étoffée que le
  concurrent, contenu honnête sur ce que l'app fait réellement
  aujourd'hui).
- Toggle mensuel/annuel visuel en haut (cohérence avec l'esthétique
  attendue) mais l'option annuel est désactivée avec un badge "Bientôt
  disponible" — un seul prix (mensuel) est réellement sélectionnable dans
  ce chantier.
- Pour un visiteur non connecté ou connecté sans abonnement actif :
  bouton "S'abonner" par carte, appelle `checkout/route.ts`.
- Pour un utilisateur avec un abonnement actif : la carte de son palier
  affiche un badge "Plan actuel" à la place du bouton, et un lien "Gérer
  mon abonnement" (vers `portal/route.ts`) apparaît sous la grille.
- Composant serveur pour la lecture de l'état d'abonnement (session +
  `profiles.plan` via `lib/supabase/server.ts`), les boutons "S'abonner"/
  "Gérer mon abonnement" sont de petits composants client isolés (appel
  fetch + redirection), pattern similaire à `SignOutButton.tsx`.

### Variables d'environnement ajoutées

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_DECOUVERTE`,
`STRIPE_PRICE_ESSENTIEL`, `STRIPE_PRICE_ULTIMATE` — ajoutées à
`.env.example`, `.env.local` et Vercel au moment du plan d'implémentation
(même méthode que pour Supabase : navigateur connecté, jamais tapées en
clair dans la conversation).

## Non-objectifs

- Pas de débit de crédits à la génération (chantier 3, séparé, non
  commencé) — les routes `app/api/generate*` restent inchangées.
- Pas de prix annuel fonctionnel — toggle visuel seulement, option
  désactivée.
- Pas de gestion de rétrogradation/upgrade en cours de cycle (proration)
  — un changement de palier se fait via le Customer Portal de Stripe
  lui-même (comportement par défaut de Stripe), pas de logique custom.
- Pas de facture/reçu custom — gérés nativement par Stripe (Customer
  Portal + emails Stripe).
- Pas de nouvelle policy RLS d'écriture sur `profiles` pour le rôle
  `authenticated` — reste interdit, cohérent avec le chantier 1.
- Pas de webhook géré pour les échecs de paiement (`invoice.payment_
  failed`) dans ce chantier — Stripe gère nativement les relances selon
  la configuration du compte ; à traiter dans un chantier ultérieur si
  besoin d'une UX spécifique (ex. bannière d'alerte dans l'app).

## Architecture

3 nouvelles routes API (`checkout`, `portal`, `webhook`), 1 nouveau
helper Supabase service-role, 1 migration SQL, remplacement du contenu de
`app/tarifs/page.tsx`, 2 petits composants client pour les boutons
d'action. Aucun changement aux routes de génération existantes ni aux
chantiers auth déjà mergés (`/inscription`, `/connexion`, `/compte`,
`middleware.ts` restent intacts).

## Gestion des erreurs

- `checkout/route.ts` et `portal/route.ts` : 401 si pas de session ;
  message clair si le profil n'a pas encore de `stripe_customer_id` au
  moment d'ouvrir le portail (redirection vers `/tarifs` plutôt qu'une
  erreur brute, puisque le portail n'a de sens qu'avec un abonnement
  existant).
- `webhook/route.ts` : 400 sur signature invalide (ne jamais traiter un
  événement non vérifié) ; 200 renvoyé même si l'événement reçu n'est pas
  un des trois gérés (comportement Stripe standard — un webhook doit
  accuser réception de tous les événements qu'il reçoit, même ignorés,
  sinon Stripe re-tente indéfiniment).
- Page Tarifs : si l'appel à `checkout`/`portal` échoue côté client,
  message d'erreur affiché sous le bouton concerné plutôt qu'une
  redirection silencieuse cassée.

## Vérification

Pas de framework de tests. Vérification manuelle, en mode test Stripe
(clés `sk_test_...`, webhook via `stripe listen --forward-to` ou un
endpoint de test Vercel preview) :

- Un visiteur non connecté cliquant "S'abonner" est redirigé vers
  `/connexion`, pas vers Stripe.
- Un utilisateur connecté cliquant "S'abonner" arrive sur une vraie page
  Stripe Checkout avec le bon prix et le bon montant.
- Après paiement test réussi : redirection vers `/compte`, le profil a le
  bon `plan`, `stripe_customer_id`, `stripe_subscription_id`, et
  `credits` égal à la valeur du palier.
- Un événement `invoice.paid` de test réinitialise `credits` à la valeur
  du palier (pas d'addition à un solde déjà entamé).
- Le lien "Gérer mon abonnement" ouvre le vrai Customer Portal Stripe
  pour ce client.
- Une annulation via le Customer Portal déclenche
  `customer.subscription.deleted` et remet `plan = null` sans toucher au
  solde de crédits existant.
- La page `/tarifs` affiche "Plan actuel" sur la bonne carte pour un
  abonné, et les boutons "S'abonner" ailleurs restent actifs.
