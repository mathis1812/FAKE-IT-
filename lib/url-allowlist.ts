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
 * Hôtes légitimes, et ce sont les seuls endroits où l'application fait
 * héberger les fichiers qu'elle envoie ensuite aux fournisseurs :
 *  - l'hôte de l'API de fichiers kie.ai (`KIE_UPLOAD_URL` ci-dessous), utilisé
 *    par `app/api/kie/upload/route.ts` pour uploader les images ;
 *  - l'hôte de téléchargement kie.ai (`KIE_DOWNLOAD_HOSTNAME` ci-dessous),
 *    constaté empiriquement, qui sert réellement les fichiers uploadés ;
 *  - l'hôte du projet Supabase, dérivé de `NEXT_PUBLIC_SUPABASE_URL`, qui sert
 *    le bucket Storage `video-uploads` (upload direct navigateur → Supabase
 *    dans `app/page.tsx`) et le bucket `gallery`.
 */

/** Endpoint d'hébergement de fichiers kie.ai — source unique de vérité. */
export const KIE_UPLOAD_URL =
  "https://kieai.redpandaai.co/api/file-stream-upload";

/**
 * Hôte réel depuis lequel kie.ai sert les fichiers uploadés (le champ
 * `downloadUrl` renvoyé par `app/api/kie/upload/route.ts`), constaté
 * empiriquement lors d'un upload réel sur l'API kie.ai le 2026-08-19 : cet
 * hôte n'apparaît nulle part ailleurs dans le code, seul `downloadUrl` le
 * porte à l'exécution, et il diffère de l'hôte d'upload `KIE_UPLOAD_URL`.
 * Sans lui, `isAllowedAssetUrl` rejette `sourceImageUrl`, les
 * `placeImageUrls` et l'`objectImageUrl` du mode vidéo. À revérifier si
 * kie.ai change de CDN.
 */
export const KIE_DOWNLOAD_HOSTNAME = "tempfile.redpandaai.co";

export const DISALLOWED_ASSET_URL_MESSAGE =
  "URL de média non autorisée. Les fichiers doivent être uploadés via " +
  "l'application avant d'être utilisés.";

/**
 * Hôtes autorisés, recalculés à chaque appel : `NEXT_PUBLIC_SUPABASE_URL` est
 * lue à l'exécution et non figée au build.
 */
function allowedHostnames(): string[] {
  const hostnames = [new URL(KIE_UPLOAD_URL).hostname, KIE_DOWNLOAD_HOSTNAME];

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
