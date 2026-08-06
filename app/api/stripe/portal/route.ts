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
