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

type PriceInfo = { priceId: string; priceUsd: number };

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
    name: "Starter",
    monthly: { priceId: envValue("STRIPE_PRICE_DECOUVERTE"), priceUsd: 9.99 },
    annual: {
      priceId: envValue("STRIPE_PRICE_DECOUVERTE_ANNUEL"),
      priceUsd: 95.9,
    },
    creditsPerMonth: 2000,
    imageResolution: "1K",
  },
  essentiel: {
    name: "Essential",
    monthly: { priceId: envValue("STRIPE_PRICE_ESSENTIEL"), priceUsd: 19.99 },
    annual: {
      priceId: envValue("STRIPE_PRICE_ESSENTIEL_ANNUEL"),
      priceUsd: 191.9,
    },
    creditsPerMonth: 5000,
    imageResolution: "2K",
  },
  ultimate: {
    name: "Ultimate",
    monthly: { priceId: envValue("STRIPE_PRICE_ULTIMATE"), priceUsd: 39.99 },
    annual: {
      priceId: envValue("STRIPE_PRICE_ULTIMATE_ANNUEL"),
      priceUsd: 383.9,
    },
    creditsPerMonth: 12000,
    imageResolution: "4K",
  },
};

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

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

// Les abonnés souscrits en euros avant la bascule vers le marché anglophone
// conservent leurs anciens price IDs. Sans ce repli, leur événement de
// renouvellement ne serait plus associé à un palier et ils paieraient sans
// recevoir de crédits.
const LEGACY_PRICE_IDS: {
  priceId: string;
  planId: PlanId;
  period: BillingPeriod;
}[] = [
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_DECOUVERTE"),
    planId: "decouverte",
    period: "monthly",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_DECOUVERTE_ANNUEL"),
    planId: "decouverte",
    period: "annual",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_ESSENTIEL"),
    planId: "essentiel",
    period: "monthly",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_ESSENTIEL_ANNUEL"),
    planId: "essentiel",
    period: "annual",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_ULTIMATE"),
    planId: "ultimate",
    period: "monthly",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_ULTIMATE_ANNUEL"),
    planId: "ultimate",
    period: "annual",
  },
].filter((entry) => entry.priceId.length > 0) as Array<{
  priceId: string;
  planId: PlanId;
  period: BillingPeriod;
}>;

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
  const legacy = LEGACY_PRICE_IDS.find((entry) => entry.priceId === priceId);
  if (legacy) return { planId: legacy.planId, period: legacy.period };

  return null;
}
