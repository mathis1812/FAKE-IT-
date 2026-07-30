# Fondations Supabase — Auth + Table de crédits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des comptes utilisateurs (email + mot de passe) via Supabase, avec une table `profiles` (`credits`, défaut 0) prête à être créditée par Stripe (chantier suivant), et des pages `/inscription`, `/connexion`, `/compte`.

**Architecture:** Deux clients Supabase (`lib/supabase/client.ts` pour le navigateur, `lib/supabase/server.ts` pour les Server Components) construits avec `@supabase/ssr`, un `middleware.ts` qui rafraîchit le cookie de session à chaque requête, et une table `profiles` (RLS : lecture seule par son propriétaire) créée automatiquement à l'inscription via un trigger Postgres. Les pages de formulaire sont des Client Components réutilisant `Panel` ; `/compte` est un Server Component qui redirige si pas de session.

**Tech Stack:** Next.js 14 App Router, TypeScript, React 18, Tailwind CSS, `@supabase/supabase-js` + `@supabase/ssr` (nouvelles dépendances), Supabase (Auth + Postgres, projet à créer).

## Global Constraints

- Auth **email + mot de passe uniquement** — pas de social login, pas de magic link.
- Table `profiles` : `id uuid` (référence `auth.users.id`), `credits integer not null default 0`, `created_at timestamptz not null default now()`. `credits = 0` par défaut — **pas d'essai gratuit**.
- RLS activé sur `profiles` : lecture seule par son propriétaire (`auth.uid() = id`) ; **aucune** policy d'écriture pour le rôle `authenticated` — le solde ne sera modifiable que côté serveur (chantiers suivants).
- **Pas de confirmation d'email obligatoire** — le compte est actif immédiatement après inscription (nécessite de désactiver "Confirm email" dans le dashboard Supabase, Authentication → Providers → Email).
- Ne touche **pas** à la page d'accueil ni aux routes `app/api/generate*` — la génération reste accessible sans compte.
- Pas de migration de la Galerie locale (IndexedDB) vers un stockage serveur.
- Réutilisation de `Panel`, `font-display`, `text-primary`/`text-primary-soft`, `bg-ink` — pas de nouveau design system, pas de widget Supabase Auth UI générique.
- Pas de framework de tests dans ce projet. Vérification via `npx tsc --noEmit -p tsconfig.json` + vérification manuelle au navigateur.
- Alias d'import `@/*` pointant sur la racine du repo (`tsconfig.json`).
- Identité git sur cette machine : `git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit ...` (pas de config globale).
- **Étapes manuelles non automatisables** : la création du projet Supabase et la configuration du dashboard (Task 1) nécessitent un compte sur supabase.com — un agent ne doit pas créer ce compte à la place de l'utilisateur ; ces sous-étapes sont à la charge de l'utilisateur lui-même. Les tasks 2 et suivantes peuvent être écrites et vérifiées par `tsc` sans ces clés, mais la vérification manuelle en navigateur nécessite que Task 1 soit terminée par l'utilisateur au préalable.

---

## Fichiers concernés

- Créer : `supabase/migrations/0001_create_profiles.sql`
- Créer : `lib/supabase/client.ts`
- Créer : `lib/supabase/server.ts`
- Créer : `middleware.ts`
- Créer : `app/inscription/page.tsx`
- Créer : `app/connexion/page.tsx`
- Créer : `app/compte/page.tsx`
- Créer : `components/SignOutButton.tsx`
- Modifier : `components/SiteHeader.tsx`
- Modifier : `.env.example`
- Modifier : `package.json` / `package-lock.json` (nouvelles dépendances)

---

### Task 1: Projet Supabase + schéma `profiles`

**Files:**
- Create: `supabase/migrations/0001_create_profiles.sql`

**Interfaces:**
- Produces: table Postgres `profiles(id uuid, credits integer, created_at timestamptz)` — consommée par Task 6 (`app/compte/page.tsx`) et par les chantiers Stripe/débit de crédits à venir.

- [ ] **Step 1: Créer le fichier de migration versionné**

```sql
-- supabase/migrations/0001_create_profiles.sql
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
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Commit du fichier de migration**

```bash
git add supabase/migrations/0001_create_profiles.sql
git commit -m "feat: ajouter la migration Supabase (table profiles + RLS + trigger)"
```

- [ ] **Step 3 (MANUEL — à faire par l'utilisateur, pas par un agent) : créer le projet Supabase**

1. Sur [supabase.com](https://supabase.com), créer un compte/projet (l'utilisateur doit le faire lui-même — création de compte tiers hors périmètre agent).
2. Dans le dashboard du projet → SQL Editor, coller et exécuter le contenu de `supabase/migrations/0001_create_profiles.sql`.
3. Dans Authentication → Providers → Email, désactiver "Confirm email".
4. Dans Project Settings → API, relever `Project URL` et `anon public key`, et dans Project Settings → API → `service_role key` (à garder secrète).
5. Sur le projet Vercel (`fakeit`), ajouter l'intégration Supabase depuis la marketplace Vercel **ou**, à défaut, ajouter manuellement les 3 variables d'environnement (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) dans Vercel → Settings → Environment Variables.
6. En local, créer `.env.local` (non commité, déjà couvert par `.gitignore`) avec ces 3 mêmes variables, pour pouvoir tester en `npm run dev`.

Cette étape n'a pas de "vérification automatisée" — c'est un prérequis externe. Les tasks suivantes peuvent être écrites sans elle, mais leur vérification manuelle en navigateur en dépend.

---

### Task 2: Dépendances + clients Supabase

**Files:**
- Modify: `package.json` (+ `package-lock.json`)
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `createClient()` (navigateur) exporté de `lib/supabase/client.ts`, `createClient()` (serveur) exporté de `lib/supabase/server.ts` — consommés par Tasks 4, 5, 6, 7.

- [ ] **Step 1: Installer les dépendances**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Créer le client navigateur**

```ts
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Créer le client serveur**

```ts
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : ignoré, le middleware
            // (Task 3) se charge du rafraîchissement de session.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Mettre à jour `.env.example`**

Remplacer :

```
GEMINI_API_KEY=
FAL_KEY=
```

par :

```
GEMINI_API_KEY=
FAL_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 5: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur mentionnant `lib/supabase/client.ts` ou `lib/supabase/server.ts`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/supabase/client.ts lib/supabase/server.ts .env.example
git commit -m "feat: ajouter les clients Supabase (navigateur + serveur)"
```

---

### Task 3: Middleware de rafraîchissement de session

**Files:**
- Create: `middleware.ts`

**Interfaces:** aucune — ne dépend que des variables d'environnement Supabase (pas des modules de Task 2, le middleware construit son propre client car il a besoin d'un accès aux cookies spécifique à `NextRequest`/`NextResponse`).

- [ ] **Step 1: Créer `middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Rafraîchit la session si besoin — requis pour que les Server
  // Components (ex. app/compte/page.tsx) voient une session à jour.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur mentionnant `middleware.ts`.

- [ ] **Step 3: Vérification manuelle**

(Nécessite `.env.local` configuré — Task 1, étape manuelle.) Lancer `npm run dev`, ouvrir n'importe quelle page du site : aucune erreur dans le terminal ni dans la console navigateur liée au middleware. Ouvrir les devtools → Application → Cookies : des cookies `sb-*` apparaissent après une connexion (vérifiable pleinement une fois Task 5 livrée).

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat: ajouter le middleware de rafraîchissement de session Supabase"
```

---

### Task 4: Page d'inscription

**Files:**
- Create: `app/inscription/page.tsx`

**Interfaces:**
- Consumes: `createClient` (navigateur, Task 2) — `() => SupabaseClient`.

- [ ] **Step 1: Créer `app/inscription/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Panel from "@/components/Panel";
import { createClient } from "@/lib/supabase/client";

export default function InscriptionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("password")) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
      } else {
        setError("Une erreur est survenue, réessaie dans quelques instants.");
      }
      return;
    }

    // Avec la confirmation email désactivée, Supabase renvoie un
    // utilisateur "vide" (identities === []) si l'email existe déjà,
    // plutôt qu'une erreur explicite.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError("Cette adresse est déjà associée à un compte.");
      return;
    }

    router.push("/compte");
    router.refresh();
  }

  return (
    <div className="animate-fade-up mx-auto max-w-md py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Inscription
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Crée ton compte Bluminoo
        </h2>
      </div>

      <Panel className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-neutral-400"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-neutral-400"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Création en cours…" : "Créer mon compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-400">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="text-primary-soft hover:underline">
            Se connecter
          </Link>
        </p>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Vérification manuelle**

(Nécessite `.env.local` — Task 1.) Sur `/inscription`, créer un compte avec un email neuf → redirection vers `/compte`. Retenter avec le même email → message "Cette adresse est déjà associée à un compte." Vérifier dans le dashboard Supabase (Table Editor → `profiles`) qu'une ligne `credits = 0` a été créée pour le nouvel utilisateur. Contourner l'attribut `minLength` du champ (ex. DevTools) et soumettre un mot de passe de 3 caractères → message "Le mot de passe doit contenir au moins 6 caractères."

- [ ] **Step 4: Commit**

```bash
git add app/inscription/page.tsx
git commit -m "feat: ajouter la page d'inscription"
```

---

### Task 5: Page de connexion

**Files:**
- Create: `app/connexion/page.tsx`

**Interfaces:**
- Consumes: `createClient` (navigateur, Task 2).

- [ ] **Step 1: Créer `app/connexion/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Panel from "@/components/Panel";
import { createClient } from "@/lib/supabase/client";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("Email ou mot de passe incorrect.");
      return;
    }

    router.push("/compte");
    router.refresh();
  }

  return (
    <div className="animate-fade-up mx-auto max-w-md py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Connexion
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Content de te revoir
        </h2>
      </div>

      <Panel className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-neutral-400"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium uppercase tracking-[0.1em] text-neutral-400"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none focus:border-primary/50"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion en cours…" : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-400">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="text-primary-soft hover:underline">
            S'inscrire
          </Link>
        </p>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Vérification manuelle**

(Nécessite `.env.local` — Task 1, et un compte créé en Task 4.) Sur `/connexion`, se connecter avec les bons identifiants → redirection `/compte`. Retenter avec un mauvais mot de passe → message "Email ou mot de passe incorrect.", pas de redirection.

- [ ] **Step 4: Commit**

```bash
git add app/connexion/page.tsx
git commit -m "feat: ajouter la page de connexion"
```

---

### Task 6: Page Mon compte + déconnexion

**Files:**
- Create: `app/compte/page.tsx`
- Create: `components/SignOutButton.tsx`

**Interfaces:**
- Consumes: `createClient` (serveur, Task 2), `createClient` (navigateur, Task 2), table `profiles` (Task 1).
- Produces: `SignOutButton` (composant, pas de props).

- [ ] **Step 1: Créer `components/SignOutButton.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/connexion");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-white/20 hover:text-white"
    >
      Se déconnecter
    </button>
  );
}
```

- [ ] **Step 2: Créer `app/compte/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Panel from "@/components/Panel";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";

export default async function ComptePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", user.id)
    .single();

  return (
    <div className="animate-fade-up mx-auto max-w-md py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Mon compte
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Bienvenue
        </h2>
      </div>

      <Panel className="p-6">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-neutral-500">
              Email
            </dt>
            <dd className="mt-1 text-white">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-neutral-500">
              Crédits disponibles
            </dt>
            <dd className="mt-1 text-white">{profile?.credits ?? 0}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 4: Vérification manuelle**

(Nécessite `.env.local` — Task 1, et un compte créé en Task 4.) Connecté, aller sur `/compte` → email et "Crédits disponibles : 0" affichés. Cliquer "Se déconnecter" → retour à `/connexion`. Sans session, accès direct à `/compte` → redirection immédiate vers `/connexion` (pas de flash de contenu protégé).

- [ ] **Step 5: Commit**

```bash
git add app/compte/page.tsx components/SignOutButton.tsx
git commit -m "feat: ajouter la page compte et la déconnexion"
```

---

### Task 7: Header sensible à la session

**Files:**
- Modify: `components/SiteHeader.tsx`

**Interfaces:**
- Consumes: `createClient` (navigateur, Task 2).

- [ ] **Step 1: Ajouter l'import du client Supabase**

Remplacer :

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";

const MOBILE_BREAKPOINT_QUERY = "(min-width: 768px)";
```

par :

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MOBILE_BREAKPOINT_QUERY = "(min-width: 768px)";
```

- [ ] **Step 2: Ajouter l'état de session**

Remplacer :

```tsx
export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Ferme le panneau mobile à chaque changement de route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
```

par :

```tsx
export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Ferme le panneau mobile à chaque changement de route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Reflète l'état de session Supabase (null = pas encore su, évite un
  // flash "Connexion" pendant l'hydratation).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);
```

- [ ] **Step 3: Regrouper la nav desktop avec le lien de session**

Remplacer :

```tsx
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition duration-200 ${
                    active
                      ? "bg-primary text-ink"
                      : "text-neutral-400 hover:text-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
```

par :

```tsx
          <div className="hidden items-center gap-4 md:flex">
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition duration-200 ${
                      active
                        ? "bg-primary text-ink"
                        : "text-neutral-400 hover:text-neutral-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {isLoggedIn !== null && (
              <Link
                href={isLoggedIn ? "/compte" : "/connexion"}
                className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300 transition hover:border-white/20 hover:text-white"
              >
                {isLoggedIn ? "Mon compte" : "Connexion"}
              </Link>
            )}
          </div>
```

- [ ] **Step 4: Ajouter le lien de session dans le panneau mobile**

Remplacer :

```tsx
              <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition ${
                        active
                          ? "bg-primary text-ink"
                          : "text-neutral-300 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
```

par :

```tsx
              <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition ${
                        active
                          ? "bg-primary text-ink"
                          : "text-neutral-300 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                {isLoggedIn !== null && (
                  <Link
                    href={isLoggedIn ? "/compte" : "/connexion"}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-neutral-300 transition hover:bg-white/[0.04] hover:text-white"
                  >
                    {isLoggedIn ? "Mon compte" : "Connexion"}
                  </Link>
                )}
              </nav>
```

- [ ] **Step 5: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 6: Vérification manuelle**

(Nécessite `.env.local` — Task 1.) Déconnecté, le header affiche "Connexion" (desktop et menu mobile). Après connexion (Task 5), il affiche "Mon compte" sans rechargement complet de page. Le comportement du menu hamburger (ouverture/fermeture, verrouillage du scroll, fermeture sur Échap) reste inchangé.

- [ ] **Step 7: Commit**

```bash
git add components/SiteHeader.tsx
git commit -m "feat: afficher l'état de connexion dans le header"
```
