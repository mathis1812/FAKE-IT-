import PricingGrid from "@/components/PricingGrid";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

const PLAN_ORDER: PlanId[] = ["decouverte", "essentiel", "ultimate"];

const PLAN_FEATURES: Record<PlanId, string[]> = {
  decouverte: [
    "Génération photo & vidéo",
    "Photo de référence optionnelle",
    "Historique complet",
  ],
  essentiel: [
    "Génération photo & vidéo",
    "Photo de référence optionnelle",
    "Historique complet",
    "Support prioritaire",
  ],
  ultimate: [
    "Génération photo & vidéo",
    "Photo de référence optionnelle",
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
