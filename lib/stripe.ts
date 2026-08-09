import Stripe from "stripe";

// Toute valeur lue depuis l'environnement est nettoyée : un caractère invisible
// collé par erreur (BOM, espace, retour ligne) rend la clé invalide, et Stripe
// échoue alors sur une « erreur de connexion » impossible à diagnostiquer.
// Le BOM comptant comme un espace en JS, `.trim()` le supprime également.
export function envValue(name: string): string {
  return (process.env[name] ?? "").trim();
}

export const stripe = new Stripe(
  envValue("STRIPE_SECRET_KEY") || "sk_placeholder_missing_key",
  { apiVersion: "2026-07-29.dahlia" },
);

// Le SDK Stripe accepte silencieusement une clé absente/placeholder à la
// construction ; chaque route doit vérifier explicitement avant d'appeler
// l'API, pour renvoyer le même message clair que les autres clés (kie.ai)
// plutôt qu'une erreur Stripe "Invalid API Key" moins lisible.
export function isStripeConfigured(): boolean {
  return envValue("STRIPE_SECRET_KEY").length > 0;
}

export type PlanId = "decouverte" | "essentiel" | "ultimate";
export type BillingPeriod = "monthly" | "annual";
export type ImageResolution = "1K" | "2K" | "4K";

type PriceInfo = { priceId: string; priceEur: number };

export const PLANS: Record<
  PlanId,
  {
    name: string;
    monthly: PriceInfo;
    annual: PriceInfo;
    creditsPerMonth: number;
    imageResolution: ImageResolution;
  }
> = {
  decouverte: {
    name: "Découverte",
    monthly: { priceId: envValue("STRIPE_PRICE_DECOUVERTE"), priceEur: 9.9 },
    annual: {
      priceId: envValue("STRIPE_PRICE_DECOUVERTE_ANNUEL"),
      priceEur: 94.9,
    },
    creditsPerMonth: 2000,
    imageResolution: "1K",
  },
  essentiel: {
    name: "Essentiel",
    monthly: { priceId: envValue("STRIPE_PRICE_ESSENTIEL"), priceEur: 19.9 },
    annual: {
      priceId: envValue("STRIPE_PRICE_ESSENTIEL_ANNUEL"),
      priceEur: 190.9,
    },
    creditsPerMonth: 5000,
    imageResolution: "2K",
  },
  ultimate: {
    name: "Ultimate",
    monthly: { priceId: envValue("STRIPE_PRICE_ULTIMATE"), priceEur: 39.9 },
    annual: {
      priceId: envValue("STRIPE_PRICE_ULTIMATE_ANNUEL"),
      priceEur: 382.9,
    },
    creditsPerMonth: 12000,
    imageResolution: "4K",
  },
};

export function priceIdFor(planId: PlanId, period: BillingPeriod): string {
  return PLANS[planId][period].priceId;
}

// Facturation annuelle = un seul crédit d'un an d'un coup (le webhook ne
// reçoit qu'un événement de renouvellement par an pour ces abonnements-là,
// contre un par mois pour les abonnements mensuels).
export function creditsFor(planId: PlanId, period: BillingPeriod): number {
  const perMonth = PLANS[planId].creditsPerMonth;
  return period === "annual" ? perMonth * 12 : perMonth;
}

export function resolvePriceId(
  priceId: string | undefined,
): { planId: PlanId; period: BillingPeriod } | null {
  if (!priceId) return null;
  for (const [id, plan] of Object.entries(PLANS) as [
    PlanId,
    (typeof PLANS)[PlanId],
  ][]) {
    if (plan.monthly.priceId === priceId) return { planId: id, period: "monthly" };
    if (plan.annual.priceId === priceId) return { planId: id, period: "annual" };
  }
  return null;
}
