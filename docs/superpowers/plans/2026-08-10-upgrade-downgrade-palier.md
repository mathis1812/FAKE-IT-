# Changement de palier (upgrade/downgrade) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un utilisateur déjà abonné de changer de palier
(upgrade ou downgrade) directement depuis `/tarifs`, via l'écran natif de
confirmation du portail Stripe, avec synchronisation automatique du
palier/crédits en base dès que Stripe confirme le changement.

**Architecture:** Backend d'abord (Task 1) : `/api/stripe/portal` accepte
un `targetPlan` optionnel et construit une session portail avec
`flow_data` pointant sur le nouveau prix ; le webhook gagne un handler
`customer.subscription.updated` gardé par `previous_attributes.items`
pour ne synchroniser que les vrais changements de prix. Frontend ensuite
(Task 2) : `ManageSubscriptionButton` prend une prop `targetPlan`
optionnelle et `PricingGrid` la passe sur les cartes non courantes.

**Tech Stack:** Next.js 14 App Router, Stripe SDK, Supabase.

## Global Constraints

- La périodicité (mensuel/annuel) du changement de palier est toujours
  celle de l'abonnement Stripe réel en cours — dérivée côté serveur via
  `resolvePriceId()`, jamais fournie par le client.
- Les crédits du nouveau palier sont appliqués immédiatement dès que
  Stripe confirme le changement (`customer.subscription.updated` avec
  `previous_attributes.items` présent) — pas d'attente du prochain
  renouvellement.
- Le handler `customer.subscription.updated` ne doit modifier
  `profiles` QUE quand `event.data.previous_attributes` contient la clé
  `items` (preuve que le prix a changé) — sinon ignorer l'event
  silencieusement (retour 200 normal, aucune écriture).
- Pas de framework de test dans ce projet — vérification via `npx tsc
  --noEmit -p tsconfig.json` et `npm run build`.
- Le comportement existant de `/api/stripe/portal` sans `targetPlan`
  (utilisé par `/compte`) doit rester strictement inchangé.

---

### Task 1: Backend — portail ciblé + webhook `subscription.updated`

**Files:**
- Modify: `app/api/stripe/portal/route.ts`
- Modify: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `PLANS`, `priceIdFor`, `resolvePriceId`, `creditsFor`,
  `type PlanId`, `type BillingPeriod` (tous déjà exportés par
  `lib/stripe.ts`, aucune modification de ce fichier dans ce plan).
- Produces: `POST /api/stripe/portal` accepte désormais un corps JSON
  optionnel `{ targetPlan?: string }` — consommé par Task 2 via
  `ManageSubscriptionButton`.

- [ ] **Step 1: Étendre `app/api/stripe/portal/route.ts` pour accepter `targetPlan`**

Remplacer entièrement `app/api/stripe/portal/route.ts` par :

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  stripe,
  isStripeConfigured,
  PLANS,
  priceIdFor,
  resolvePriceId,
  type PlanId,
} from "@/lib/stripe";

export const runtime = "nodejs";

type PortalBody = { targetPlan?: string };

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Clé API manquante. Définissez STRIPE_SECRET_KEY dans vos variables d'environnement.",
      },
      { status: 500 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Connecte-toi pour gérer ton abonnement." },
      { status: 401 },
    );
  }

  let body: PortalBody = {};
  try {
    const raw = await req.text();
    if (raw) {
      body = JSON.parse(raw) as PortalBody;
    }
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const targetPlan = body.targetPlan as PlanId | undefined;
  if (targetPlan && !(targetPlan in PLANS)) {
    return NextResponse.json({ error: "Palier inconnu." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, plan")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Aucun abonnement actif." },
      { status: 400 },
    );
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const customerId = profile.stripe_customer_id as string;

  if (!targetPlan) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/compte`,
      });

      return NextResponse.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur Stripe.";
      return NextResponse.json(
        { error: `Impossible d'ouvrir le portail de facturation. ${message}` },
        { status: 502 },
      );
    }
  }

  const subscriptionId = profile.stripe_subscription_id as string | null;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Aucun abonnement actif à modifier." },
      { status: 400 },
    );
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentItem = subscription.items.data[0];
    const resolved = resolvePriceId(currentItem?.price.id);
    const period = resolved?.period ?? "monthly";
    const targetPriceId = priceIdFor(targetPlan, period);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/compte?upgrade=success`,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: subscriptionId,
          items: [
            { id: currentItem.id, price: targetPriceId, quantity: 1 },
          ],
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur Stripe.";
    return NextResponse.json(
      { error: `Impossible d'ouvrir le changement de palier. ${message}` },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Ajouter le handler `customer.subscription.updated` dans le webhook**

Remplacer entièrement `app/api/stripe/webhook/route.ts` par :

```ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  stripe,
  PLANS,
  resolvePriceId,
  creditsFor,
  envValue,
  isStripeConfigured,
  type BillingPeriod,
} from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

// The installed `stripe` SDK's typings (API version 2026-07-29.dahlia) moved
// `current_period_end` off `Stripe.Subscription` and onto each subscription
// item (`Stripe.Subscription.items.data[].current_period_end`), since a
// subscription can now have items on different billing cycles. This webhook
// only ever creates single-item subscriptions (one plan per checkout), so we
// read the period end off the first item — same value the brief's
// `subscription.current_period_end` would have held under the older shape.
function currentPeriodEndOf(subscription: Stripe.Subscription): number | undefined {
  return subscription.items.data[0]?.current_period_end;
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Clé API manquante. Définissez STRIPE_SECRET_KEY dans vos variables d'environnement.",
      },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = envValue("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Configuration webhook manquante." },
      { status: 500 },
    );
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature invalide.";
    return NextResponse.json(
      { error: `Webhook invalide : ${message}` },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  let dbWriteFailed = false;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.supabase_user_id;
    const planId = session.metadata?.plan as keyof typeof PLANS | undefined;
    const period: BillingPeriod =
      session.metadata?.period === "annual" ? "annual" : "monthly";

    if (userId && planId && PLANS[planId]) {
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;

      let currentPeriodEnd: string | null = null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const periodEnd = currentPeriodEndOf(subscription);
        currentPeriodEnd = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null;
      }

      const { data: updateData, error: updateError } = await supabase
        .from("profiles")
        .update({
          stripe_customer_id: customerId ?? null,
          stripe_subscription_id: subscriptionId ?? null,
          plan: planId,
          credits: creditsFor(planId, period),
          current_period_end: currentPeriodEnd,
        })
        .eq("id", userId)
        .select("id");

      if (updateError) {
        console.error(
          `[stripe-webhook] échec update profiles pour ${event.type} (event ${event.id}):`,
          updateError,
        );
        dbWriteFailed = true;
      } else if (!updateData || updateData.length === 0) {
        console.error(
          `[stripe-webhook] ${event.type} update matched no rows for event ${event.id} (userId=${userId} may be stale)`,
        );
      }
    } else {
      console.error(
        `[stripe-webhook] checkout.session.completed missing/invalid metadata for event ${event.id}: userId=${userId}, planId=${planId}`,
      );
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;

    if (invoice.billing_reason === "subscription_cycle") {
      // `Stripe.Invoice.subscription` was removed from the installed SDK's
      // typings in favor of `invoice.parent.subscription_details.subscription`
      // (invoices can now have non-subscription parents too). Same value,
      // new path.
      const subscriptionRef =
        invoice.parent?.subscription_details?.subscription ??
        (invoice as unknown as { subscription?: string | Stripe.Subscription })
          .subscription;
      const subscriptionId =
        typeof subscriptionRef === "string"
          ? subscriptionRef
          : subscriptionRef?.id;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const resolved = resolvePriceId(priceId);
        const periodEnd = currentPeriodEndOf(subscription);

        if (resolved) {
          const { planId, period } = resolved;
          const { data: updateData, error: updateError } = await supabase
            .from("profiles")
            .update({
              plan: planId,
              credits: creditsFor(planId, period),
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : null,
            })
            .eq("stripe_subscription_id", subscriptionId)
            .select("id");

          if (updateError) {
            console.error(
              `[stripe-webhook] échec update profiles pour ${event.type} (event ${event.id}):`,
              updateError,
            );
            dbWriteFailed = true;
          } else if (!updateData || updateData.length === 0) {
            console.error(
              `[stripe-webhook] ${event.type} update matched no rows for event ${event.id} (subscriptionId=${subscriptionId} may be stale)`,
            );
          }
        } else {
          console.error(
            `[stripe-webhook] resolvePriceId introuvable pour priceId=${priceId} (subscriptionId=${subscriptionId}, event ${event.id})`,
          );
        }
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const previousAttributes = (
      event.data as { previous_attributes?: Record<string, unknown> }
    ).previous_attributes;

    if (previousAttributes && "items" in previousAttributes) {
      const priceId = subscription.items.data[0]?.price.id;
      const resolved = resolvePriceId(priceId);
      const periodEnd = currentPeriodEndOf(subscription);

      if (resolved) {
        const { planId, period } = resolved;
        const { data: updateData, error: updateError } = await supabase
          .from("profiles")
          .update({
            plan: planId,
            credits: creditsFor(planId, period),
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
          })
          .eq("stripe_subscription_id", subscription.id)
          .select("id");

        if (updateError) {
          console.error(
            `[stripe-webhook] échec update profiles pour ${event.type} (event ${event.id}):`,
            updateError,
          );
          dbWriteFailed = true;
        } else if (!updateData || updateData.length === 0) {
          console.error(
            `[stripe-webhook] ${event.type} update matched no rows for event ${event.id} (subscriptionId=${subscription.id} may be stale)`,
          );
        }
      } else {
        console.error(
          `[stripe-webhook] resolvePriceId introuvable pour priceId=${priceId} (subscriptionId=${subscription.id}, event ${event.id})`,
        );
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    const { data: updateData, error: updateError } = await supabase
      .from("profiles")
      .update({ plan: null, stripe_subscription_id: null })
      .eq("stripe_subscription_id", subscription.id)
      .select("id");

    if (updateError) {
      console.error(
        `[stripe-webhook] échec update profiles pour ${event.type} (event ${event.id}):`,
        updateError,
      );
      dbWriteFailed = true;
    } else if (!updateData || updateData.length === 0) {
      console.error(
        `[stripe-webhook] ${event.type} update matched no rows for event ${event.id} (subscriptionId=${subscription.id} may be stale)`,
      );
    }
  }

  if (dbWriteFailed) {
    return NextResponse.json(
      { error: "Échec de mise à jour du profil, réessaie." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 3: Vérifier les types**

Run: `npx tsc --noEmit -p tsconfig.json` (depuis
`C:\Users\julie\projects\fakeit`)
Expected: aucune erreur.

- [ ] **Step 4: Vérifier le build complet**

Run: `npm run build` (depuis `C:\Users\julie\projects\fakeit`)
Expected: build réussi (exit code 0), pas d'erreur ESLint.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/portal/route.ts app/api/stripe/webhook/route.ts
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: permettre le changement de palier via le portail Stripe (backend)"
```

---

### Task 2: Frontend — bouton et carte de changement de palier

**Files:**
- Modify: `components/ManageSubscriptionButton.tsx`
- Modify: `components/PricingGrid.tsx`

**Interfaces:**
- Consumes: `POST /api/stripe/portal` acceptant `{ targetPlan?: string }`
  (Task 1) ; `type PlanId` de `@/lib/stripe`.
- Produces: rien de consommé par une task ultérieure — dernière task du
  plan.

- [ ] **Step 1: Ajouter la prop `targetPlan` à `components/ManageSubscriptionButton.tsx`**

Remplacer entièrement `components/ManageSubscriptionButton.tsx` par :

```tsx
"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/stripe";

export default function ManageSubscriptionButton({
  targetPlan,
}: {
  targetPlan?: PlanId;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        ...(targetPlan
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetPlan }),
            }
          : {}),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(
          data.error ?? "Une erreur est survenue, réessaie dans quelques instants.",
        );
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Une erreur est survenue, réessaie dans quelques instants.");
      setLoading(false);
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm font-medium text-primary-soft underline underline-offset-2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Redirection…"
          : targetPlan
            ? "Passer à ce palier"
            : "Gérer mon abonnement"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
```

Note : `targetPlan` est optionnel dans le type des props. React appelle
toujours un composant avec un objet props (même vide pour `<Component
/>`), donc `<ManageSubscriptionButton />` sans prop (usage existant dans
`app/compte/page.tsx`) continue de fonctionner sans changement —
`targetPlan` vaut simplement `undefined`.

- [ ] **Step 2: Passer `targetPlan` depuis `components/PricingGrid.tsx`**

Dans `components/PricingGrid.tsx`, remplacer uniquement ce bloc (le reste
du fichier reste identique à sa version actuelle) :

```tsx
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
```

par :

```tsx
              {isCurrent ? (
                <div className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-medium text-neutral-500">
                  Ton palier actuel
                </div>
              ) : currentPlan ? (
                <ManageSubscriptionButton targetPlan={plan.id} />
              ) : (
                <SubscribeButton
                  plan={plan.id}
                  period={period}
                  isLoggedIn={isLoggedIn}
                />
              )}
```

- [ ] **Step 3: Vérifier les types**

Run: `npx tsc --noEmit -p tsconfig.json` (depuis
`C:\Users\julie\projects\fakeit`)
Expected: aucune erreur.

- [ ] **Step 4: Vérifier le build complet**

Run: `npm run build` (depuis `C:\Users\julie\projects\fakeit`)
Expected: build réussi (exit code 0), pas d'erreur ESLint.

- [ ] **Step 5: Vérification manuelle**

Cette vérification nécessite une session Stripe réelle (compte connecté +
abonnement actif + configuration Dashboard "Customers can switch plans"
activée — étape manuelle documentée dans le spec, pas encore forcément
faite au moment de l'implémentation). Skip cette étape si l'environnement
de test ne permet pas de se connecter avec un compte abonné réel ; le
controller/l'utilisateur la fera séparément après déploiement.

Si possible : se connecter avec un compte ayant un abonnement actif (ex:
Découverte), aller sur `/tarifs`, cliquer "Passer à ce palier" sur la
carte Ultimate. Vérifier que ça ouvre directement l'écran de confirmation
Stripe pour le nouveau prix (pas la page générique du portail), et
qu'après confirmation, `/compte` reflète le nouveau palier et les
nouveaux crédits.

- [ ] **Step 6: Commit**

```bash
git add components/ManageSubscriptionButton.tsx components/PricingGrid.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: permettre le changement de palier via le portail Stripe (frontend)"
```

---

## Self-Review Notes

- **Couverture du spec** : `targetPlan` optionnel sur `/api/stripe/portal`
  ✓ (Task 1 Step 1), périodicité dérivée côté serveur via
  `resolvePriceId()` jamais du client ✓ (Task 1 Step 1), `flow_data`
  `subscription_update_confirm` ✓ (Task 1 Step 1), handler
  `customer.subscription.updated` gardé par `previous_attributes.items`
  ✓ (Task 1 Step 2), crédits appliqués immédiatement via `creditsFor()`
  ✓ (Task 1 Step 2), prop `targetPlan` sur `ManageSubscriptionButton` avec
  libellé conditionnel ✓ (Task 2 Step 1), carte non courante utilise
  `targetPlan={plan.id}` ✓ (Task 2 Step 2), comportement inchangé sans
  `targetPlan` (compte + carte courante) ✓ (both tasks, noté
  explicitement).
- **Placeholders** : aucun — tout le code est complet et exécutable tel
  quel dans les deux tasks.
- **Cohérence des types** : `targetPlan?: PlanId` a la même forme dans
  `ManageSubscriptionButton` (Task 2) et dans le body JSON envoyé/lu par
  `/api/stripe/portal` (Task 1, `PortalBody.targetPlan?: string` — casté
  en `PlanId` après validation contre `PLANS`). Pas de dérive de nom entre
  les deux tasks.
- **Étape manuelle Stripe** : rappelée dans Task 2 Step 5 comme condition
  de la vérification manuelle, et déjà documentée dans le spec comme
  prérequis de mise en production — pas oubliée.
