// Ajoute des crédits à un compte, pour les tests internes.
//
// Usage : node scripts/grant-credits.mjs <email> [montant]
//   montant par défaut : 10000 crédits (~66 générations de gabarit à 150).
//
// Utilise la clé service_role de .env.local (même base que le dev local et
// le site déployé) et la fonction SQL refund_credits — l'incrémentation
// atomique déjà utilisée pour les remboursements et les packs achetés.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const content = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const readEnvValue = (name) => {
  const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : "";
};

const email = process.argv[2];
const amount = Number(process.argv[3] ?? 10000);
if (!email || !Number.isInteger(amount) || amount <= 0) {
  console.error("Usage: node scripts/grant-credits.mjs <email> [montant entier > 0]");
  process.exit(1);
}

const supabase = createClient(
  readEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
  readEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Retrouve l'utilisateur par email (pagination de l'API admin).
let userId = null;
for (let page = 1; page <= 20 && !userId; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("listUsers:", error.message);
    process.exit(1);
  }
  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (match) userId = match.id;
  if (data.users.length < 200) break;
}
if (!userId) {
  console.error(`Aucun compte pour ${email}`);
  process.exit(1);
}

const before = await supabase
  .from("profiles")
  .select("credits, plan")
  .eq("id", userId)
  .single();

const { error: rpcError } = await supabase.rpc("refund_credits", {
  p_user_id: userId,
  p_amount: amount,
});
if (rpcError) {
  console.error("refund_credits:", rpcError.message);
  process.exit(1);
}

const after = await supabase
  .from("profiles")
  .select("credits")
  .eq("id", userId)
  .single();

console.log({
  email,
  userId,
  plan: before.data?.plan ?? null,
  creditsAvant: before.data?.credits ?? null,
  ajout: amount,
  creditsApres: after.data?.credits ?? null,
});
