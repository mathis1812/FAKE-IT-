import { nearestAspectRatio, readImageSize } from "@/lib/image-dimensions";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// La fonction Vercel qui appelle ceci a un budget total de 300 s (voir
// maxDuration dans app/api/generate/route.ts), dont jusqu'à 45 s peuvent
// déjà être pris par l'analyse vision optionnelle des photos du lieu. Sans
// cette limite, un appel Gemini qui traîne mangeait tout le budget restant
// en silence avant que Vercel ne coupe la fonction sans message clair ni
// remboursement propre côté utilisateur.
const GEMINI_TIMEOUT_MS = 240_000;
// gemini-3-pro-image-preview a été retiré par Google le 25/06/2026 ;
// gemini-3-pro-image (Nano Banana Pro, sans suffixe -preview) est son
// remplacement officiel — voir ai.google.dev/gemini-api/docs/deprecations.
const MODEL_ID = "gemini-3-pro-image";

type GeminiInlineData = {
  mimeType?: string;
  data?: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: GeminiInlineData;
};

type GeminiGenerateContentResponse = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
};

async function downloadImage(
  url: string,
): Promise<{ mimeType: string; bytes: Buffer }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download the reference image (${res.status}).`);
  }
  const mimeType = res.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { mimeType, bytes };
}

/**
 * Appelle l'API Gemini directe (generateContent, synchrone — pas de file
 * d'attente à interroger contrairement à kie.ai/fal.ai) pour éditer une
 * image. Télécharge les images de référence depuis leurs URLs déjà
 * hébergées et les envoie en base64 inline, comme l'exige cette API.
 * Renvoie l'image résultat sous forme d'octets bruts (pas une URL — c'est
 * à l'appelant de la persister).
 */
export async function generateGeminiImage(
  apiKey: string,
  input: {
    prompt: string;
    imageUrls: string[];
    resolution: "1K" | "2K" | "4K";
    /**
     * Verrouille le ratio de sortie sur celui de la première image (le
     * sujet), ramené au ratio accepté le plus proche. Sans consigne
     * explicite, gemini-3-pro-image dérive parfois vers un autre cadrage.
     * Ignoré si les dimensions sont illisibles.
     */
    matchFirstImageAspect?: boolean;
  },
): Promise<{ bytes: Buffer; mimeType: string }> {
  const images = await Promise.all(input.imageUrls.map(downloadImage));
  const imageParts = images.map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.bytes.toString("base64") },
  }));

  let aspectRatio: string | undefined;
  if (input.matchFirstImageAspect && images.length > 0) {
    const size = readImageSize(images[0].bytes);
    if (size) {
      aspectRatio = nearestAspectRatio(size.width, size.height) ?? undefined;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `${GEMINI_API_BASE}/models/${MODEL_ID}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: input.prompt }, ...imageParts],
            },
          ],
          generationConfig: {
            imageConfig: {
              imageSize: input.resolution,
              ...(aspectRatio ? { aspectRatio } : {}),
            },
          },
        }),
        signal: controller.signal,
      },
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Gemini generation timed out after ${GEMINI_TIMEOUT_MS / 1000}s. Please try again.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  let json: GeminiGenerateContentResponse;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      `Unreadable Gemini response (HTTP ${res.status}): ${raw.slice(0, 300) || "(empty body)"}`,
    );
  }

  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${raw.slice(0, 300)}`);
  }

  if (json.promptFeedback?.blockReason) {
    throw new Error(
      `Generation blocked by Gemini (${json.promptFeedback.blockReason}).`,
    );
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error("Generation succeeded but no image was returned.");
  }

  return {
    bytes: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}
