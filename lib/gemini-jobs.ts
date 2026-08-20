const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
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

async function fetchAsInlineData(url: string): Promise<GeminiInlineData> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Téléchargement de l'image de référence échoué (${res.status}).`);
  }
  const mimeType = res.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { mimeType, data: bytes.toString("base64") };
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
  },
): Promise<{ bytes: Buffer; mimeType: string }> {
  const imageParts = await Promise.all(
    input.imageUrls.map(async (url) => ({
      inlineData: await fetchAsInlineData(url),
    })),
  );

  const res = await fetch(
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
          imageConfig: { imageSize: input.resolution },
        },
      }),
    },
  );

  const raw = await res.text();
  let json: GeminiGenerateContentResponse;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(
      `Réponse Gemini illisible (HTTP ${res.status}) : ${raw.slice(0, 300) || "(corps vide)"}`,
    );
  }

  if (!res.ok) {
    throw new Error(`Erreur API Gemini (${res.status}) : ${raw.slice(0, 300)}`);
  }

  if (json.promptFeedback?.blockReason) {
    throw new Error(
      `Génération bloquée par Gemini (${json.promptFeedback.blockReason}).`,
    );
  }

  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error("La génération a réussi mais aucune image n'a été renvoyée.");
  }

  return {
    bytes: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}
