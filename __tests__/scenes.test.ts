import { describe, expect, it } from "vitest";
import {
  SCENES,
  buildScenePrompt,
  getScene,
  SCENE_CATEGORY_LABELS,
} from "@/lib/scenes";

describe("catalogue de scènes", () => {
  it("n'a pas d'identifiant en double", () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("expose une vignette et une catégorie connue pour chaque scène", () => {
    for (const scene of SCENES) {
      expect(scene.thumbnail.startsWith("/")).toBe(true);
      expect(SCENE_CATEGORY_LABELS[scene.category]).toBeTruthy();
    }
  });

  it("résout une scène par identifiant, et rien pour un identifiant inconnu", () => {
    expect(getScene(SCENES[0].id)?.label).toBe(SCENES[0].label);
    expect(getScene("scene-qui-n-existe-pas")).toBeUndefined();
  });
});

describe("buildScenePrompt", () => {
  const scene = SCENES[0];

  it("ouvre sur le verrou d'identité", () => {
    // L'ordre n'est pas cosmétique : le modèle pondère davantage le début du
    // prompt, et la préservation du visage est la contrainte qui ne doit
    // jamais passer après le décor.
    const prompt = buildScenePrompt(scene);
    expect(prompt.startsWith("Keep the person from the reference photo")).toBe(
      true,
    );
  });

  it("inclut le corps de la scène demandée", () => {
    const prompt = buildScenePrompt(scene);
    expect(prompt).toContain(scene.body);
  });

  it("termine toujours par les interdits, note utilisateur ou non", () => {
    // Les interdits (dont « ne lisse pas la peau ») doivent rester le dernier
    // mot : une note utilisateur insérée après les repousserait.
    for (const prompt of [
      buildScenePrompt(scene),
      buildScenePrompt(scene, "en noir et blanc"),
    ]) {
      expect(prompt.trimEnd().endsWith("a 3D render.")).toBe(true);
    }
  });

  it("cadre la note utilisateur comme une préférence secondaire", () => {
    const prompt = buildScenePrompt(scene, "rends-moi plus mince");
    const noteIndex = prompt.indexOf("rends-moi plus mince");

    expect(noteIndex).toBeGreaterThan(-1);
    // La note doit arriver après le verrou d'identité, et être annoncée comme
    // subordonnée : sinon « rends-moi plus mince » l'emporterait sur la
    // préservation du sujet, qui est exactement ce qu'on ne négocie pas.
    expect(prompt.indexOf("Secondary preference")).toBeLessThan(noteIndex);
    expect(prompt.indexOf("Keep the person")).toBeLessThan(noteIndex);
  });

  it("n'ajoute aucune mention de note quand il n'y en a pas", () => {
    expect(buildScenePrompt(scene)).not.toContain("Secondary preference");
    expect(buildScenePrompt(scene, "   ")).not.toContain("Secondary preference");
  });

  it("produit un prompt exploitable pour chaque scène du catalogue", () => {
    for (const s of SCENES) {
      const prompt = buildScenePrompt(s);
      expect(prompt.length).toBeGreaterThan(600);
      // Les trois blocs communs sont présents partout : c'est ce qui rend la
      // qualité homogène d'une scène à l'autre.
      expect(prompt).toContain("Keep the person from the reference photo");
      expect(prompt).toContain("real smartphone photograph");
      expect(prompt).toContain("Do not smooth");
    }
  });
});
