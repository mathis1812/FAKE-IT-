/**
 * Cohérence entre ce qu'on AFFICHE et ce qu'on DÉBITE.
 *
 * Le montant montré au client avant qu'il ne lance une génération vient de
 * `IMAGE_GENERATION_COST`. Le montant réellement retiré de son solde vient de
 * `photoCost(TEMPLATE_QUALITY)`. Rien dans le code ne relie les deux : ils
 * peuvent diverger sans qu'aucune erreur ne se déclenche, et le client paierait
 * alors autre chose que le prix annoncé. D'où ce test.
 */

import { describe, expect, it } from "vitest";
import { EDIT_COST, IMAGE_GENERATION_COST } from "@/lib/generation-cost";
import {
  QUALITY_COST,
  TEMPLATE_QUALITY,
  photoCost,
} from "@/lib/generation-tiers";

describe("coût d'une génération de gabarit", () => {
  it("le montant débité est celui affiché au client", () => {
    expect(photoCost(TEMPLATE_QUALITY)).toBe(IMAGE_GENERATION_COST);
  });

  it("le palier des gabarits existe dans la grille", () => {
    expect(QUALITY_COST[TEMPLATE_QUALITY]).toBeDefined();
  });
});

describe("coût d'une retouche", () => {
  it("est un entier positif", () => {
    // Un coût nul ouvrirait des générations gratuites en boucle.
    expect(Number.isInteger(EDIT_COST)).toBe(true);
    expect(EDIT_COST).toBeGreaterThan(0);
  });

  it("ne dépasse pas celui d'une génération complète", () => {
    // Une retouche part d'un rendu existant : la facturer plus cher qu'une
    // génération depuis zéro serait incompréhensible pour le client.
    expect(EDIT_COST).toBeLessThanOrEqual(IMAGE_GENERATION_COST);
  });
});
