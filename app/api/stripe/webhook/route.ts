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
