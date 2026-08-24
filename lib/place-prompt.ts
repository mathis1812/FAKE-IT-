const KIE_API_BASE = "https://api.kie.ai";

/**
 * Modèle chat vision kie.ai utilisé pour analyser les photos du lieu.
 * Même clé API que les jobs image/vidéo (Authorization: Bearer).
 */
const ANALYSIS_MODEL_PATH = "/gpt-5-2/v1/chat/completions";
const ANALYSIS_TIMEOUT_MS = 45_000;

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

const ANALYSIS_SYSTEM_INSTRUCTIONS = `You are a prompt engineer for a photorealistic image compositing model (Gemini-based image editing).
The FIRST image is the subject photo (a person). The following image(s) show a real-world location the subject must be placed into.

Analyze the location image(s) carefully:
- lighting (direction, color temperature, hardness, time of day, artificial vs natural sources)
- materials and textures (wood, marble, velvet, glass, concrete, foliage...)
- ambiance and mood (luxury restaurant, rooftop at dusk, cozy bar...)
- camera angle, perspective and focal-length feel
- depth of field and any notable background elements

Then write ONE rich, well-structured English prompt (a single paragraph, 80-160 words) instructing the image model to:
1. Keep the subject from the first image perfectly identical: face, identity, skin tone, hair, clothing, pose and expression.
2. Replace the background so the subject is naturally standing/sitting inside the exact location shown in the reference image(s), matching its real geometry and recognizable details.
3. Relight the subject to match the location's lighting (direction, color, contrast), add coherent shadows, reflections and color grading.
4. Match the camera angle, perspective and grain so the result looks like a single authentic smartphone photo taken at that place — an ultra-realistic lifestyle shot, credible enough for an Instagram story. No text, no watermark, no extra people.

If a user note is provided, weave its intent into the prompt.
Return ONLY the final prompt text, with no preamble, quotes or markdown.`;

/**
 * Prompt de secours structuré si l'appel d'analyse échoue : la génération
 * reste possible (nano-banana-pro voit lui-même les images de référence).
 */
export function fallbackPlacePrompt(userNote?: string): string {
  const note = userNote?.trim();
  return (
    "Take the person from the first image and place them naturally inside the real location shown in the following reference image(s). " +
    "Keep the subject perfectly identical: same face, identity, skin tone, hair, clothing, pose and expression. " +
    "Rebuild the background using the exact geometry, materials and recognizable details of the reference location. " +
    "Relight the subject to match the location's lighting direction, color temperature and contrast; add physically coherent shadows and reflections. " +
    "Match the camera angle, perspective, depth of field and grain of the location photos so the result looks like one authentic smartphone photo taken on site — " +
    "an ultra-realistic lifestyle shot credible enough for an Instagram story. No text, no watermark, no extra people." +
    (note ? ` Additional user intent: ${note}.` : "")
  );
}

/**
 * Analyse les photos du lieu (éclairage, matériaux, ambiance, angle) avec un
 * modèle vision kie.ai et renvoie un prompt structuré prêt pour
 * nano-banana-pro. En cas d'échec (réseau, quota, réponse vide), renvoie le
 * prompt de secours : on ne bloque jamais la génération sur cette étape.
 */
export async function buildPlacePrompt(
  apiKey: string,
  sourceImageUrl: string,
  placeImageUrls: string[],
  userNote?: string,
): Promise<string> {
  const note = userNote?.trim();
  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text:
        `Location reference image count: ${placeImageUrls.length}.` +
        (note ? ` User note (French, optional): "${note}".` : " No user note.") +
        " Write the final compositing prompt now.",
    },
    { type: "image_url", image_url: { url: sourceImageUrl } },
    ...placeImageUrls.map((url) => ({
      type: "image_url",
      image_url: { url },
    })),
  ];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${KIE_API_BASE}${ANALYSIS_MODEL_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: ANALYSIS_SYSTEM_INSTRUCTIONS },
            { role: "user", content: userContent },
          ],
          reasoning_effort: "low",
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      console.error(
        `Place analysis: kie.ai responded ${res.status}, using the fallback prompt.`,
      );
      return fallbackPlacePrompt(userNote);
    }

    const json = (await res.json()) as ChatCompletionResponse;
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      console.error(
        "Place analysis: empty response from kie.ai, using the fallback prompt.",
      );
      return fallbackPlacePrompt(userNote);
    }
    return text;
  } catch (err) {
    console.error("Place analysis failed:", err);
    return fallbackPlacePrompt(userNote);
  }
}
