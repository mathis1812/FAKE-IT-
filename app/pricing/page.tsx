import PricingGrid, { type ComparisonRow } from "@/components/PricingGrid";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/stripe";

const PLAN_ORDER: PlanId[] = ["decouverte", "essentiel", "ultimate"];

const CHECK_ALL = {
  decouverte: { kind: "check" as const },
  essentiel: { kind: "check" as const },
  ultimate: { kind: "check" as const },
};

// Comparison grid: one row per benefit, one cell per tier.
// Numbers are derived from PLANS (never hardcoded) so they can never
// diverge from the price/resolution/credits actually billed.
const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Photo & video generation", ...CHECK_ALL },
  {
    label: "Photo quality",
    decouverte: { kind: "value", text: PLANS.decouverte.imageResolution },
    essentiel: {
      kind: "value",
      text: PLANS.essentiel.imageResolution,
      bold: true,
    },
    ultimate: {
      kind: "value",
      text: `${PLANS.ultimate.imageResolution} Ultra detail`,
      bold: true,
    },
  },
  {
    label: "Credits included",
    decouverte: {
      kind: "value",
      text: `${PLANS.decouverte.creditsPerMonth.toLocaleString("en-US")}/mo`,
    },
    essentiel: {
      kind: "value",
      text: `${PLANS.essentiel.creditsPerMonth.toLocaleString("en-US")}/mo`,
    },
    ultimate: {
      kind: "value",
      text: `${PLANS.ultimate.creditsPerMonth.toLocaleString("en-US")}/mo`,
      bold: true,
    },
  },
  { label: "Optional reference photo", ...CHECK_ALL },
  { label: "Full history (Gallery)", ...CHECK_ALL },
  {
    label: "Priority support",
    decouverte: { kind: "cross" },
    essentiel: { kind: "check" },
    ultimate: { kind: "check" },
  },
  // Really restricted in the studio: `hasRedSnap` in app/page.tsx only
  // shows the button and tutorial for these two tiers. Changing this row
  // without changing that condition would make the grid misleading.
  {
    label: "Red Snap (undetectable send)",
    decouverte: { kind: "cross" },
    essentiel: { kind: "check" },
    ultimate: { kind: "check" },
  },
];

export default async function PricingPage() {
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
    monthlyPriceUsd: PLANS[planId].monthly.priceUsd,
    annualPriceUsd: PLANS[planId].annual.priceUsd,
    creditsPerMonth: PLANS[planId].creditsPerMonth,
  }));

  return (
    <div className="animate-fade-up mx-auto max-w-5xl py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Pricing
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Simple credits, to create your dream life without limits.
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
