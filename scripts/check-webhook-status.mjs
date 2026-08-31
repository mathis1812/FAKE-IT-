// Diagnostic ponctuel : liste les derniers événements checkout.session.completed
// et les endpoints webhook configurés côté Stripe, pour vérifier si un
// paiement de test a bien déclenché une livraison de webhook — pas
// destiné à rester dans le dépôt comme outil permanent, juste pour ce
// diagnostic du 31/08 (voir le paiement de test d'un pack de crédits).
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

const events = await stripe.events.list({
  type: "checkout.session.completed",
  limit: 3,
});
console.log("--- recent checkout.session.completed events ---");
for (const ev of events.data) {
  console.log(
    ev.id,
    new Date(ev.created * 1000).toISOString(),
    ev.data.object.id,
    JSON.stringify(ev.data.object.metadata),
  );
}

console.log("\n--- webhook endpoints ---");
const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });
for (const ep of endpoints.data) {
  console.log(ep.id, ep.url, ep.status);
}

console.log("\n--- pending_webhooks for the two test topup events ---");
for (const id of ["evt_1UAReUDgjrSCFI3Ac8fnpdZ3", "evt_1UARa1DgjrSCFI3ATGfu4fEu"]) {
  const ev = await stripe.events.retrieve(id);
  console.log(id, "pending_webhooks:", ev.pending_webhooks);
}
