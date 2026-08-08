import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "gallery";

function extensionForMimeType(mimeType: string): string {
  const subtype = mimeType.split("/")[1];
  return subtype && /^[a-z0-9]+$/i.test(subtype) ? subtype : "png";
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
 * Enregistre une entrée de galerie pour une vidéo déjà hébergée par kie.ai
 * (pas de re-upload). Best-effort, mêmes garanties que ci-dessus.
 */
export async function saveVideoGalleryEntry(
  userId: string,
  videoUrl: string,
  label: string,
): Promise<void> {
  try {
    const service = createServiceClient();
    const { error } = await service.from("gallery_entries").insert({
      user_id: userId,
      mode: "video",
      result_url: videoUrl,
      label,
    });
    if (error) throw error;
  } catch (err) {
    console.error("Échec de l'enregistrement en galerie (vidéo) :", err);
  }
}
