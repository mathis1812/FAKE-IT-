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
    .select("stripe_customer_id, plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan) {
    return NextResponse.json(
      {
        error:
          "Tu as déjà un abonnement actif. Gère ton palier depuis le portail d'abonnement.",
      },
      { status: 400 },
    );
  }

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
