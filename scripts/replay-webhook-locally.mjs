// Rejoue un événement Stripe RÉEL (déjà payé, récupéré via l'API) contre le
// webhook local — signé avec le même secret que app/api/stripe/webhook/
// route.ts vérifie, donc c'est un test honnête du code, pas une requête
// forgée qui contournerait la vérification de signature.
//
// Sert au diagnostic du 31/08 : le seul endpoint webhook configuré côté
// Stripe pointe vers le site déployé (pas localhost), donc le serveur de
// dev local ne reçoit jamais ces événements — ce script comble ce trou
// pour valider le code sans dépendre du déploiement.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const content = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
function readEnvValue(name) {
  const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : "";
}

const stripe = new Stripe(readEnvValue("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-07-29.dahlia",
});
const webhookSecret = readEnvValue("STRIPE_WEBHOOK_SECRET");

const eventId = process.argv[2];
if (!eventId) {
  console.error("Usage: node scripts/replay-webhook-locally.mjs <event_id>");
  process.exit(1);
}

const event = await stripe.events.retrieve(eventId);
const payload = JSON.stringify(event);
const header = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: webhookSecret,
});

const res = await fetch("http://localhost:3000/api/stripe/webhook", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "stripe-signature": header,
  },
  body: payload,
});

console.log("status:", res.status);
console.log(await res.text());
