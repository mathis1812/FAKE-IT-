import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  stripe,
  PLANS,
  TOPUPS,
  priceIdFor,
  isStripeConfigured,
  type PlanId,
  type TopupId,
} from "@/lib/stripe";

export const runtime = "nodejs";

type CheckoutBody = { kind?: string; plan?: string; pack?: string };

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
      { error: "Sign in to continue." },
      { status: 401 },
    );
  }

  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request: unreadable JSON body." },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, plan")
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
      const message = err instanceof Error ? err.message : "Stripe error.";
      return NextResponse.json(
        { error: `Unable to create the Stripe customer. ${message}` },
        { status: 502 },
      );
    }
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  // Pack de crédits à l'unité : paiement unique, indépendant d'un
  // abonnement — un client sans abonnement, ou déjà abonné, peut en
  // acheter un, donc pas de garde sur profile.plan ici.
  if (body.kind === "topup") {
    const packId = body.pack as TopupId | undefined;
    if (!packId || !(packId in TOPUPS)) {
      return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: customerId,
        line_items: [{ price: TOPUPS[packId].priceId, quantity: 1 }],
        success_url: `${origin}/account?topup=success`,
        cancel_url: `${origin}/pricing`,
        metadata: { supabase_user_id: user.id, topup: packId },
      });
      return NextResponse.json({ url: session.url });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error.";
      return NextResponse.json(
        { error: `Unable to create the payment session. ${message}` },
        { status: 502 },
      );
    }
  }

  const planId = body.plan as PlanId | undefined;
  if (!planId || !(planId in PLANS)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  if (profile?.plan) {
    return NextResponse.json(
      {
        error:
          "You already have an active subscription. Manage your plan from the subscription portal.",
      },
      { status: 400 },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceIdFor(planId), quantity: 1 }],
      success_url: `${origin}/account?checkout=success`,
      cancel_url: `${origin}/pricing`,
      metadata: { supabase_user_id: user.id, plan: planId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    return NextResponse.json(
      { error: `Unable to create the payment session. ${message}` },
      { status: 502 },
    );
  }
}
