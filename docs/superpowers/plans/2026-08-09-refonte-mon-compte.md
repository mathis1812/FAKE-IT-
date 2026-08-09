# Refonte page "Mon compte" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer `/compte` d'un unique panel centré (`dl` de texte) en un
dashboard 2 colonnes : panneau "Informations Personnelles" + CTA "Recharger
mes crédits" à gauche, cards "Crédits" et "Abonnement" à droite.

**Architecture:** Un nouveau composant de présentation `AccountStatCard`
(wrapper `Panel` avec icône + titre) factorise le style commun des 2 cards
latérales. `app/compte/page.tsx` garde toute sa logique serveur existante
(auth, fetch Supabase, calculs `planName`/`renewalDate`) inchangée et ne
change que le JSX retourné.

**Tech Stack:** Next.js 14 App Router (composant serveur async), Tailwind
CSS, aucune nouvelle dépendance.

## Global Constraints

- Aucun nouveau token de couleur Tailwind — tout reste dans la palette
  `primary` (`#a855f7`/`#d8b4fe`/`#7e22ce`) déjà définie dans
  `tailwind.config.ts`.
- Aucune bibliothèque d'icônes — le projet utilise des SVG inline à la main
  (`viewBox="0 0 24 24"`, `stroke="currentColor"`, `strokeWidth="1.8"`),
  voir `components/SiteHeader.tsx:141` pour le pattern existant.
- Aucune nouvelle requête Supabase — réutilisation stricte de `user`,
  `profile.credits`, `profile.plan`, `profile.current_period_end`,
  `profileError` déjà fetchés en haut de `app/compte/page.tsx`.
- Pas de champ "Langue du site" (pas d'i18n dans le projet).
- Champ "Rôle" = texte statique `"User"` (pas de colonne `role` dans
  `profiles`).
- **Pas de framework de test dans ce projet** (choix assumé) — la
  vérification se fait via `npx tsc --noEmit -p tsconfig.json` et `npm run
  build` (pas seulement `tsc`, qui a déjà raté une erreur ESLint bloquante
  de build par le passé), plus une vérification manuelle dans le
  navigateur.
- Style des CTA à réutiliser tel quel :
  - Bouton plein (primaire) : `rounded-2xl bg-primary px-4 py-3 text-sm
    font-semibold text-ink transition hover:bg-primary-soft` (voir
    `components/SubscribeButton.tsx:58`).
  - Bouton outline (secondaire) : nouveau, dérivé du même gabarit avec
    `border border-primary/40 text-primary-soft hover:border-primary
    hover:text-primary` (pas de composant existant à réutiliser ici).
  - `ManageSubscriptionButton` et `SignOutButton` : utilisés tels quels,
    aucune modification.

---

### Task 1: Composant `AccountStatCard`

**Files:**
- Create: `components/AccountStatCard.tsx`

**Interfaces:**
- Consumes: `Panel` depuis `@/components/Panel` (composant existant, prend
  déjà `children` et `className`).
- Produces: `AccountStatCard` — composant serveur-compatible (pas de
  `"use client"`) avec la signature :
  ```ts
  function AccountStatCard(props: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
  }): JSX.Element
  ```
  Consommé par Task 2 pour les cards "Crédits" et "Abonnement".

- [ ] **Step 1: Créer le composant**

Créer `components/AccountStatCard.tsx` :

```tsx
import type { ReactNode } from "react";
import Panel from "@/components/Panel";

export default function AccountStatCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-soft">
          {icon}
        </span>
        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-primary-soft">
          {title}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </Panel>
  );
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur (le fichier n'est encore importé nulle part, donc
ce check confirme juste que le composant lui-même est bien typé).

- [ ] **Step 3: Commit**

```bash
git add components/AccountStatCard.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: ajouter le composant AccountStatCard pour la page compte"
```

---

### Task 2: Réécriture de `app/compte/page.tsx`

**Files:**
- Modify: `app/compte/page.tsx` (réécriture complète du JSX retourné ;
  imports et logique serveur au-dessus de `return` inchangés)

**Interfaces:**
- Consumes: `AccountStatCard` de Task 1 (`icon`, `title`, `children`) ;
  `Panel`, `SignOutButton`, `ManageSubscriptionButton` (composants
  existants, signatures inchangées) ; `PLANS`, `PlanId` de `@/lib/stripe`.
- Produces: rien de consommé par d'autres tasks — c'est la dernière task du
  plan.

- [ ] **Step 1: Remplacer le contenu du fichier**

Remplacer entièrement `app/compte/page.tsx` par :

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import Panel from "@/components/Panel";
import AccountStatCard from "@/components/AccountStatCard";
import SignOutButton from "@/components/SignOutButton";
import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

export default async function ComptePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/connexion");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("credits, plan, current_period_end")
    .eq("id", user.id)
    .single();

  const planId = profile?.plan as PlanId | null | undefined;
  const planName = planId ? PLANS[planId]?.name : null;
  const renewalDate = profile?.current_period_end
    ? new Date(profile.current_period_end).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="animate-fade-up mx-auto max-w-4xl py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Mon compte
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Bienvenue
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel className="p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-soft">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Informations Personnelles
                </p>
                <p className="text-xs text-neutral-500">
                  Vos données de base sur Bluminoo Studio.
                </p>
              </div>
            </div>

            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-neutral-500">
                  Email
                </dt>
                <dd className="mt-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white">
                  {user.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-neutral-500">
                  Rôle
                </dt>
                <dd className="mt-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-white">
                  User
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel className="p-6">
            <p className="text-sm font-semibold text-white">
              Recharger mes crédits
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Passe à un palier supérieur ou renouvelle ton abonnement pour
              obtenir plus de crédits.
            </p>
            <Link
              href="/tarifs"
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft"
            >
              Recharger mes crédits
            </Link>
          </Panel>
        </div>

        <div className="space-y-6">
          <AccountStatCard
            title="Crédits"
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            }
          >
            <p
              className={
                profileError
                  ? "text-sm font-medium text-neutral-400"
                  : "text-3xl font-semibold text-white"
              }
            >
              {profileError
                ? "Impossible de charger ton solde pour le moment."
                : profile?.credits ?? 0}
            </p>
            {!profileError && (
              <p className="mt-1 text-xs text-neutral-500">crédits restants</p>
            )}
          </AccountStatCard>

          <AccountStatCard
            title="Abonnement"
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            }
          >
            <p className="text-xl font-semibold text-white">
              {planName ?? "Plan Gratuit"}
            </p>
            {renewalDate && (
              <p className="mt-1 text-xs text-neutral-500">
                Renouvellement le {renewalDate}
              </p>
            )}
            <div className="mt-4">
              {planId ? (
                <ManageSubscriptionButton />
              ) : (
                <Link
                  href="/tarifs"
                  className="flex w-full items-center justify-center rounded-2xl border border-primary/40 px-4 py-3 text-sm font-semibold text-primary-soft transition hover:border-primary hover:text-primary"
                >
                  Voir les offres
                </Link>
              )}
            </div>
          </AccountStatCard>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-md">
        <SignOutButton />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier le build complet**

Run: `npm run build`
Expected: build réussi (exit code 0), pas d'erreur ESLint
(`react/no-unescaped-entities` ou autre) ni d'erreur de type manquée par
`tsc --noEmit` seul.

- [ ] **Step 4: Vérification manuelle dans le navigateur**

Run: `npm run dev`, se connecter avec un compte existant, naviguer vers
`/compte`.

Vérifier :
- Layout 2 colonnes au-dessus de `lg` (≥1024px), 1 colonne en dessous.
- Panneau "Informations Personnelles" affiche le bon email et "User".
- Bouton "Recharger mes crédits" redirige vers `/tarifs`.
- Card "Crédits" affiche le solde réel (ou le message de fallback si la
  requête profil échoue — difficile à provoquer manuellement, relire le
  code au besoin).
- Card "Abonnement" affiche "Plan Gratuit" + bouton "Voir les offres" pour
  un compte non abonné, ou le nom du palier + `ManageSubscriptionButton`
  pour un compte abonné (au moins un des deux cas testable selon les
  comptes de test disponibles).
- Bouton "Se déconnecter" fonctionne toujours (redirige vers `/connexion`).

- [ ] **Step 5: Commit**

```bash
git add app/compte/page.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: refonte de la page Mon compte en dashboard 2 colonnes"
```

---

## Self-Review Notes

- **Couverture du spec** : layout 2 colonnes ✓ (Task 2), panneau Infos
  Personnelles avec Email + Rôle statique ✓, pas de champ langue ✓, section
  Recharger mes crédits en CTA plein vers `/tarifs` ✓, card Crédits avec
  fallback erreur ✓, card Abonnement avec `ManageSubscriptionButton` ou CTA
  "Voir les offres" ✓, palette 100% `primary` (aucun vert/ambre) ✓,
  `SignOutButton` inchangé en bas de page ✓, responsive 1 colonne sous `lg`
  ✓, aucune nouvelle requête Supabase ✓.
- **Placeholders** : aucun — tout le code est complet et exécutable tel
  quel.
- **Cohérence des types** : `AccountStatCard` défini en Task 1 avec
  `{icon, title, children}` est utilisé avec exactement ces 3 props en
  Task 2, aucune dérive de nom.
