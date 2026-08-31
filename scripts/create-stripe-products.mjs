// Provisionne le catalogue Stripe (LITE/PRO/MAX + packs de crédits) en mode
// test, à partir des montants déjà en dur dans lib/stripe.ts — pas
// redéfinis ici, pour ne jamais diverger de ce que l'app affiche et facture.
//
// Usage : node scripts/create-stripe-products.mjs
// Lit STRIPE_SECRET_KEY depuis .env.local. Refuse de tourner sur une clé
// sk_live_ : ce script est fait pour amorcer le catalogue de test, pas pour
// créer des produits facturables en un coup de script.
//
// N'écrit rien automatiquement dans .env.local : imprime les six price IDs
// à la fin, à coller à la main — une clé Stripe copiée par erreur au
// mauvais endroit par un script est plus difficile à repérer qu'une ligne
// collée soi-même.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

function readEnvValue(name) {
  const content = readFileSync(envPath, "utf8");
  const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) return "";
  return line.slice(name.length + 1).trim();
}

const secretKey = readEnvValue("STRIPE_SECRET_KEY");
if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is empty in .env.local — nothing to do.");
  process.exit(1);
}
if (secretKey.startsWith("sk_live_")) {
  console.error(
    "Refusing to run against a live key (sk_live_...). This script is for " +
      "seeding the TEST catalogue. Switch .env.local to a sk_test_ key first.",
  );
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: "2026-07-29.dahlia" });

// Montants copiés de lib/stripe.ts (PLANS / TOPUPS) le 31/08 — toute
// divergence future doit être corrigée aux deux endroits.
const PLANS = [
  { envVar: "STRIPE_PRICE_LITE", name: "Bluminoo Lite", usd: 4.99 },
  { envVar: "STRIPE_PRICE_PRO", name: "Bluminoo Pro", usd: 9.99 },
  { envVar: "STRIPE_PRICE_MAX", name: "Bluminoo Max", usd: 19.99 },
];

const TOPUPS = [
  { envVar: "STRIPE_PRICE_TOPUP_SMALL", name: "Bluminoo Credits — Small", usd: 7.99 },
  { envVar: "STRIPE_PRICE_TOPUP_MEDIUM", name: "Bluminoo Credits — Medium", usd: 14.99 },
  { envVar: "STRIPE_PRICE_TOPUP_LARGE", name: "Bluminoo Credits — Large", usd: 29.99 },
];

async function createSubscriptionPrice({ name, usd }) {
  const product = await stripe.products.create({ name });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: Math.round(usd * 100),
    recurring: { interval: "week" },
  });
  return price.id;
}

async function createOneTimePrice({ name, usd }) {
  const product = await stripe.products.create({ name });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: Math.round(usd * 100),
  });
  return price.id;
}

const results = {};

for (const plan of PLANS) {
  process.stdout.write(`Creating ${plan.name} ($${plan.usd}/week)... `);
  results[plan.envVar] = await createSubscriptionPrice(plan);
  console.log(results[plan.envVar]);
}

for (const topup of TOPUPS) {
  process.stdout.write(`Creating ${topup.name} ($${topup.usd}, one-time)... `);
  results[topup.envVar] = await createOneTimePrice(topup);
  console.log(results[topup.envVar]);
}

console.log("\nDone. Paste these into .env.local:\n");
for (const [key, value] of Object.entries(results)) {
  console.log(`${key}=${value}`);
}
