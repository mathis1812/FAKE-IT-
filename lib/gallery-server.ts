import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "gallery";
// Court : le re-hébergement tourne en fire-and-forget après la réponse
// client ; au-delà, on tombe sur le fallback URL d'origine.
const VIDEO_REHOST_TIMEOUT_MS = 20_000;
const VIDEO_REHOST_MAX_BYTES = 40 * 1024 * 1024;

function extensionForMimeType(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split(";")[0]?.trim();
  return subtype && /^[a-z0-9]+$/i.test(subtype) ? subtype : "png";
}

function extensionForVideo(contentType: string, sourceUrl: string): string {
  const subtype = contentType.split("/")[1]?.split(";")[0]?.trim().toLowerCase();
  if (subtype === "webm") return "webm";
  if (subtype === "quicktime") return "mov";
  if (subtype === "mp4" || subtype === "mpeg") return "mp4";

  const path = sourceUrl.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".webm")) return "webm";
  if (path.endsWith(".mov")) return "mov";
  return "mp4";
}

/**
 * Télécharge une vidéo distante et l'uploade dans le bucket Storage.
 * Renvoie l'URL publique Supabase, ou `null` si le re-hébergement échoue
 * (la galerie pourra alors conserver l'URL d'origine en fallback).
 */
async function rehostVideo(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  videoUrl: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VIDEO_REHOST_TIMEOUT_MS);

  try {
    const res = await fetch(videoUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} en téléchargeant la vidéo source.`);
    }

    const contentLength = Number(res.headers.get("content-length") ?? "0");
    if (contentLength > VIDEO_REHOST_MAX_BYTES) {
      throw new Error(
        `Vidéo trop volumineuse pour le re-hébergement (${contentLength} octets).`,
      );
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new Error("Vidéo source vide.");
    }
    if (bytes.byteLength > VIDEO_REHOST_MAX_BYTES) {
      throw new Error(
        `Vidéo trop volumineuse pour le re-hébergement (${bytes.byteLength} octets).`,
      );
    }

    const contentType = res.headers.get("content-type") || "video/mp4";
    const path = `${userId}/${crypto.randomUUID()}.${extensionForVideo(contentType, videoUrl)}`;

    const { error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: contentType.startsWith("video/")
          ? contentType
          : "video/mp4",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = service.storage.from(BUCKET).getPublicUrl(path);

    return publicUrl;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Upload une image générée (base64) dans le bucket Storage et enregistre une
 * entrée de galerie. Best-effort : une erreur est journalisée mais ne fait
 * jamais échouer la génération elle-même (la galerie est secondaire).
 */
export async function saveImageGalleryEntry(
  userId: string,
  imageBase64: string,
  mimeType: string,
  label: string,
): Promise<void> {
  try {
    const service = createServiceClient();
    const path = `${userId}/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`;
    const bytes = Buffer.from(imageBase64, "base64");

    const { error: uploadError } = await service.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: mimeType });
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
  } catch (err) {
    console.error("Échec de l'enregistrement en galerie (image) :", err);
  }
}

/**
 * Re-héberge la vidéo générée dans Supabase Storage puis enregistre l'entrée
 * de galerie. Si le re-hébergement échoue, fallback sur l'URL d'origine
 * (kie.ai) pour ne pas perdre l'historique. Best-effort.
 */
export async function saveVideoGalleryEntry(
  userId: string,
  videoUrl: string,
  label: string,
): Promise<void> {
  try {
    const service = createServiceClient();
    let resultUrl = videoUrl;

    try {
      const hostedUrl = await rehostVideo(service, userId, videoUrl);
      if (hostedUrl) {
        resultUrl = hostedUrl;
      } else {
        console.error(
          "Re-hébergement vidéo : URL Supabase absente, fallback URL d'origine.",
        );
      }
    } catch (rehostErr) {
      console.error(
        "Échec du re-hébergement vidéo, URL d'origine conservée :",
        rehostErr,
      );
    }

    const { error } = await service.from("gallery_entries").insert({
      user_id: userId,
      mode: "video",
      result_url: resultUrl,
      label,
    });
    if (error) throw error;
  } catch (err) {
    console.error("Échec de l'enregistrement en galerie (vidéo) :", err);
  }
}
