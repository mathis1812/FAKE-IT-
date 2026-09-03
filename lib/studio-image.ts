/**
 * Préparation et hébergement des photos déposées par l'utilisateur.
 *
 * Extrait de `app/page.tsx` le 27/08, quand les pages de gabarit ont eu
 * besoin du même parcours d'import : deux copies auraient fini par diverger
 * sur les seuils de compression ou les messages d'erreur.
 *
 * Ces fonctions s'exécutent dans le navigateur — elles manipulent `canvas`,
 * `FileReader` et `URL.createObjectURL`.
 */

import { createClient } from "@/lib/supabase/client";

export type PreparedImage = {
  previewUrl: string;
  base64: string;
  mimeType: string;
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Plafond de l'hébergeur d'uploads, appliqué après compression. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Paliers de ré-encodage, essayés dans l'ordre jusqu'à tenir sous
 * `MAX_UPLOAD_BYTES`. On ne descend en résolution qu'en dernier recours.
 *
 * Pourquoi 2560 en tête : les gabarits sortent en 2K, soit 2400 px de côté
 * long (`imageConfig.imageSize`, cf. app/api/generate/route.ts). Une entrée
 * plus PETITE que la sortie oblige gemini-3-pro-image à inventer le
 * micro-détail manquant — carrosserie lissée, matières « rendu 3D », grain
 * photo perdu. L'ancien plafond de 1536 px imposait cet upscale ×1,56 à
 * toute photo dépassant 2 Mo, c'est-à-dire à la quasi-totalité des photos de
 * téléphone. Garder une marge au-dessus de 2400 pour que le modèle réduise
 * toujours plutôt qu'il n'agrandisse.
 */
export const ENCODE_STEPS: { maxDimension: number; quality: number }[] = [
  { maxDimension: 2560, quality: 0.92 },
  { maxDimension: 2560, quality: 0.85 },
  { maxDimension: 2048, quality: 0.85 },
  { maxDimension: 1536, quality: 0.82 },
];

function stripDataUrlPrefix(dataUrl: string): {
  base64: string;
  mimeType: string;
} {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (match) {
    return { mimeType: match[1] || "image/jpeg", base64: match[2] };
  }
  return { mimeType: "image/jpeg", base64: dataUrl };
}

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read the file."));
    reader.readAsDataURL(file);
  });
}

/** Poids réel des octets encodés dans une data URL base64. */
export function dataUrlByteLength(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function encodeAtStep(
  img: HTMLImageElement,
  maxDimension: number,
  quality: number,
): string {
  const { width, height } = img;
  const longSide = Math.max(width, height);
  // Jamais d'agrandissement ici : une photo déjà plus petite que le palier
  // est laissée à sa taille, on ne fabrique pas de pixels côté navigateur.
  const scale = longSide > maxDimension ? maxDimension / longSide : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Compression failed (canvas unavailable).");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Ré-encode la photo au palier le plus généreux qui tient sous le plafond de
 * l'hébergeur. Si aucun palier ne suffit, renvoie le dernier : c'est
 * `prepareAndUpload` qui tranche alors avec un message clair, plutôt que de
 * laisser passer un upload voué à l'échec.
 */
async function compressImage(file: File): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unreadable image."));
      image.src = objectUrl;
    });

    let dataUrl = "";
    for (const step of ENCODE_STEPS) {
      dataUrl = encodeAtStep(img, step.maxDimension, step.quality);
      if (dataUrlByteLength(dataUrl) <= MAX_UPLOAD_BYTES) break;
    }

    const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
    return { previewUrl: dataUrl, base64, mimeType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Une photo qui tient déjà sous le plafond d'upload part telle quelle, en
 * pleine résolution : la meilleure entrée possible pour le modèle. On ne
 * ré-encode que ce qui est trop lourd — auparavant tout fichier de plus de
 * 2 Mo était ramené à 1536 px, y compris quand rien ne l'imposait.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return compressImage(file);
  }
  const dataUrl = await readFileAsDataUrl(file);
  const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
  return { previewUrl: dataUrl, base64, mimeType };
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Unsupported file. Please select an image.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "File too large (max 10MB).";
  }
  return null;
}

const UPLOAD_BUCKET = "photo-uploads";

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Héberge la photo dans notre bucket Supabase Storage et renvoie son URL
 * publique, transmise ensuite à `POST /api/generate` en `sourceImageUrl`.
 *
 * Upload direct navigateur → Supabase, sans passer par nos routes : c'est ce
 * qui sort l'hébergeur tiers kie.ai du chemin critique. La photo faisait
 * auparavant quatre traversées réseau avant que Gemini ne démarre
 * (navigateur → notre fonction → kie.ai, puis notre fonction re-téléchargeait
 * les mêmes octets depuis kie.ai). Elle en fait deux désormais, et l'URL
 * source n'a jamais servi à autre chose qu'à ce transport — seule
 * `result_url` est persistée (cf. `persistImageBytes`).
 *
 * Le chemin doit commencer par l'id de l'utilisateur : la policy d'insertion
 * du bucket (migration 0008) n'autorise que son propre dossier.
 */
export async function uploadImage(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Please sign in before uploading a photo.");
  }

  const path = `${user.id}/${crypto.randomUUID()}.${extensionForMimeType(file.type)}`;
  const { error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) {
    throw new Error(error.message || "Image upload failed.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
  return publicUrl;
}

/** Relit l'aperçu compressé, vérifie sa taille, puis l'héberge. */
export async function prepareAndUpload(image: PreparedImage): Promise<string> {
  const blob = await (await fetch(image.previewUrl)).blob();
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      "Image too large after compression (max 4MB). Try a simpler photo.",
    );
  }
  return uploadImage(new File([blob], "photo.jpg", { type: image.mimeType }));
}
