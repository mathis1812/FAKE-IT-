// Vérification en lecture seule des six price IDs venant d'être écrits
// dans .env.local : confirme qu'ils existent bien côté Stripe, avec le bon
// montant et le bon mode (récurrent hebdomadaire pour les paliers, unique
// pour les packs), avant de faire confiance à la config sans avoir jamais
// vérifié l'API elle-même.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const content = readFileSync(envPath, "utf8");

function readEnvValue(name) {
  const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : "";
}

const stripe = new Stripe(readEnvValue("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-07-29.dahlia",
});

const expected = [
  { envVar: "STRIPE_PRICE_LITE", usd: 4.99, recurring: "week" },
  { envVar: "STRIPE_PRICE_PRO", usd: 9.99, recurring: "week" },
  { envVar: "STRIPE_PRICE_MAX", usd: 19.99, recurring: "week" },
  { envVar: "STRIPE_PRICE_TOPUP_SMALL", usd: 7.99, recurring: null },
  { envVar: "STRIPE_PRICE_TOPUP_MEDIUM", usd: 14.99, recurring: null },
  { envVar: "STRIPE_PRICE_TOPUP_LARGE", usd: 29.99, recurring: null },
];

let allOk = true;
for (const item of expected) {
  const priceId = readEnvValue(item.envVar);
  if (!priceId) {
    console.log(`${item.envVar}: MISSING from .env.local`);
    allOk = false;
    continue;
  }
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const amountOk = price.unit_amount === Math.round(item.usd * 100);
  const recurringOk = item.recurring
    ? price.recurring?.interval === item.recurring
    : price.recurring === null;
  const ok = amountOk && recurringOk && price.active;
  if (!ok) allOk = false;
  console.log(
    `${item.envVar}: ${ok ? "OK" : "MISMATCH"} — product="${price.product.name}" amount=$${(price.unit_amount / 100).toFixed(2)} recurring=${price.recurring?.interval ?? "one-time"} active=${price.active}`,
  );
}

console.log(allOk ? "\nAll six prices verified against the Stripe API." : "\nSome prices did not match — see above.");
process.exit(allOk ? 0 : 1);
