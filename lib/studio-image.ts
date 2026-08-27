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

export type PreparedImage = {
  previewUrl: string;
  base64: string;
  mimeType: string;
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Plafond de l'hébergeur d'uploads, appliqué après compression. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1536;
const JPEG_QUALITY = 0.9;

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

async function compressImage(file: File): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unreadable image."));
      image.src = objectUrl;
    });

    const { width, height } = img;
    const longSide = Math.max(width, height);
    const scale = longSide > MAX_DIMENSION ? MAX_DIMENSION / longSide : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Compression failed (canvas unavailable).");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
    return { previewUrl: dataUrl, base64, mimeType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > COMPRESS_THRESHOLD_BYTES) {
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

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/kie/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.fileUrl) {
    throw new Error(data?.error || "Image upload failed.");
  }
  return data.fileUrl as string;
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
