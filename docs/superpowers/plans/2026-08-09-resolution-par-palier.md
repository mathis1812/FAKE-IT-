# Résolution d'image dynamique par palier + bénéfices tarifs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire dépendre la résolution d'image générée (`1K`/`2K`/`4K`) du
palier d'abonnement réel de l'utilisateur, et enrichir la liste de
bénéfices affichée sur `/tarifs` avec des points honnêtes, différenciés
par palier, avec mise en avant en gras des points forts.

**Architecture:** Deux sous-systèmes indépendants. (1) `lib/stripe.ts`
gagne un champ `imageResolution` par palier ; `app/api/generate/route.ts`
le résout côté serveur depuis le profil Supabase de l'utilisateur avant
d'appeler kie.ai, remplaçant la valeur `"1K"` codée en dur. (2)
`components/PricingGrid.tsx` change le type de `features` de `string[]` à
une liste d'objets `{ text, bold? }` et rend le gras conditionnellement ;
`app/tarifs/page.tsx` fournit le nouveau contenu.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, kie.ai API.

## Global Constraints

- Résolution jamais acceptée depuis le corps de la requête HTTP
  `POST /api/generate` — toujours dérivée côté serveur du `profile.plan`
  de l'utilisateur authentifié, jamais du client.
- Mapping résolution/palier : `decouverte` → `1K`, `essentiel` → `2K`,
  `ultimate` → `4K`.
- Fallback sans palier actif (ou si le fetch du profil échoue) : `1K`,
  silencieusement — ne jamais bloquer une génération pour cette raison.
- Coût en crédits inchangé : `IMAGE_GENERATION_COST` reste 150, peu
  importe la résolution — aucune modification de `lib/credits.ts`.
- Bénéfices honnêtes uniquement — aucune mention de vitesse, file
  d'attente, support 24/7, ou tout autre différenciateur non implémenté
  dans le code actuel. Aucune référence à une fonctionnalité de type
  "Snap Rouge" (explicitement exclue, hors scope de ce plan).
- Pas de framework de test dans ce projet — vérification via `npx tsc
  --noEmit -p tsconfig.json` et `npm run build`.

---

### Task 1: Résolution d'image dynamique par palier

**Files:**
- Modify: `lib/stripe.ts`
- Modify: `app/api/generate/route.ts`

**Interfaces:**
- Consumes: rien de nouveau (fichiers indépendants du reste du plan).
- Produces: `ImageResolution` (type `"1K" | "2K" | "4K"`, exporté depuis
  `lib/stripe.ts`) et `PLANS[planId].imageResolution` — pas consommés par
  Task 2, mais font partie de l'API publique de `lib/stripe.ts` pour tout
  code futur.

- [ ] **Step 1: Ajouter le type et le champ `imageResolution` dans `lib/stripe.ts`**

Remplacer entièrement `lib/stripe.ts` par :

```ts
import Stripe from "stripe";

// Toute valeur lue depuis l'environnement est nettoyée : un caractère invisible
// collé par erreur (BOM, espace, retour ligne) rend la clé invalide, et Stripe
// échoue alors sur une « erreur de connexion » impossible à diagnostiquer.
// Le BOM comptant comme un espace en JS, `.trim()` le supprime également.
export function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const stripe = new Stripe(
  envValue("STRIPE_SECRET_KEY") || "sk_placeholder_missing_key",
  { apiVersion: "2026-07-29.dahlia" },
);

// Le SDK Stripe accepte silencieusement une clé absente/placeholder à la
// construction ; chaque route doit vérifier explicitement avant d'appeler
// l'API, pour renvoyer le même message clair que les autres clés (kie.ai)
// plutôt qu'une erreur Stripe "Invalid API Key" moins lisible.
export function isStripeConfigured(): boolean {
  return envValue("STRIPE_SECRET_KEY").length > 0;
}

export type PlanId = "decouverte" | "essentiel" | "ultimate";
export type BillingPeriod = "monthly" | "annual";
export type ImageResolution = "1K" | "2K" | "4K";

type PriceInfo = { priceId: string; priceEur: number };

export const PLANS: Record<
  PlanId,
  {
    name: string;
    monthly: PriceInfo;
    annual: PriceInfo;
    creditsPerMonth: number;
    imageResolution: ImageResolution;
  }
> = {
  decouverte: {
    name: "Découverte",
    monthly: { priceId: envValue("STRIPE_PRICE_DECOUVERTE"), priceEur: 9.9 },
    annual: {
      priceId: envValue("STRIPE_PRICE_DECOUVERTE_ANNUEL"),
      priceEur: 94.9,
    },
    creditsPerMonth: 2000,
    imageResolution: "1K",
  },
  essentiel: {
    name: "Essentiel",
    monthly: { priceId: envValue("STRIPE_PRICE_ESSENTIEL"), priceEur: 19.9 },
    annual: {
      priceId: envValue("STRIPE_PRICE_ESSENTIEL_ANNUEL"),
      priceEur: 190.9,
    },
    creditsPerMonth: 5000,
    imageResolution: "2K",
  },
  ultimate: {
    name: "Ultimate",
    monthly: { priceId: envValue("STRIPE_PRICE_ULTIMATE"), priceEur: 39.9 },
    annual: {
      priceId: envValue("STRIPE_PRICE_ULTIMATE_ANNUEL"),
      priceEur: 382.9,
    },
    creditsPerMonth: 12000,
    imageResolution: "4K",
  },
};

export function priceIdFor(planId: PlanId, period: BillingPeriod): string {
  return PLANS[planId][period].priceId;
}

// Facturation annuelle = un seul crédit d'un an d'un coup (le webhook ne
// reçoit qu'un événement de renouvellement par an pour ces abonnements-là,
// contre un par mois pour les abonnements mensuels).
export function creditsFor(planId: PlanId, period: BillingPeriod): number {
  const perMonth = PLANS[planId].creditsPerMonth;
  return period === "annual" ? perMonth * 12 : perMonth;
}

export function resolvePriceId(
  priceId: string | undefined,
): { planId: PlanId; period: BillingPeriod } | null {
  if (!priceId) return null;
  for (const [id, plan] of Object.entries(PLANS) as [
    PlanId,
    (typeof PLANS)[PlanId],
  ][]) {
    if (plan.monthly.priceId === priceId) return { planId: id, period: "monthly" };
    if (plan.annual.priceId === priceId) return { planId: id, period: "annual" };
  }
  return null;
}
```

- [ ] **Step 2: Résoudre la résolution dynamiquement dans `app/api/generate/route.ts`**

Remplacer entièrement `app/api/generate/route.ts` par :

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  IMAGE_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { persistImageResult } from "@/lib/gallery-server";
import { createKieTask, pollKieTask } from "@/lib/kie-jobs";
import { PLANS, type PlanId } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_ID = "nano-banana-pro";
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 100_000;

type GenerateBody = {
  sourceImageUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.KIE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Clé API manquante. Définissez KIE_API_KEY dans vos variables d'environnement.",
      },
      { status: 500 },
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const { sourceImageUrl, objectImageUrl, prompt, label } = body;

  if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
    return NextResponse.json(
      { error: "Image manquante. Uploadez une photo puis réessayez." },
      { status: 400 },
    );
  }

  if (!prompt || !prompt.trim()) {
    return NextResponse.json(
      { error: "Prompt manquant. Décrivez la transformation souhaitée." },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Connectez-vous pour générer une image." },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  const planId = profile?.plan as PlanId | null | undefined;
  const resolution = planId ? PLANS[planId]?.imageResolution ?? "1K" : "1K";

  let hasCredits: boolean;
  try {
    hasCredits = await spendCredits(user.id, IMAGE_GENERATION_COST);
  } catch (err) {
    console.error("Échec de la vérification des crédits :", err);
    return NextResponse.json(
      { error: "Erreur interne lors de la vérification des crédits." },
      { status: 500 },
    );
  }
  if (!hasCredits) {
    return NextResponse.json(
      {
        error:
          "Crédits insuffisants. Rendez-vous sur la page Tarifs pour recharger votre compte.",
      },
      { status: 402 },
    );
  }

  const imageInput = [sourceImageUrl];
  let finalPrompt = prompt.trim();
  if (objectImageUrl && typeof objectImageUrl === "string") {
    imageInput.push(objectImageUrl);
    finalPrompt +=
      " Integrate the reference object shown in the second image photorealistically, " +
      "while preserving the subject, pose, lighting and background from the first image.";
  }

  try {
    const taskId = await createKieTask(apiKey, MODEL_ID, {
      prompt: finalPrompt,
      image_input: imageInput,
      aspect_ratio: "auto",
      resolution,
      output_format: "png",
    });
    const resultUrl = await pollKieTask(apiKey, taskId, {
      intervalMs: POLL_INTERVAL_MS,
      timeoutMs: POLL_TIMEOUT_MS,
    });
    const imageUrl = await persistImageResult(
      user.id,
      resultUrl,
      label?.trim() || "Génération image",
    );
    return NextResponse.json({ imageUrl });
  } catch (err) {
    await refundCredits(user.id, IMAGE_GENERATION_COST);
    if (err instanceof Error && err.message === "TIMEOUT") {
      return NextResponse.json(
        {
          error:
            "La génération a dépassé le délai imparti. Réessayez dans quelques instants.",
        },
        { status: 504 },
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : "Erreur inconnue lors de la génération de l'image.";
    return NextResponse.json(
      { error: `Erreur du service de génération kie.ai. ${message}` },
      { status: 502 },
    );
  }
}
```

Note : le fetch du profil n'est pas encadré par une gestion d'erreur
explicite — si la requête Supabase échoue, `profile` vaut `undefined`,
donc `planId` vaut `undefined`, donc `resolution` retombe naturellement
sur `"1K"` via l'opérateur ternaire. C'est le comportement de fallback
silencieux voulu, sans code supplémentaire.

- [ ] **Step 3: Vérifier les types**

Run: `npx tsc --noEmit -p tsconfig.json` (depuis
`C:\Users\julie\projects\fakeit`)
Expected: aucune erreur.

- [ ] **Step 4: Vérifier le build complet**

Run: `npm run build` (depuis `C:\Users\julie\projects\fakeit`)
Expected: build réussi (exit code 0), 22 pages compilées, pas d'erreur
ESLint.

- [ ] **Step 5: Commit**

```bash
git add lib/stripe.ts app/api/generate/route.ts
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: résoudre la résolution d'image dynamiquement selon le palier de l'utilisateur"
```

---

### Task 2: Bénéfices tarifs enrichis avec support du gras

**Files:**
- Modify: `components/PricingGrid.tsx`
- Modify: `app/tarifs/page.tsx`

**Interfaces:**
- Consumes: rien de Task 1 (sous-systèmes indépendants).
- Produces: `PlanFeature` (type `{ text: string; bold?: boolean }`,
  exporté depuis `components/PricingGrid.tsx`), consommé par
  `app/tarifs/page.tsx` pour typer `PLAN_FEATURES`.

- [ ] **Step 1: Changer le type `features` et le rendu dans `components/PricingGrid.tsx`**

Remplacer entièrement `components/PricingGrid.tsx` par :

```tsx
"use client";

import { useState } from "react";
import Panel from "@/components/Panel";
import SubscribeButton from "@/components/SubscribeButton";
import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
import type { BillingPeriod, PlanId } from "@/lib/stripe";

export type PlanFeature = { text: string; bold?: boolean };

type PlanView = {
  id: PlanId;
  name: string;
  monthlyPriceEur: number;
  annualPriceEur: number;
  creditsPerMonth: number;
  features: PlanFeature[];
};

function formatEur(amount: number): string {
  return amount.toFixed(2).replace(".", ",");
}

export default function PricingGrid({
  plans,
  currentPlan,
  isLoggedIn,
}: {
  plans: PlanView[];
  currentPlan: PlanId | null;
  isLoggedIn: boolean;
}) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`rounded-full px-4 py-1.5 transition ${
              period === "monthly"
                ? "bg-primary text-ink"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setPeriod("annual")}
            className={`rounded-full px-4 py-1.5 transition ${
              period === "annual"
                ? "bg-primary text-ink"
                : "text-neutral-400 hover:text-neutral-100"
            }`}
          >
            Annuel · -20%
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const annualEffectiveMonthly = plan.annualPriceEur / 12;

          return (
            <Panel key={plan.id} className="flex flex-col p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-white">
                  {plan.name}
                </h3>
                {isCurrent && (
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-soft">
                    Plan actuel
                  </span>
                )}
              </div>

              {period === "monthly" ? (
                <p className="mb-1 text-3xl font-semibold text-white">
                  {formatEur(plan.monthlyPriceEur)} €
                  <span className="text-sm font-normal text-neutral-500">
                    /mois
                  </span>
                </p>
              ) : (
                <div className="mb-1">
                  <p className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-neutral-600 line-through">
                      {formatEur(plan.monthlyPriceEur)} €/mois
                    </span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-primary-soft">
                      -20%
                    </span>
                  </p>
                  <p className="text-3xl font-semibold text-white">
                    {formatEur(annualEffectiveMonthly)} €
                    <span className="text-sm font-normal text-neutral-500">
                      /mois
                    </span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    Facturé {formatEur(plan.annualPriceEur)} €/an
                  </p>
                </div>
              )}

              <p className="mb-4 mt-2 text-sm text-neutral-400">
                {plan.creditsPerMonth.toLocaleString("fr-FR")} crédits/mois
                {period === "annual" && (
                  <span className="text-neutral-600">
                    {" "}
                    (crédités en une fois pour l&apos;année)
                  </span>
                )}
              </p>

              <ul className="mb-6 flex-1 space-y-2.5 text-sm text-neutral-400">
                {plan.features.map((feature) => (
                  <li key={feature.text} className="flex items-start gap-2">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span
                      className={
                        feature.bold ? "font-semibold text-white" : undefined
                      }
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-medium text-neutral-500">
                  Ton palier actuel
                </div>
              ) : currentPlan ? (
                <ManageSubscriptionButton />
              ) : (
                <SubscribeButton
                  plan={plan.id}
                  period={period}
                  isLoggedIn={isLoggedIn}
                />
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mettre à jour `PLAN_FEATURES` dans `app/tarifs/page.tsx`**

Remplacer entièrement `app/tarifs/page.tsx` par :

```tsx
import PricingGrid, { type PlanFeature } from "@/components/PricingGrid";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

const PLAN_ORDER: PlanId[] = ["decouverte", "essentiel", "ultimate"];

const PLAN_FEATURES: Record<PlanId, PlanFeature[]> = {
  decouverte: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité 1K" },
    { text: "Photo de référence optionnelle" },
    { text: "Historique complet" },
  ],
  essentiel: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité 2K", bold: true },
    { text: "Photo de référence optionnelle" },
    { text: "Historique complet" },
    { text: "Support prioritaire" },
  ],
  ultimate: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité 4K Ultra-détails", bold: true },
    { text: "Photo de référence optionnelle" },
    { text: "Historique complet" },
    { text: "Support prioritaire" },
    { text: "12 000 crédits/mois (plafonné)" },
  ],
};

export default async function TarifsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentPlan: PlanId | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    currentPlan = (profile?.plan as PlanId | null) ?? null;
  }

  const plans = PLAN_ORDER.map((planId) => ({
    id: planId,
    name: PLANS[planId].name,
    monthlyPriceEur: PLANS[planId].monthly.priceEur,
    annualPriceEur: PLANS[planId].annual.priceEur,
    creditsPerMonth: PLANS[planId].creditsPerMonth,
    features: PLAN_FEATURES[planId],
  }));

  return (
    <div className="animate-fade-up mx-auto max-w-5xl py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Tarifs
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Des tarifs simples, pensés pour créer sans limite.
        </h2>
      </div>

      <PricingGrid plans={plans} currentPlan={currentPlan} isLoggedIn={!!user} />
    </div>
  );
}
```

- [ ] **Step 3: Vérifier les types**

Run: `npx tsc --noEmit -p tsconfig.json` (depuis
`C:\Users\julie\projects\fakeit`)
Expected: aucune erreur.

- [ ] **Step 4: Vérifier le build complet**

Run: `npm run build` (depuis `C:\Users\julie\projects\fakeit`)
Expected: build réussi (exit code 0), pas d'erreur ESLint.

- [ ] **Step 5: Vérification manuelle dans le navigateur**

Run: `npm run dev`, naviguer vers `/tarifs` (page publique, pas besoin de
connexion).

Vérifier :
- Les 3 cartes affichent bien les nouvelles listes de bénéfices.
- "Qualité 2K" (Essentiel) et "Qualité 4K Ultra-détails" (Ultimate)
  apparaissent en gras/blanc, le reste des items reste en gris normal.
- Le toggle mensuel/annuel fonctionne toujours normalement (pas de
  régression, ce composant n'est pas touché par ce changement).

- [ ] **Step 6: Commit**

```bash
git add components/PricingGrid.tsx app/tarifs/page.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: enrichir les bénéfices par palier sur /tarifs avec mise en avant en gras"
```

---

## Self-Review Notes

- **Couverture du spec** : type `ImageResolution` + champ `imageResolution`
  sur `PLANS` ✓ (Task 1 Step 1), résolution dynamique côté serveur sans
  jamais lire le corps de la requête ✓ (Task 1 Step 2), fallback silencieux
  `1K` ✓ (Task 1 Step 2, note), coût crédits inchangé ✓ (aucune
  modification de `lib/credits.ts` dans le plan), type `PlanFeature` +
  rendu du gras ✓ (Task 2 Step 1), contenu honnête des bénéfices par
  palier ✓ (Task 2 Step 2), aucune mention "Snap Rouge" ou différenciateur
  non vérifiable ✓ (absent des deux tasks).
- **Placeholders** : aucun — tout le code est complet et exécutable tel
  quel dans les deux tasks.
- **Cohérence des types** : `PlanFeature` est défini et exporté dans
  `components/PricingGrid.tsx` (Task 2 Step 1) puis importé tel quel
  (`import { type PlanFeature }`) dans `app/tarifs/page.tsx` (Task 2
  Step 2) — aucune dérive de nom. `ImageResolution` et
  `PLANS[planId].imageResolution` (Task 1) ne sont consommés par aucune
  autre task de ce plan — cohérence interne à Task 1 uniquement.
- **Indépendance des tasks** : Task 1 et Task 2 ne touchent aucun fichier
  en commun et peuvent être review-ées indépendamment.
