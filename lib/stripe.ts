import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-07-29.dahlia",
});

export type PlanId = "decouverte" | "essentiel" | "ultimate";

export const PLANS: Record<
  PlanId,
  { name: string; priceId: string; priceEur: number; credits: number }
> = {
  decouverte: {
    name: "Découverte",
    priceId: process.env.STRIPE_PRICE_DECOUVERTE!,
    priceEur: 9.9,
    credits: 2000,
  },
  essentiel: {
    name: "Essentiel",
    priceId: process.env.STRIPE_PRICE_ESSENTIEL!,
    priceEur: 19.9,
    credits: 5000,
  },
  ultimate: {
    name: "Ultimate",
    priceId: process.env.STRIPE_PRICE_ULTIMATE!,
    priceEur: 39.9,
    credits: 12000,
  },
};

export function planIdForPriceId(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  const entry = (Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).find(
    ([, plan]) => plan.priceId === priceId,
  );
  return entry ? entry[0] : null;
}
