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

export type PlanId = "decouverte" | "essentiel" | "ultimate";

export const PLANS: Record<
  PlanId,
  { name: string; priceId: string; priceEur: number; credits: number }
> = {
  decouverte: {
    name: "Découverte",
    priceId: envValue("STRIPE_PRICE_DECOUVERTE"),
    priceEur: 9.9,
    credits: 2000,
  },
  essentiel: {
    name: "Essentiel",
    priceId: envValue("STRIPE_PRICE_ESSENTIEL"),
    priceEur: 19.9,
    credits: 5000,
  },
  ultimate: {
    name: "Ultimate",
    priceId: envValue("STRIPE_PRICE_ULTIMATE"),
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
