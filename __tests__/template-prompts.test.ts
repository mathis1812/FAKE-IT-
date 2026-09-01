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
  resolveTemplatePrompt,
  templateUsesStyleReference,
} from "@/lib/template-prompts";

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
