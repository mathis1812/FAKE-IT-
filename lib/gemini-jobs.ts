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
/**
 * « Nano Banana 2 Lite ». Identifiant relevé le 04/09 sur l'endpoint
 * `/v1beta/models` de notre propre clé, pas déduit du nom commercial.
 *
 * Retenu pour les swaps véhicule après comparaison des modèles : plus rapide
 * que Nano Banana Pro, et surtout meilleur sur les proportions de
 * carrosserie — le seul défaut que ni le prompt ni les paramètres d'image
 * n'avaient réussi à corriger sur cette catégorie.
 */
export const LITE_IMAGE_MODEL_ID = "gemini-3.1-flash-lite-image";

/**
 * Modèles qui refusent `imageConfig.imageSize` et répondent
 * `400 INVALID_ARGUMENT — Image size 2K is not supported for this model`.
 *
 * Constaté le 04/09 en basculant les swaps véhicule sur le Lite : toutes les
 * générations échouaient. La taille est une capacité du modèle, pas un choix
 * de l'appelant — le filtre est donc ici, pour qu'aucun appelant ne puisse
 * reproduire cette erreur en passant simplement un autre modèle.
 */
const MODELS_WITHOUT_IMAGE_SIZE = new Set<string>([LITE_IMAGE_MODEL_ID]);
// Modèle texte+vision utilisé pour juger un rendu de gabarit (boucle retry).
// Séparé du modèle image : ici on veut une réponse texte PASS/FAIL, pas une
// image. Rapide et bon marché. Si ce modèle est indisponible, le juge échoue
// proprement et l'appelant garde le premier rendu (voir assessTemplateResult).
const JUDGE_MODEL_ID = "gemini-2.5-flash";
const JUDGE_TIMEOUT_MS = 30_000;

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
    /**
     * Modèle d'image à utiliser. Par défaut `MODEL_ID` (Nano Banana Pro).
     * Les swaps véhicule passent `LITE_IMAGE_MODEL_ID` — cf. son commentaire.
     */
    model?: string;
    /**
     * `generationConfig.temperature`, entre 0 et 1. Omis → le modèle applique
     * son défaut, qui vaut 1 (son maximum) sur toute la famille Nano Banana :
     * deux générations de la même photo diffèrent alors beaucoup. La baisser
     * rend les rendus plus reproductibles, au prix d'un peu d'audace.
     */
    temperature?: number;
    /**
     * `imageConfig.imageSize` (1K/2K/4K). Toujours renseigné pour les
     * gabarits : omettre ce champ ne fait PAS rendre le modèle à la taille de
     * l'image d'entrée, il retombe sur un défaut plus petit et le rendu y
     * perd nettement (comparé sur rendus réels le 03/09). `aspectRatio`, lui,
     * reste réservé aux univers (voir `matchFirstImageAspect`) car forcer le
     * ratio pousse gemini-3-pro-image à recomposer toute la scène.
     */
    resolution?: "1K" | "2K" | "4K";
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

  const model = input.model ?? MODEL_ID;
  const imageSize = MODELS_WITHOUT_IMAGE_SIZE.has(model)
    ? undefined
    : input.resolution;

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
      `${GEMINI_API_BASE}/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              // Images AVANT le texte : c'est l'ordre d'AI Studio, où le
              // même modèle rendait mieux à prompt et photo identiques. Sur
              // un modèle d'édition, l'instruction lue après l'image semble
              // mieux s'y ancrer. Inversé le 04/09 ; si un A/B montrait le
              // contraire, remettre le texte en tête.
              parts: [...imageParts, { text: input.prompt }],
            },
          ],
          // `imageConfig` seulement s'il y a quelque chose à forcer. Vide,
          // on n'envoie pas `generationConfig` du tout : le modèle édite
          // l'image sans re-projeter la scène (cf. `resolution` optionnel).
          ...(imageSize || aspectRatio || input.temperature !== undefined
            ? {
                generationConfig: {
                  ...(input.temperature !== undefined
                    ? { temperature: input.temperature }
                    : {}),
                  ...(imageSize || aspectRatio
                    ? {
                        imageConfig: {
                          ...(imageSize ? { imageSize } : {}),
                          ...(aspectRatio ? { aspectRatio } : {}),
                        },
                      }
                    : {}),
                },
              }
            : {}),
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

/**
 * Lit le verdict du juge dans sa réponse texte. Le prompt lui demande de
 * répondre par PASS ou FAIL ; on cherche le premier de ces deux mots.
 *
 * Défensif : toute réponse ambiguë ou vide est traitée comme PASS. Le juge
 * ne sert qu'à DÉCLENCHER une régénération de confort — dans le doute on ne
 * régénère pas, plutôt que de relancer à tort (coût, latence) sur un rendu
 * peut-être déjà bon.
 */
export function parseAssessment(text: string): boolean {
  const match = text.toUpperCase().match(/\b(PASS|FAIL)\b/);
  return match?.[1] !== "FAIL";
}

/**
 * Juge un rendu de gabarit : renvoie `true` s'il satisfait `criteria`,
 * `false` s'il faut régénérer. Envoie l'image générée à un modèle
 * texte+vision qui répond PASS/FAIL.
 *
 * BEST-EFFORT : ce juge n'est qu'un confort. Timeout, erreur réseau, modèle
 * indisponible, réponse illisible → renvoie `true` (pas de régénération).
 * Il ne peut donc jamais faire échouer une génération déjà réussie, ni
 * ajouter de la latence non bornée (timeout court dédié).
 */
export async function assessTemplateResult(
  apiKey: string,
  input: { imageBytes: Buffer; mimeType: string; criteria: string },
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${GEMINI_API_BASE}/models/${JUDGE_MODEL_ID}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "You are a strict QA checker for an image transformation. " +
                    "The attached image must satisfy ALL of these requirements:\n" +
                    input.criteria +
                    "\nReply with exactly one word: PASS if every requirement holds, " +
                    "or FAIL if any is violated. No explanation.",
                },
                {
                  inlineData: {
                    mimeType: input.mimeType,
                    data: input.imageBytes.toString("base64"),
                  },
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return true;
    const json = (await res.json()) as GeminiGenerateContentResponse;
    const text =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? "";
    return parseAssessment(text);
  } catch {
    return true;
  } finally {
    clearTimeout(timer);
  }
}
