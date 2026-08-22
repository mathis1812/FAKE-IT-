import PricingGrid, { type ComparisonRow } from "@/components/PricingGrid";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

const PLAN_ORDER: PlanId[] = ["decouverte", "essentiel", "ultimate"];

const CHECK_ALL = {
  decouverte: { kind: "check" as const },
  essentiel: { kind: "check" as const },
  ultimate: { kind: "check" as const },
};

// Grille comparative : une ligne par argument, une cellule par palier.
// Chiffres dérivés de PLANS (jamais recopiés en dur) pour ne jamais
// diverger du prix/de la résolution/des crédits réellement facturés.
const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Génération photo & vidéo", ...CHECK_ALL },
  {
    label: "Qualité photo",
    decouverte: { kind: "value", text: PLANS.decouverte.imageResolution },
    essentiel: {
      kind: "value",
      text: PLANS.essentiel.imageResolution,
      bold: true,
    },
    ultimate: {
      kind: "value",
      text: `${PLANS.ultimate.imageResolution} Ultra-détails`,
      bold: true,
    },
  },
  {
    label: "Crédits inclus",
    decouverte: {
      kind: "value",
      text: `${PLANS.decouverte.creditsPerMonth.toLocaleString("fr-FR")}/mois`,
    },
    essentiel: {
      kind: "value",
      text: `${PLANS.essentiel.creditsPerMonth.toLocaleString("fr-FR")}/mois`,
    },
    ultimate: {
      kind: "value",
      text: `${PLANS.ultimate.creditsPerMonth.toLocaleString("fr-FR")}/mois`,
      bold: true,
    },
  },
  { label: "Photo de référence optionnelle", ...CHECK_ALL },
  { label: "Historique complet (Galerie)", ...CHECK_ALL },
  {
    label: "Support prioritaire",
    decouverte: { kind: "cross" },
    essentiel: { kind: "check" },
    ultimate: { kind: "check" },
  },
  // Réellement restreint dans le studio : `hasSnapRouge` dans app/page.tsx
  // n'affiche le bouton et le tutoriel que pour ces deux paliers. Modifier
  // cette ligne sans modifier cette condition rendrait la grille mensongère.
  {
    label: "Snap Rouge (envoi indétectable)",
    decouverte: { kind: "cross" },
    essentiel: { kind: "check" },
    ultimate: { kind: "check" },
  },
];

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

      <PricingGrid
        plans={plans}
        comparisonRows={COMPARISON_ROWS}
        currentPlan={currentPlan}
        isLoggedIn={!!user}
      />
    </div>
  );
}
