import { describe, expect, test } from "vitest";
import { buildKlingVideoInput, KLING_VIDEO_MODEL_ID } from "@/lib/kling-video";
import { VIDEO_DURATIONS, videoCost } from "@/lib/generation-tiers";

/**
 * Garde-fous sur le corps envoyé à Kling 3.0.
 *
 * Ce que ces tests empêchent ne casse pas le build et ne lève aucune erreur
 * de type : un nom de champ faux ou une durée oubliée produit une génération
 * qui échoue chez le fournisseur — après débit du client — ou, pire, une
 * génération qui réussit à un tarif que personne n'a décidé.
 */
describe("buildKlingVideoInput", () => {
  const base = {
    imageUrl: "https://example.supabase.co/storage/v1/object/public/x.jpg",
    prompt: "the car drives off, smoke from the tyres",
    duration: 6 as const,
  };

  test("nomme la photo `start_image_url`, pas `image_url`", () => {
    // Le piège de la migration depuis Seedance, qui utilisait `image_url`.
    // fal refuse la requête, et le client voit seulement un échec.
    const input = buildKlingVideoInput(base);
    expect(input).toHaveProperty("start_image_url", base.imageUrl);
    expect(input).not.toHaveProperty("image_url");
  });

  test("envoie la durée demandée, jamais le défaut '5' de l'API", () => {
    const input = buildKlingVideoInput(base);
    expect(input.duration).toBe("6");
    // "5" n'appartient pas à notre grille : le voir ici signifierait que la
    // durée n'est plus transmise et que l'API applique son propre défaut.
    expect(input.duration).not.toBe("5");
  });

  test("sérialise la durée en chaîne, pas en nombre", () => {
    for (const duration of VIDEO_DURATIONS) {
      const input = buildKlingVideoInput({ ...base, duration });
      expect(typeof input.duration).toBe("string");
      expect(input.duration).toBe(String(duration));
    }
  });

  test("garde l'audio actif, comme la page tarifs le promet", () => {
    // « Videos with sound, 4 to 8s » dans PricingCatalogue. Le couper
    // économiserait 0,04 $/s en faisant mentir l'offre.
    expect(buildKlingVideoInput(base).generate_audio).toBe(true);
  });

  test("émet explicitement tous les champs, défauts compris", () => {
    const input = buildKlingVideoInput(base);
    for (const field of [
      "start_image_url",
      "prompt",
      "duration",
      "generate_audio",
      "shot_type",
      "negative_prompt",
      "cfg_scale",
    ]) {
      expect(input).toHaveProperty(field);
    }
  });

  test("transmet la description sans l'altérer", () => {
    expect(buildKlingVideoInput(base).prompt).toBe(base.prompt);
  });

  test("vise l'endpoint image-to-video de Kling v3 standard", () => {
    expect(KLING_VIDEO_MODEL_ID).toBe(
      "fal-ai/kling-video/v3/standard/image-to-video",
    );
  });
});

/**
 * La grille tarifaire relevée sur le produit de référence. Elle est vérifiée
 * ici parce que c'est elle qui décide de la marge : au tarif de Kling 3.0
 * avec audio (0,126 $/s), ces montants laissent ~79 % sur le palier le moins
 * favorable. Les baisser vendrait à perte.
 */
describe("tarif vidéo", () => {
  test("150 crédits par seconde, sur les trois durées", () => {
    expect(videoCost(4)).toBe(600);
    expect(videoCost(6)).toBe(900);
    expect(videoCost(8)).toBe(1200);
  });

  test("ne propose que des durées courtes", () => {
    // Kling accepte 3 à 15 secondes. Un cran à 15 s coûterait 2250 crédits au
    // client et ~1,89 $ à nous : hors de la grille de référence.
    expect(VIDEO_DURATIONS).toEqual([4, 6, 8]);
  });
});
