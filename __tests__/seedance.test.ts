import { describe, expect, test } from "vitest";
import {
  buildSeedanceInput,
  SEEDANCE_MODEL_ID,
  SEEDANCE_RESOLUTION,
} from "@/lib/seedance";
import { VIDEO_DURATIONS, videoCost } from "@/lib/generation-tiers";

/**
 * Garde-fous sur le corps envoyé à Seedance 2.5.
 *
 * Ce que ces tests empêchent est une SURFACTURATION SILENCIEUSE, pas une
 * panne : l'API accepte volontiers `duration: "auto"` et `resolution: "720p"`
 * — ce sont ses défauts — et rend une vidéo parfaitement correcte. Rien
 * n'échoue, rien n'est journalisé ; seule la facture fal.ai change. Un clip
 * parti en « auto » à 30 secondes coûte ~13,87 $ au lieu de ~1,32 $.
 */
describe("buildSeedanceInput", () => {
  const base = {
    imageUrl: "https://example.supabase.co/storage/v1/object/public/x.jpg",
    prompt: "the car drives off, smoke from the tyres",
    duration: 6 as const,
  };

  test("envoie la durée demandée, jamais 'auto'", () => {
    const input = buildSeedanceInput(base);
    expect(input.duration).toBe("6");
    expect(input.duration).not.toBe("auto");
  });

  test("sérialise la durée en chaîne, pas en nombre", () => {
    // L'API déclare `duration` comme une énumération de chaînes : un entier
    // est refusé en 400, et l'erreur n'apparaîtrait qu'en production.
    for (const duration of VIDEO_DURATIONS) {
      const input = buildSeedanceInput({ ...base, duration });
      expect(typeof input.duration).toBe("string");
      expect(input.duration).toBe(String(duration));
    }
  });

  test("épingle la résolution à 480p plutôt que de laisser le défaut 720p", () => {
    expect(buildSeedanceInput(base).resolution).toBe("480p");
    expect(SEEDANCE_RESOLUTION).toBe("480p");
  });

  test("émet explicitement tous les champs facturables", () => {
    // Y compris ceux qui coïncident avec le défaut de l'API : si fal change
    // un défaut, notre facture ne doit pas changer sans qu'une ligne de ce
    // dépôt bouge.
    const input = buildSeedanceInput(base);
    for (const field of [
      "image_url",
      "prompt",
      "duration",
      "resolution",
      "aspect_ratio",
      "generate_audio",
      "bitrate_mode",
    ]) {
      expect(input).toHaveProperty(field);
    }
  });

  test("transmet la photo et la description sans les altérer", () => {
    const input = buildSeedanceInput(base);
    expect(input.image_url).toBe(base.imageUrl);
    expect(input.prompt).toBe(base.prompt);
  });

  test("vise l'endpoint image-to-video de Seedance 2.5", () => {
    expect(SEEDANCE_MODEL_ID).toBe("bytedance/seedance-2.5/image-to-video");
  });
});

/**
 * La grille tarifaire relevée sur le produit de référence. Elle est vérifiée
 * ici parce que c'est elle qui décide de la marge : au tarif de Seedance en
 * 480p (~0,221 $/s), ces montants laissent ~63 % sur le palier le moins
 * favorable. Les baisser sans changer de résolution vendrait à perte.
 */
describe("tarif vidéo", () => {
  test("150 crédits par seconde, sur les trois durées", () => {
    expect(videoCost(4)).toBe(600);
    expect(videoCost(6)).toBe(900);
    expect(videoCost(8)).toBe(1200);
  });

  test("ne propose que des durées courtes", () => {
    // Seedance accepte jusqu'à 30 secondes. Un cran à 30 s coûterait 4500
    // crédits au client et ~6,60 $ à nous : hors de la grille de référence.
    expect(VIDEO_DURATIONS).toEqual([4, 6, 8]);
  });
});
