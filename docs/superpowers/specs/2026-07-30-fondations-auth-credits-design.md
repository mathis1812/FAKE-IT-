# Fondations Supabase — Auth + Table de crédits — Design

Date : 2026-07-30
Statut : Approuvé

## Contexte

Bluminoo Studio n'a aujourd'hui aucun compte utilisateur, aucune base de
données, aucun paiement. La page `/tarifs` (voir
`docs/superpowers/specs/2026-07-29-pages-tarifs-a-propos-design.md`) est
un simple encart informatif "Gratuit / Pro (bientôt disponible)".

L'objectif final (sur plusieurs chantiers séparés) est de reprendre la
structure de pricing d'un concurrent : 3 paliers payants (mensuel/annuel)
avec un système de crédits consommés à chaque génération. Ce chantier est
le **premier** des 4 :

1. **Fondations Supabase** (ce document) — comptes utilisateurs, table de
   crédits, pages de connexion/inscription/compte.
2. Stripe — checkout, 3 plans, webhooks qui créditent le compte.
3. Décompte des crédits — brancher la génération existante sur le solde.
4. Page Tarifs vitrine — grille à 3 paliers branchée sur les vrais plans.

**Décision explicite de l'utilisateur** : une branche distante existante
(`origin/cursor/auth-connexion-2e61`, faite depuis Cursor, contenant une
auth Clerk + skills Clerk Billing) est traitée comme un essai abandonné
et **ignorée** — on reconstruit l'auth à neuf sur `main` avec Supabase.

## Objectifs

- Un utilisateur peut créer un compte (email + mot de passe) sur
  `/inscription`, se connecter sur `/connexion`, se déconnecter, et
  consulter son solde de crédits sur `/compte`.
- Chaque compte a une ligne dans une table `profiles` (`id`, `credits`,
  `created_at`) créée automatiquement à l'inscription, avec `credits = 0`
  par défaut (pas d'essai gratuit — il faudra un abonnement Stripe au
  chantier 2 pour obtenir des crédits).
- Le solde de crédits n'est lisible que par son propriétaire (RLS) et
  n'est modifiable par personne côté client — seule une clé de service
  côté serveur (chantiers 2 et 3) pourra l'incrémenter/décrémenter.
- Le header (`SiteHeader`) reflète l'état de connexion : lien
  "Connexion" si déconnecté, lien "Mon compte" si connecté.

## Non-objectifs

- Pas de paiement, pas de crédits obtenus autrement qu'à 0 (chantier 2).
- Pas de blocage de la génération photo/vidéo existante sur le solde de
  crédits (chantier 3) — la page d'accueil et les routes
  `app/api/generate*` restent inchangées et continuent de fonctionner
  sans compte.
- Pas de connexion sociale (Google, etc.) ni de magic link — email +
  mot de passe uniquement.
- Pas de confirmation d'email obligatoire au départ (compte activé
  immédiatement après inscription) — évite un blocage si l'envoi
  d'email par défaut de Supabase est lent/limité. Réversible plus tard
  dans le dashboard Supabase sans changement de code.
- Pas de migration de la Galerie locale (IndexedDB) vers un stockage
  serveur lié au compte — reste local pour l'instant.
- Aucun nouveau design system : réutilisation de `Panel` et des classes
  utilitaires existantes (`font-display`, `text-primary`, etc.).

## Architecture

**Projet Supabase** : nouveau projet créé, connecté au projet Vercel via
l'intégration marketplace Supabase (synchronise automatiquement
`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les
env vars Vercel). `SUPABASE_SERVICE_ROLE_KEY` ajoutée manuellement
(nécessaire aux chantiers 2/3, pas utilisée dans ce chantier mais
provisionnée maintenant). Ajout des 3 clés à `.env.example`.

**Client Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) :
- `lib/supabase/client.ts` — client navigateur (composants "use client").
- `lib/supabase/server.ts` — client serveur (Server Components/Route
  Handlers), lit les cookies de session via `next/headers`.
- `middleware.ts` (nouveau fichier, n'existe pas encore) — rafraîchit le
  cookie de session Supabase à chaque requête (pattern standard
  `@supabase/ssr` pour Next.js App Router). Ne protège aucune route pour
  l'instant au-delà de `/compte` (voir plus bas) ; ne touche pas aux
  routes `app/api/generate*`.

**Base de données** (migration SQL versionnée dans
`supabase/migrations/`) :
```sql
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
-- (chantiers 2/3), jamais depuis le client.

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, credits) values (new.id, 0);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Pages** (App Router, composants client pour les formulaires) :
- `app/inscription/page.tsx` — formulaire email/mot de passe, appelle
  `supabase.auth.signUp`. Redirige vers `/compte` en cas de succès.
- `app/connexion/page.tsx` — formulaire email/mot de passe, appelle
  `supabase.auth.signInWithPassword`. Redirige vers `/compte` en cas de
  succès. Lien vers `/inscription`.
- `app/compte/page.tsx` — Server Component : lit la session côté
  serveur, redirige vers `/connexion` si absente (`redirect()` de
  `next/navigation`), sinon affiche l'email et `credits` du profil
  (0 partout tant que le chantier 2 n'est pas livré) + bouton de
  déconnexion (petit composant client qui appelle
  `supabase.auth.signOut()` puis `router.refresh()`).

Style : réutilisation de `Panel` pour les formulaires/cartes, mêmes
classes que le reste de l'app (`font-display`, `text-primary`,
`bg-primary/15`, etc.) — pas de widget Supabase Auth UI générique, pour
rester cohérent avec la DA violette existante.

**`SiteHeader`** : `NAV_ITEMS` reste pour la nav principale ; ajout d'un
élément séparé à droite de la nav desktop et dans le panneau mobile,
piloté par l'état de session (lu côté client via
`supabase.auth.onAuthStateChange` ou passé en prop depuis un Server
Component parent — détail tranché au moment du plan) :
- Déconnecté → lien "Connexion" vers `/connexion`.
- Connecté → lien "Mon compte" vers `/compte`.

## Gestion des erreurs

- **Inscription** : email déjà utilisé → message "Cette adresse est déjà
  associée à un compte." ; mot de passe < 6 caractères → "Le mot de passe
  doit contenir au moins 6 caractères." (règle par défaut Supabase).
- **Connexion** : identifiants invalides → message générique "Email ou
  mot de passe incorrect." (pas de distinction email inexistant/mot de
  passe faux, pour ne pas révéler quels emails sont enregistrés).
- **Erreurs réseau/Supabase indisponible** : message générique "Une
  erreur est survenue, réessaie dans quelques instants." sur les deux
  formulaires.
- **`/compte` sans session** : redirection serveur vers `/connexion`,
  aucun flash de contenu protégé.

## Vérification

Pas de suite de tests dans ce projet (`npx tsc --noEmit` + vérification
manuelle en navigateur, cohérent avec le reste du projet). Comme il n'y a
pas de `.env.local` avec les clés Supabase en local, la vérification
end-to-end (créer un compte, se connecter, voir `/compte`) se fera soit
avec les clés du projet Supabase une fois créé, soit via un déploiement
preview Vercel après configuration de l'intégration.

- Inscription avec un nouvel email → ligne créée dans `profiles` avec
  `credits = 0`, redirection vers `/compte`.
- Réinscription avec le même email → message d'erreur clair, pas de
  doublon en base.
- Connexion avec les bons identifiants → redirection `/compte`, email et
  solde (0) affichés.
- Connexion avec de mauvais identifiants → message d'erreur, pas de
  redirection.
- Accès direct à `/compte` sans session → redirection vers `/connexion`.
- Déconnexion depuis `/compte` → retour à l'état déconnecté, header
  affiche "Connexion".
- La page d'accueil et les routes `app/api/generate*` fonctionnent à
  l'identique, avec ou sans session — aucune régression.
- Requête SQL directe (ou tentative via le client anon) confirmant qu'un
  utilisateur ne peut ni lire le profil d'un autre, ni modifier son
  propre `credits` depuis le client.
