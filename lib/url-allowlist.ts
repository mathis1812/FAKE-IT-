/**
 * Liste blanche des hôtes depuis lesquels nos routes serveur acceptent de
 * télécharger un média désigné par le client.
 *
 * Depuis la bascule vers l'API Gemini directe, c'est notre fonction Vercel
 * qui télécharge les images de référence (`lib/gemini-jobs.ts`), là où kie.ai
 * les récupérait auparavant depuis son propre réseau. Sans contrôle, le corps
 * de la requête permettrait donc de faire émettre à notre serveur une requête
 * arbitraire (SSRF) : réseau interne, métadonnées cloud, ports non HTTP.
 *
 * Un seul hôte légitime depuis le 2026-09-03 : celui du projet Supabase,
 * dérivé de `NEXT_PUBLIC_SUPABASE_URL`. Il sert le bucket `photo-uploads`
 * (photos sources, upload direct navigateur → Supabase dans
 * `lib/studio-image.ts`), le bucket `video-uploads` et le bucket `gallery`.
 *
 * L'hébergeur tiers kie.ai a été retiré d'ici en même temps que du chemin
 * critique : ses deux hôtes (upload et CDN de téléchargement) n'ont plus
 * aucune raison d'être joignables par notre serveur, et la route
 * `app/api/kie/upload` qui les utilisait — sans aucun contrôle
 * d'authentification — a été supprimée.
 */

export const DISALLOWED_ASSET_URL_MESSAGE =
  "Media URL not allowed. Files must be uploaded through " +
  "the application before being used.";

/**
 * Hôtes autorisés, recalculés à chaque appel : `NEXT_PUBLIC_SUPABASE_URL` est
 * lue à l'exécution et non figée au build.
 */
function allowedHostnames(): string[] {
  const hostnames: string[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    try {
      hostnames.push(new URL(supabaseUrl).hostname);
    } catch {
      // URL Supabase mal formée : on ne l'ajoute pas plutôt que d'élargir la
      // liste blanche à l'aveugle.
    }
  }

  return hostnames;
}

/**
 * `true` uniquement si l'URL est en `https:` et pointe vers un hôte de la
 * liste blanche. Toute autre valeur (http, data:, file:, IP interne, hôte
 * inconnu, chaîne illisible) est rejetée.
 */
export function isAllowedAssetUrl(candidate: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  return allowedHostnames().includes(parsed.hostname);
}
