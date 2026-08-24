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
          "Missing API key. Set STRIPE_SECRET_KEY in your environment variables.",
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
      { error: "Sign in to manage your subscription." },
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
      { error: "Invalid request: unreadable JSON body." },
      { status: 400 },
    );
  }

  const targetPlan = body.targetPlan as PlanId | undefined;
  if (targetPlan && !(targetPlan in PLANS)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, plan")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No active subscription." },
      { status: 400 },
    );
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const customerId = profile.stripe_customer_id as string;

  if (!targetPlan) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/account`,
      });

      return NextResponse.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error.";
      return NextResponse.json(
        { error: `Unable to open the billing portal. ${message}` },
        { status: 502 },
      );
    }
  }

  const subscriptionId = profile.stripe_subscription_id as string | null;
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "No active subscription to change." },
      { status: 400 },
    );
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentItem = subscription.items.data[0];
    const resolved = resolvePriceId(currentItem?.price.id);
    if (!resolved) {
      console.error(
        `Unrecognized Stripe price (${currentItem?.price.id}) for subscription ${subscriptionId} of user ${user.id}.`,
      );
      return NextResponse.json(
        {
          error:
            "Unable to determine your current billing period. Contact support to change plans.",
        },
        { status: 500 },
      );
    }
    const targetPriceId = priceIdFor(targetPlan, resolved.period);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account?upgrade=success`,
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
    const message = err instanceof Error ? err.message : "Stripe error.";
    return NextResponse.json(
      { error: `Unable to open the plan change. ${message}` },
      { status: 502 },
    );
  }
}
