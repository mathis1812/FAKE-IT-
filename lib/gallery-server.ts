import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "gallery";

function extensionForMimeType(mimeType: string): string {
  const subtype = mimeType.split("/")[1];
  return subtype && /^[a-z0-9]+$/i.test(subtype) ? subtype : "png";
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
}

/**
 * Enregistre une entrée de galerie pour une vidéo déjà hébergée par fal.ai
 * (pas de re-upload). Best-effort : contrairement à persistImageBytes, qui
 * réhéberge durablement l'image dans Supabase Storage, ceci ne stocke que
 * l'URL fal.ai telle quelle — elle est temporaire et finira par expirer.
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
