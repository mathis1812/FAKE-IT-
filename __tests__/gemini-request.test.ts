/**
 * Forme de la requête envoyée à l'API Gemini.
 *
 * Deux régressions vécues en production, toutes deux invisibles à la
 * compilation et bloquantes pour le client :
 *
 * 1. envoyer `imageConfig.imageSize` à un modèle qui ne le gère pas →
 *    400 INVALID_ARGUMENT, aucune génération ne passe ;
 * 2. omettre `imageSize` là où il est supporté → le modèle retombe sur un
 *    défaut plus petit et le rendu se dégrade en silence.
 *
 * D'où ces tests sur le corps réellement transmis.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { LITE_IMAGE_MODEL_ID, generateGeminiImage } from "@/lib/gemini-jobs";

/** 1×1 PNG, assez pour que le téléchargement et la réponse soient valides. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type Captured = { url: string; body: Record<string, unknown> };

/**
 * Remplace `fetch` : la 1re requête sert l'image source à télécharger, la
 * 2nde est l'appel à generateContent, qu'on capture puis à laquelle on
 * répond par une image valide.
 */
function stubFetch(captured: Captured[]) {
  const image = Buffer.from(PNG_BASE64, "base64");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (!init?.body) {
        return new Response(image, {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }
      captured.push({ url, body: JSON.parse(init.body as string) });
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { mimeType: "image/png", data: PNG_BASE64 } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  );
}

const imageConfigOf = (c: Captured) =>
  (c.body.generationConfig as { imageConfig?: Record<string, unknown> })
    ?.imageConfig;

afterEach(() => vi.unstubAllGlobals());

describe("generateGeminiImage : corps de la requête", () => {
  it("place les images AVANT le texte", async () => {
    // Ordre d'AI Studio, où le même modèle rendait mieux à prompt et photo
    // identiques. Sur un modèle d'édition, l'instruction lue après l'image
    // s'y ancre mieux.
    const captured: Captured[] = [];
    stubFetch(captured);

    await generateGeminiImage("cle-de-test", {
      prompt: "swap",
      imageUrls: ["https://example.test/photo.png"],
    });

    const parts = (
      captured[0].body.contents as { parts: Record<string, unknown>[] }[]
    )[0].parts;
    expect(parts).toHaveLength(2);
    expect(parts[0].inlineData).toBeDefined();
    expect(parts[1].text).toBe("swap");
  });


  it("n'envoie pas imageSize au modèle Lite, qui le refuse", async () => {
    const captured: Captured[] = [];
    stubFetch(captured);

    await generateGeminiImage("cle-de-test", {
      prompt: "swap",
      imageUrls: ["https://example.test/photo.png"],
      model: LITE_IMAGE_MODEL_ID,
      resolution: "2K",
    });

    const call = captured[0];
    expect(call.url).toContain(LITE_IMAGE_MODEL_ID);
    // Sans ce filtre : 400 « Image size 2K is not supported for this model ».
    expect(call.body.generationConfig).toBeUndefined();
  });

  it("envoie imageSize au modèle par défaut", async () => {
    const captured: Captured[] = [];
    stubFetch(captured);

    await generateGeminiImage("cle-de-test", {
      prompt: "swap",
      imageUrls: ["https://example.test/photo.png"],
      resolution: "2K",
    });

    const call = captured[0];
    expect(call.url).toContain("gemini-3-pro-image");
    expect(imageConfigOf(call)).toEqual({ imageSize: "2K" });
  });

  it("envoie la température même quand imageSize est filtré", async () => {
    // Le cas réel des swaps véhicule : modèle Lite (pas d'imageSize possible)
    // mais température resserrée pour limiter l'écart entre deux générations.
    const captured: Captured[] = [];
    stubFetch(captured);

    await generateGeminiImage("cle-de-test", {
      prompt: "swap",
      imageUrls: ["https://example.test/photo.png"],
      model: LITE_IMAGE_MODEL_ID,
      resolution: "2K",
      temperature: 0.5,
    });

    const config = captured[0].body.generationConfig as Record<string, unknown>;
    expect(config.temperature).toBe(0.5);
    expect(config.imageConfig).toBeUndefined();
  });

  it("n'envoie aucun generationConfig quand rien n'est à forcer", async () => {
    const captured: Captured[] = [];
    stubFetch(captured);

    await generateGeminiImage("cle-de-test", {
      prompt: "swap",
      imageUrls: ["https://example.test/photo.png"],
    });

    expect(captured[0].body.generationConfig).toBeUndefined();
  });
});
