import PricingGrid, { type PlanFeature } from "@/components/PricingGrid";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

const PLAN_ORDER: PlanId[] = ["decouverte", "essentiel", "ultimate"];

const PLAN_FEATURES: Record<PlanId, PlanFeature[]> = {
  decouverte: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité photo 1K" },
    { text: "Photo de référence optionnelle" },
    { text: "Historique complet" },
  ],
  essentiel: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité photo 2K", bold: true },
    { text: "Photo de référence optionnelle" },
    { text: "Historique complet" },
    { text: "Support prioritaire" },
  ],
  ultimate: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité photo 4K Ultra-détails", bold: true },
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
          Des crédits simples, pour créer sans limite ta vie de rêve.
        </h2>
      </div>

      <PricingGrid plans={plans} currentPlan={currentPlan} isLoggedIn={!!user} />
    </div>
  );
}
