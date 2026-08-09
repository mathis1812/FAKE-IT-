import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "gallery";

function extensionForMimeType(mimeType: string): string {
  const subtype = mimeType.split("/")[1];
  return subtype && /^[a-z0-9]+$/i.test(subtype) ? subtype : "png";
}

/**
 * Télécharge un résultat image hébergé temporairement par kie.ai (les URLs
 * kie.ai expirent après ~24h), le réhéberge durablement dans notre bucket
 * Storage, et enregistre l'entrée de galerie. Renvoie l'URL permanente à
 * afficher/stocker. Si la persistance échoue, journalise l'erreur et
 * retombe sur l'URL source kie.ai plutôt que de faire échouer une
 * génération que l'utilisateur vient de payer.
 */
export async function persistImageResult(
  userId: string,
  sourceUrl: string,
  label: string,
): Promise<string> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      throw new Error(`Téléchargement du résultat échoué (${res.status}).`);
    }
    const mimeType = res.headers.get("content-type") || "image/png";
    const bytes = Buffer.from(await res.arrayBuffer());

    const service = createServiceClient();
    const path = `${userId}/${crypto.randomUUID()}.${extensionForMimeType(mimeType)}`;

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

    return publicUrl;
  } catch (err) {
    console.error("Échec de la persistance du résultat image en galerie :", err);
    return sourceUrl;
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
