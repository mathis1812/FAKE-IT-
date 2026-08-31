// Diagnostic ponctuel : lit directement le solde de crédits du profil dans
// Supabase (même base que le site déployé et le dev local), pour vérifier
// si le webhook livré à fakeit-delta.vercel.app a bien crédité le compte
// après le paiement de test du 31/08.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const content = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
function readEnvValue(name) {
  const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : "";
}

const supabase = createClient(
  readEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
  readEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
);

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: node scripts/check-profile-credits.mjs <user_id>");
  process.exit(1);
}

const { data, error } = await supabase
  .from("profiles")
  .select("credits, plan, stripe_customer_id, current_period_end")
  .eq("id", userId)
  .single();

if (error) {
  console.error("Error:", error);
  process.exit(1);
}
console.log(data);
