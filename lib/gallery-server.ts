import sharp from "sharp";
import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "gallery";

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  const subtype = mimeType.split("/")[1];
  return subtype && /^[a-z0-9]+$/i.test(subtype) ? subtype : "png";
}

/**
 * Qualité JPEG de livraison. Mesuré sur un rendu réel de 2390×1792 : le PNG
 * RGBA de Gemini pèse 8,17 Mo, le même en q95 sans sous-échantillonnage
 * chroma pèse 1,35 Mo — six fois moins, sans perte visible, y compris sur
 * les aplats de couleur saturée (feux arrière, néons) que le 4:2:0 salit.
 */
const JPEG_QUALITY = 95;

/**
 * Convertit le rendu du fournisseur en JPEG de livraison.
 *
 * Gemini renvoie du PNG RGBA : sans perte, mais avec un canal alpha
 * entièrement opaque et un poids cinq à six fois supérieur à ce que le
 * produit a besoin de servir. Chaque génération stockée coûtait ~8 Mo de
 * Storage, et autant à télécharger sur mobile à chaque affichage.
 *
 * BEST-EFFORT : une conversion qui échoue renvoie les octets d'origine
 * inchangés. Une génération déjà payée par le client ne doit jamais être
 * perdue pour un problème d'encodage — mieux vaut un fichier lourd qu'un
 * crédit débité sans résultat.
 */
export async function toDeliverableJpeg(
  bytes: Buffer,
  mimeType: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  if (mimeType === "image/jpeg") return { bytes, mimeType };

  try {
    const converted = await sharp(bytes)
      // Aplatit l'alpha : le rendu est opaque, le canal ne porte rien.
      .flatten({ background: "#000000" })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true,
        chromaSubsampling: "4:4:4",
      })
      .toBuffer();
    return { bytes: converted, mimeType: "image/jpeg" };
  } catch (err) {
    console.error("JPEG conversion failed, keeping the original bytes:", err);
    return { bytes, mimeType };
  }
}

/**
 * Uploade des octets d'image déjà en mémoire vers notre bucket Storage et
 * enregistre l'entrée de galerie. Renvoie l'URL permanente à
 * afficher/stocker. Utilisé directement par les fournisseurs qui renvoient
 * l'image en base64 (ex. l'API Gemini directe) plutôt qu'une URL à
 * télécharger.
 */
export async function persistImageBytes(
  userId: string,
  bytes: Buffer,
  mimeType: string,
  label: string,
): Promise<string> {
  const service = createServiceClient();
  const delivered = await toDeliverableJpeg(bytes, mimeType);
  const path = `${userId}/${crypto.randomUUID()}.${extensionForMimeType(delivered.mimeType)}`;

  const { error: uploadError } = await service.storage
    .from(BUCKET)
    .upload(path, delivered.bytes, { contentType: delivered.mimeType });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = service.storage.from(BUCKET).getPublicUrl(path);

  const { error: insertError } = await service.from("gallery_entries").insert({
    user_id: userId,
    mode: "image",
    result_url: publicUrl,
    label,
  });
  if (insertError) throw insertError;

  return publicUrl;
}

/**
 * fal.ai ne sert la vidéo générée que depuis une URL temporaire, qui expire
 * au bout de quelques heures. Ce délai laisse ~50 s à l'ensemble
 * téléchargement + upload avant que la fonction Vercel n'atteigne son
 * `maxDuration` (le timeout de polling de la route est réduit en
 * conséquence).
 */
const VIDEO_FETCH_TIMEOUT_MS = 45_000;

/**
 * Télécharge la vidéo depuis l'URL temporaire du fournisseur, la réhéberge
 * durablement dans notre bucket Storage, puis enregistre l'entrée de
 * galerie. Renvoie l'URL à afficher et à stocker.
 *
 * Dégradation volontaire : si le ré-hébergement échoue, on retombe sur
 * l'URL temporaire du fournisseur plutôt que de perdre la génération —
 * l'utilisateur a déjà été débité, il doit récupérer sa vidéo même si
 * celle-ci finit par expirer. L'échec est journalisé, jamais renvoyé au
 * client.
 */
export async function persistVideoFromUrl(
  userId: string,
  videoUrl: string,
  label: string,
): Promise<string> {
  let permanentUrl: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIDEO_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(videoUrl, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      throw new Error(`Failed to download the video (${res.status}).`);
    }

    const mimeType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
    const bytes = Buffer.from(await res.arrayBuffer());

    const service = createServiceClient();
    const path = `${userId}/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`;
    const { error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mimeType });
    if (uploadError) throw uploadError;

    permanentUrl = service.storage.from(BUCKET).getPublicUrl(path).data
      .publicUrl;
  } catch (err) {
    console.error(
      "Unable to re-host the video, falling back to the provider's temporary URL:",
      err,
    );
  }

  const finalUrl = permanentUrl ?? videoUrl;

  try {
    const service = createServiceClient();
    const { error } = await service.from("gallery_entries").insert({
      user_id: userId,
      mode: "video",
      result_url: finalUrl,
      label,
    });
    if (error) throw error;
  } catch (err) {
    console.error("Failed to save gallery entry (video):", err);
  }

  return finalUrl;
}
