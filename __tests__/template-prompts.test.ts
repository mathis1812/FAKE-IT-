/**
 * Garde-fou du découpage anti-fuite (voir en-tête de `lib/templates.ts`).
 *
 * 1. Le catalogue client ne doit porter aucun texte de prompt.
 * 2. Chaque gabarit du catalogue doit avoir une entrée de prompt alignée
 *    dans `lib/template-prompts.ts` — sinon `POST /api/generate` renverrait
 *    400 « Unknown template » en production.
 * 3. `resolveTemplatePrompt` refuse les combinaisons incohérentes.
 */

import { describe, expect, it } from "vitest";
import { TEMPLATE_CATEGORIES, allTemplates, hasVariants } from "@/lib/templates";
import {
  TEMPLATE_PROMPTS,
  getQualityCheck,
  modelForTemplate,
  resolveTemplatePrompt,
  temperatureForTemplate,
  templateLocksAspectRatio,
  templateUsesStyleReference,
} from "@/lib/template-prompts";
import { LITE_IMAGE_MODEL_ID } from "@/lib/gemini-jobs";

describe("le catalogue client ne fuite aucun prompt", () => {
  const serialized = JSON.stringify(TEMPLATE_CATEGORIES).toLowerCase();

  it("aucun mot-clé de prompt dans TEMPLATE_CATEGORIES", () => {
    expect(serialized).not.toContain("photograph");
    expect(serialized).not.toContain("reimagine");
    expect(serialized).not.toContain("prompt");
  });
});

describe("les prompts restent alignés sur le catalogue", () => {
  for (const template of allTemplates()) {
    it(`${template.slug} a une entrée de prompt cohérente`, () => {
      const entry = TEMPLATE_PROMPTS[template.slug];
      expect(entry, `aucun prompt pour « ${template.slug} »`).toBeDefined();

      if (hasVariants(template)) {
        expect(
          entry.variants,
          `« ${template.slug} » devrait être à variantes`,
        ).toBeDefined();
        const fromPrompts = Object.keys(entry.variants ?? {}).sort();
        const fromCatalog = template.variants.map((v) => v.slug).sort();
        expect(fromPrompts).toEqual(fromCatalog);
      } else {
        expect(typeof entry.prompt).toBe("string");
        expect((entry.prompt ?? "").length).toBeGreaterThan(0);
      }
    });
  }

  it("aucun prompt orphelin (sans gabarit correspondant)", () => {
    const known = new Set(allTemplates().map((t) => t.slug));
    for (const slug of Object.keys(TEMPLATE_PROMPTS)) {
      expect(known.has(slug), `prompt orphelin « ${slug} »`).toBe(true);
    }
  });
});

describe("resolveTemplatePrompt", () => {
  it("rend le prompt d'un gabarit simple", () => {
    expect(resolveTemplatePrompt("minecraft")).toContain("voxel");
  });

  it("rend null pour un gabarit inconnu", () => {
    expect(resolveTemplatePrompt("nexiste-pas")).toBeNull();
  });

  it("rend null si un gabarit à variantes est demandé sans variante", () => {
    expect(resolveTemplatePrompt("voiture-accidentee")).toBeNull();
  });

  it("rend null si une variante est demandée pour un gabarit simple", () => {
    expect(resolveTemplatePrompt("minecraft", "fort")).toBeNull();
  });

  it("rend le prompt de la variante demandée", () => {
    expect(resolveTemplatePrompt("voiture-accidentee", "fort")).toContain(
      "crash",
    );
  });

  it("rend null pour une variante inconnue", () => {
    expect(resolveTemplatePrompt("voiture-accidentee", "nope")).toBeNull();
  });
});

describe("templateUsesStyleReference", () => {
  it("vrai pour minecraft et lego", () => {
    expect(templateUsesStyleReference("minecraft")).toBe(true);
    expect(templateUsesStyleReference("lego")).toBe(true);
  });

  it("faux pour gta-5 (fiche los_santos_game: photo user seule)", () => {
    expect(templateUsesStyleReference("gta-5")).toBe(false);
  });

  it("faux pour les pranks et le swap véhicule", () => {
    expect(templateUsesStyleReference("voiture-accidentee")).toBe(false);
    expect(templateUsesStyleReference("aventador-svj")).toBe(false);
  });

  it("faux pour un gabarit inconnu", () => {
    expect(templateUsesStyleReference("nexiste-pas")).toBe(false);
  });
});

describe("getQualityCheck", () => {
  it("fournit un check pour minecraft et lego", () => {
    for (const slug of ["minecraft", "lego"]) {
      const check = getQualityCheck(slug);
      expect(check, slug).not.toBeNull();
      expect(check?.criteria.length).toBeGreaterThan(0);
      expect(check?.retrySuffix.length).toBeGreaterThan(0);
    }
  });

  it("null pour gta-5, dont le prompt court exclut tout retry", () => {
    // Son ancien retrySuffix redemandait le HUD et les shaders : il aurait
    // réinjecté en silence ce que le prompt court retire.
    expect(getQualityCheck("gta-5")).toBeNull();
  });

  it("null pour les gabarits sans check (pranks, swap, inconnu)", () => {
    expect(getQualityCheck("voiture-accidentee")).toBeNull();
    expect(getQualityCheck("aventador-svj")).toBeNull();
    expect(getQualityCheck("nexiste-pas")).toBeNull();
  });
});

describe("templateLocksAspectRatio", () => {
  it("vrai pour les univers (re-rendu complet de la scène)", () => {
    for (const slug of ["minecraft", "gta-5", "lego"]) {
      expect(templateLocksAspectRatio(slug), slug).toBe(true);
    }
  });

  it("faux pour swap véhicule et pranks (édition chirurgicale)", () => {
    expect(templateLocksAspectRatio("720s")).toBe(false);
    expect(templateLocksAspectRatio("aventador-svj")).toBe(false);
    expect(templateLocksAspectRatio("voiture-accidentee")).toBe(false);
  });

  it("faux pour un gabarit inconnu", () => {
    expect(templateLocksAspectRatio("nexiste-pas")).toBe(false);
  });
});

describe("modelForTemplate", () => {
  it("Nano Banana 2 Lite pour toutes les voitures", () => {
    const cars =
      TEMPLATE_CATEGORIES.find((c) => c.slug === "swap-vehicule")?.templates ??
      [];
    expect(cars.length).toBeGreaterThan(0);
    for (const car of cars) {
      expect(modelForTemplate(car.slug), car.slug).toBe(LITE_IMAGE_MODEL_ID);
    }
  });

  it("modèle par défaut pour les pranks et les univers", () => {
    // Non jugés sur le Lite : ils doivent rester sur Nano Banana Pro tant
    // qu'une comparaison n'a pas été faite.
    for (const slug of ["voiture-accidentee", "minecraft", "gta-5", "lego"]) {
      expect(modelForTemplate(slug), slug).toBeUndefined();
    }
  });

  it("modèle par défaut pour un gabarit inconnu", () => {
    expect(modelForTemplate("nexiste-pas")).toBeUndefined();
  });
});

describe("temperatureForTemplate", () => {
  it("température resserrée sur les voitures, dans les bornes du modèle", () => {
    const cars =
      TEMPLATE_CATEGORIES.find((c) => c.slug === "swap-vehicule")?.templates ??
      [];
    for (const car of cars) {
      const t = temperatureForTemplate(car.slug);
      expect(t, car.slug).toBeDefined();
      // `maxTemperature` vaut 1 sur toute la famille Nano Banana : au-delà,
      // l'API rejette la requête.
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });

  it("défaut du modèle pour les pranks, les univers et l'inconnu", () => {
    for (const slug of ["voiture-accidentee", "minecraft", "nexiste-pas"]) {
      expect(temperatureForTemplate(slug), slug).toBeUndefined();
    }
  });
});

describe("swap véhicule : couleur d'usine + modèle exact (base usenoway)", () => {
  const cars =
    TEMPLATE_CATEGORIES.find((c) => c.slug === "swap-vehicule")?.templates ?? [];

  it("la catégorie porte bien des voitures", () => {
    expect(cars.length).toBeGreaterThan(0);
  });

  for (const car of cars) {
    it(`${car.slug} : prompt « factory-stock » avec une couleur explicite`, () => {
      const prompt = resolveTemplatePrompt(car.slug) ?? "";
      // Formulation reprise du front usenoway.
      expect(prompt).toContain("factory-stock,");
      // Un simple nom de modèle (fallback `target`) n'aurait pas de couleur :
      // ce test échoue si un slug n'a pas reçu de spec dédiée.
      expect(prompt.toLowerCase()).toMatch(
        /\b(black|white|red|orange|grey|gray|green|blue|silver)\b/,
      );
    });
  }
});
