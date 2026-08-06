# Stripe + Page Tarifs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe subscriptions (Checkout + Customer Portal + webhook) to Bluminoo Studio and replace the static `/tarifs` placeholder with a real 3-tier pricing grid wired to it.

**Architecture:** A single `lib/stripe.ts` module is the source of truth for plan→price/credits mapping, consumed by two thin API routes (checkout session creation, billing portal session creation) and one webhook route that is the only writer of Stripe-related `profiles` columns (via a new service-role Supabase client). Two small client components trigger the two routes and redirect to the URL they return. The pricing page is a Server Component that reads the user's current plan and renders accordingly.

**Tech Stack:** Next.js 14 App Router, TypeScript, `stripe` npm package, `@supabase/supabase-js` (service-role client), existing `@supabase/ssr` session client.

## Global Constraints

- Git identity on this machine: every commit MUST use
  `git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "..."`.
- No test framework in this project. Verification is
  `npx tsc --noEmit -p tsconfig.json` (expect zero errors) plus the
  manual checks named in each task.
- None of `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_DECOUVERTE`, `STRIPE_PRICE_ESSENTIEL`,
  `STRIPE_PRICE_ULTIMATE` exist locally or in Vercel yet. Code must
  typecheck and be reviewable without these values existing; real
  end-to-end testing happens later, after the 3 Stripe products/prices
  and env vars are set up.
- Plan values (source of truth): Découverte 9,90 €/mois, 2 000 crédits ;
  Essentiel 19,90 €/mois, 5 000 crédits ; Ultimate 39,90 €/mois,
  12 000 crédits (plafonné, pas d'illimité).
- Renewal behavior: `invoice.paid` (cycle renewal) **resets** `credits`
  to the plan's amount — never adds/accumulates.
- `customer.subscription.deleted` sets `plan = null` and
  `stripe_subscription_id = null` but does NOT touch `credits`.
- All writes to `profiles` for Stripe-related fields go through a
  service-role Supabase client (`lib/supabase/service.ts`, new in this
  plan) — never through the session-scoped client.
- No annual billing in this plan — visual toggle only, disabled with
  "Bientôt disponible".
- Historical spec/plan files are a frozen record — never edited
  retroactively.

---

### Task 1: Migration SQL — champs Stripe sur `profiles`

**Files:**
- Create: `supabase/migrations/0002_add_stripe_fields.sql`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: (schema only) `profiles` gains `stripe_customer_id text`,
  `stripe_subscription_id text`, `plan text` (constrained to
  `'decouverte' | 'essentiel' | 'ultimate'`), `current_period_end
  timestamptz`. All later tasks assume these exact names/values.

- [ ] **Step 1: Write the migration file**

  ```sql
  alter table public.profiles
    add column stripe_customer_id text,
    add column stripe_subscription_id text,
    add column plan text check (plan in ('decouverte', 'essentiel', 'ultimate')),
    add column current_period_end timestamptz;
  ```

  No RLS policy changes — the existing `select` policy on `profiles`
  already covers reading these columns for their owner; still no
  `insert`/`update` policy for `authenticated` (writes only via
  service-role).

- [ ] **Step 2: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add supabase/migrations/0002_add_stripe_fields.sql
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: migration Supabase pour les champs Stripe (profiles)"
  ```

  Note in your report: not applied to any real database in this task —
  applying it is a manual step for the user, outside this plan.

---

### Task 2: Client Stripe + configuration des paliers + client Supabase service-role

**Files:**
- Create: `lib/stripe.ts`
- Create: `lib/supabase/service.ts`
- Modify: `package.json` (add `stripe` dependency via `npm install`)
- Modify: `.env.example`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (used by Tasks 3-6 — exact names, do not rename):
  - `lib/stripe.ts`: `stripe: Stripe`; `type PlanId = "decouverte" | "essentiel" | "ultimate"`;
    `PLANS: Record<PlanId, { name: string; priceId: string; priceEur: number; credits: number }>`;
    `function planIdForPriceId(priceId: string | undefined): PlanId | null`.
  - `lib/supabase/service.ts`: `function createServiceClient(): SupabaseClient`.

- [ ] **Step 1: Install the Stripe SDK**

  ```bash
  npm install stripe
  ```

- [ ] **Step 2: Create `lib/stripe.ts`**

  ```ts
  import Stripe from "stripe";

  export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-06-20",
  });

  export type PlanId = "decouverte" | "essentiel" | "ultimate";

  export const PLANS: Record<
    PlanId,
    { name: string; priceId: string; priceEur: number; credits: number }
  > = {
    decouverte: {
      name: "Découverte",
      priceId: process.env.STRIPE_PRICE_DECOUVERTE!,
      priceEur: 9.9,
      credits: 2000,
    },
    essentiel: {
      name: "Essentiel",
      priceId: process.env.STRIPE_PRICE_ESSENTIEL!,
      priceEur: 19.9,
      credits: 5000,
    },
    ultimate: {
      name: "Ultimate",
      priceId: process.env.STRIPE_PRICE_ULTIMATE!,
      priceEur: 39.9,
      credits: 12000,
    },
  };

  export function planIdForPriceId(priceId: string | undefined): PlanId | null {
    if (!priceId) return null;
    const entry = (Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).find(
      ([, plan]) => plan.priceId === priceId,
    );
    return entry ? entry[0] : null;
  }
  ```

- [ ] **Step 3: Create `lib/supabase/service.ts`**

  ```ts
  import { createClient } from "@supabase/supabase-js";

  export function createServiceClient() {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  ```

  Deliberately separate from `lib/supabase/server.ts` (anon key +
  cookies) — this client never touches cookies and must never act "as"
  the visiting user.

- [ ] **Step 4: Update `.env.example`**

  Add these 5 lines at the end:

  ```
  STRIPE_SECRET_KEY=
  STRIPE_WEBHOOK_SECRET=
  STRIPE_PRICE_DECOUVERTE=
  STRIPE_PRICE_ESSENTIEL=
  STRIPE_PRICE_ULTIMATE=
  ```

- [ ] **Step 5: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json` — expect no output, exit 0.

- [ ] **Step 6: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add package.json package-lock.json lib/stripe.ts lib/supabase/service.ts .env.example
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: ajouter le client Stripe, la config des paliers et le client Supabase service-role"
  ```

---

### Task 3: Routes checkout + portail

**Files:**
- Create: `app/api/stripe/checkout/route.ts`
- Create: `app/api/stripe/portal/route.ts`

**Interfaces:**
- Consumes: `stripe`, `PLANS`, `type PlanId` from `lib/stripe.ts` (Task 2);
  `createClient` from `lib/supabase/server.ts` (existing).
- Produces: `POST /api/stripe/checkout` — body `{ plan: PlanId }` →
  `{ url }` or `{ error }` (401/400/502). `POST /api/stripe/portal` — no
  body → `{ url }` or `{ error }` (401/400/502). Both consumed by Task 5.

- [ ] **Step 1: Create `app/api/stripe/checkout/route.ts`**

  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";
  import { stripe, PLANS, type PlanId } from "@/lib/stripe";

  export const runtime = "nodejs";

  type CheckoutBody = { plan?: string };

  export async function POST(req: NextRequest) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Connecte-toi pour t'abonner." },
        { status: 401 },
      );
    }

    let body: CheckoutBody;
    try {
      body = (await req.json()) as CheckoutBody;
    } catch {
      return NextResponse.json(
        { error: "Requête invalide : corps JSON illisible." },
        { status: 400 },
      );
    }

    const planId = body.plan as PlanId | undefined;
    if (!planId || !(planId in PLANS)) {
      return NextResponse.json({ error: "Palier inconnu." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id as string | null | undefined;

    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur Stripe.";
        return NextResponse.json(
          { error: `Impossible de créer le client Stripe. ${message}` },
          { status: 502 },
        );
      }
    }

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: PLANS[planId].priceId, quantity: 1 }],
        success_url: `${origin}/compte?checkout=success`,
        cancel_url: `${origin}/tarifs`,
        metadata: { supabase_user_id: user.id, plan: planId },
      });

      return NextResponse.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur Stripe.";
      return NextResponse.json(
        { error: `Impossible de créer la session de paiement. ${message}` },
        { status: 502 },
      );
    }
  }
  ```

- [ ] **Step 2: Create `app/api/stripe/portal/route.ts`**

  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import { createClient } from "@/lib/supabase/server";
  import { stripe } from "@/lib/stripe";

  export const runtime = "nodejs";

  export async function POST(req: NextRequest) {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Aucun abonnement actif." },
        { status: 400 },
      );
    }

    const origin = req.headers.get("origin") ?? new URL(req.url).origin;

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id as string,
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
  ```

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json` — expect no output, exit 0.

- [ ] **Step 4: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/api/stripe/checkout/route.ts app/api/stripe/portal/route.ts
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: ajouter les routes checkout et portail Stripe"
  ```

---

### Task 4: Webhook Stripe

**Files:**
- Create: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `stripe`, `PLANS`, `planIdForPriceId` from `lib/stripe.ts`
  (Task 2); `createServiceClient` from `lib/supabase/service.ts`
  (Task 2); reads `metadata.supabase_user_id`/`metadata.plan` set by
  Task 3's checkout route.
- Produces: `POST /api/stripe/webhook` (Stripe calls this directly).

- [ ] **Step 1: Create `app/api/stripe/webhook/route.ts`**

  ```ts
  import { NextRequest, NextResponse } from "next/server";
  import Stripe from "stripe";
  import { stripe, PLANS, planIdForPriceId } from "@/lib/stripe";
  import { createServiceClient } from "@/lib/supabase/service";

  export const runtime = "nodejs";

  export async function POST(req: NextRequest) {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const planId = session.metadata?.plan as keyof typeof PLANS | undefined;

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
          currentPeriodEnd = new Date(
            subscription.current_period_end * 1000,
          ).toISOString();
        }

        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId ?? null,
            stripe_subscription_id: subscriptionId ?? null,
            plan: planId,
            credits: PLANS[planId].credits,
            current_period_end: currentPeriodEnd,
          })
          .eq("id", userId);
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;

      if (invoice.billing_reason === "subscription_cycle") {
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const planId = planIdForPriceId(priceId);

          if (planId) {
            await supabase
              .from("profiles")
              .update({
                credits: PLANS[planId].credits,
                current_period_end: new Date(
                  subscription.current_period_end * 1000,
                ).toISOString(),
              })
              .eq("stripe_subscription_id", subscriptionId);
          }
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from("profiles")
        .update({ plan: null, stripe_subscription_id: null })
        .eq("stripe_subscription_id", subscription.id);
    }

    return NextResponse.json({ received: true });
  }
  ```

  Note: unhandled event types fall through to `NextResponse.json({ received: true })`
  with 200 — intentional, Stripe must receive 2xx for every event or it
  keeps retrying.

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json` — expect no output, exit 0.

- [ ] **Step 3: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/api/stripe/webhook/route.ts
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: ajouter le webhook Stripe (checkout, renouvellement, annulation)"
  ```

---

### Task 5: Boutons S'abonner et Gérer mon abonnement

**Files:**
- Create: `components/SubscribeButton.tsx`
- Create: `components/ManageSubscriptionButton.tsx`

**Interfaces:**
- Consumes: `type PlanId` from `lib/stripe.ts` (Task 2); calls
  `POST /api/stripe/checkout` and `POST /api/stripe/portal` (Task 3).
- Produces: `<SubscribeButton plan={PlanId} isLoggedIn={boolean} />` and
  `<ManageSubscriptionButton />`, consumed by Task 6.

- [ ] **Step 1: Create `components/SubscribeButton.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";
  import { useRouter } from "next/navigation";
  import type { PlanId } from "@/lib/stripe";

  export default function SubscribeButton({
    plan,
    isLoggedIn,
  }: {
    plan: PlanId;
    isLoggedIn: boolean;
  }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
      if (!isLoggedIn) {
        router.push("/connexion");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
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
      <div>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Redirection…" : "S'abonner"}
        </button>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
  ```

- [ ] **Step 2: Create `components/ManageSubscriptionButton.tsx`**

  ```tsx
  "use client";

  import { useState } from "react";

  export default function ManageSubscriptionButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleClick() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/stripe/portal", { method: "POST" });
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
          {loading ? "Redirection…" : "Gérer mon abonnement"}
        </button>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    );
  }
  ```

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json` — expect no output, exit 0.

- [ ] **Step 4: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add components/SubscribeButton.tsx components/ManageSubscriptionButton.tsx
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: ajouter les boutons S'abonner et Gérer mon abonnement"
  ```

---

### Task 6: Page Tarifs

**Files:**
- Modify: `app/tarifs/page.tsx` (replaces entire current content)

**Interfaces:**
- Consumes: `PLANS`, `type PlanId` from `lib/stripe.ts` (Task 2);
  `SubscribeButton`, `ManageSubscriptionButton` from Task 5;
  `createClient` from `lib/supabase/server.ts`; `Panel` from
  `@/components/Panel` (existing).
- Produces: the finished `/tarifs` route — no later task depends on it.

- [ ] **Step 1: Replace `app/tarifs/page.tsx`**

  ```tsx
  import Panel from "@/components/Panel";
  import SubscribeButton from "@/components/SubscribeButton";
  import ManageSubscriptionButton from "@/components/ManageSubscriptionButton";
  import { createClient } from "@/lib/supabase/server";
  import { PLANS, type PlanId } from "@/lib/stripe";

  const PLAN_ORDER: PlanId[] = ["decouverte", "essentiel", "ultimate"];

  const PLAN_FEATURES: Record<PlanId, string[]> = {
    decouverte: [
      "Génération photo & vidéo",
      "Presets Montre / Voiture / Lieu",
      "Historique complet",
    ],
    essentiel: [
      "Génération photo & vidéo",
      "Presets Montre / Voiture / Lieu",
      "Historique complet",
      "Support prioritaire",
    ],
    ultimate: [
      "Génération photo & vidéo",
      "Presets Montre / Voiture / Lieu",
      "Historique complet",
      "Support prioritaire",
      "12 000 crédits/mois (plafonné)",
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

    return (
      <div className="animate-fade-up mx-auto max-w-5xl py-8">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
            Tarifs
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
            Des tarifs simples, pensés pour créer sans limite.
          </h2>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 p-1 text-xs font-semibold uppercase tracking-[0.1em]">
            <span className="rounded-full bg-primary px-4 py-1.5 text-ink">
              Mensuel
            </span>
            <span className="cursor-not-allowed rounded-full px-4 py-1.5 text-neutral-600">
              Annuel · Bientôt disponible
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = currentPlan === planId;
            return (
              <Panel key={planId} className="flex flex-col p-6">
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
                <p className="mb-1 text-3xl font-semibold text-white">
                  {plan.priceEur.toFixed(2).replace(".", ",")} €
                  <span className="text-sm font-normal text-neutral-500">
                    /mois
                  </span>
                </p>
                <p className="mb-4 text-sm text-neutral-400">
                  {plan.credits.toLocaleString("fr-FR")} crédits/mois
                </p>
                <ul className="mb-6 flex-1 space-y-2.5 text-sm text-neutral-400">
                  {PLAN_FEATURES[planId].map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-medium text-neutral-500">
                    Ton palier actuel
                  </div>
                ) : (
                  <SubscribeButton plan={planId} isLoggedIn={!!user} />
                )}
              </Panel>
            );
          })}
        </div>

        {currentPlan && (
          <div className="mt-8">
            <ManageSubscriptionButton />
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json` — expect no output, exit 0.

- [ ] **Step 3: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/tarifs/page.tsx
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: page Tarifs branchée sur Stripe"
  ```
