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

/** Nombre d'octets lus pour chercher le segment EXIF : il vit en tête. */
const EXIF_SCAN_BYTES = 128 * 1024;
const EXIF_ORIENTATION_TAG = 0x0112;

/**
 * Lit l'orientation EXIF d'un JPEG. Rend `1` (aucune rotation) pour tout ce
 * qui n'est pas un JPEG, n'a pas d'EXIF, ou est illisible.
 *
 * Pourquoi c'est nécessaire : un appareil photo n'écrit pas les pixels dans
 * le sens où l'on voit l'image, il ajoute une consigne de rotation dans
 * l'EXIF. Une photo prise en portrait est donc stockée couchée. Les
 * navigateurs et les visionneuses appliquent la consigne, mais rien ne
 * garantit qu'un modèle d'image le fasse — il peut recevoir la photo à plat.
 *
 * Sans cette lecture, le comportement dépendait du POIDS du fichier : au-delà
 * du plafond d'upload la photo passait par `canvas`, qui applique la rotation
 * et efface l'EXIF ; en dessous elle partait brute, consigne intacte. La même
 * photo pouvait donc arriver droite ou couchée selon son poids.
 */
export function readExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1;
    const marker = view.getUint8(offset + 1);
    // SOS : les données d'image commencent, plus aucun en-tête après.
    if (marker === 0xda) return 1;

    const size = view.getUint16(offset + 2);
    if (size < 2) return 1;

    // APP1 : le seul segment qui porte l'EXIF.
    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      const isExif =
        view.getUint32(offset + 4) === 0x45786966 && // "Exif"
        view.getUint16(offset + 8) === 0x0000;
      if (isExif) {
        const found = readOrientationFromTiff(view, offset + 10);
        if (found) return found;
      }
    }

    offset += 2 + size;
  }
  return 1;
}

/** Parcourt l'IFD0 du bloc TIFF de l'EXIF à la recherche du tag orientation. */
function readOrientationFromTiff(view: DataView, tiffStart: number): number {
  if (tiffStart + 8 > view.byteLength) return 0;

  const byteOrder = view.getUint16(tiffStart);
  if (byteOrder !== 0x4949 && byteOrder !== 0x4d4d) return 0;
  const little = byteOrder === 0x4949;

  const ifdOffset = view.getUint32(tiffStart + 4, little);
  const ifd = tiffStart + ifdOffset;
  if (ifd + 2 > view.byteLength) return 0;

  const entries = view.getUint16(ifd, little);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) return 0;
    if (view.getUint16(entry, little) === EXIF_ORIENTATION_TAG) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : 0;
    }
  }
  return 0;
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
 *
 * Seconde raison de ré-encoder : une orientation EXIF non neutre. Le passage
 * par `canvas` applique la rotation dans les pixels, de sorte que le modèle
 * reçoit la photo dans le sens où l'utilisateur la voit, qu'il honore ou non
 * l'EXIF. Cf. `readExifOrientation`.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const orientation = await readFileOrientation(file);
  if (file.size > MAX_UPLOAD_BYTES || orientation !== 1) {
    return compressImage(file);
  }
  const dataUrl = await readFileAsDataUrl(file);
  const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
  return { previewUrl: dataUrl, base64, mimeType };
}

/**
 * Orientation EXIF d'un fichier, lue sur ses premiers octets seulement.
 * Toute erreur de lecture rend `1` : un EXIF illisible ne doit pas empêcher
 * l'utilisateur d'envoyer sa photo.
 */
async function readFileOrientation(file: File): Promise<number> {
  try {
    const head = await file.slice(0, EXIF_SCAN_BYTES).arrayBuffer();
    return readExifOrientation(head);
  } catch {
    return 1;
  }
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
