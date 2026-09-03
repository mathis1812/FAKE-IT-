/**
 * Garde-fous de la préparation d'image côté navigateur.
 *
 * Ces deux propriétés se cassent en silence : personne ne voit passer un
 * upload refusé par l'hébergeur, ni une photo discrètement rétrécie sous la
 * taille de sortie du modèle. D'où des tests sur les parties pures.
 */

import { describe, expect, it } from "vitest";
import {
  ENCODE_STEPS,
  MAX_UPLOAD_BYTES,
  dataUrlByteLength,
} from "@/lib/studio-image";

/** Côté long de la sortie 2K de gemini-3-pro-image. */
const OUTPUT_LONG_SIDE_2K = 2400;

describe("dataUrlByteLength", () => {
  it("rend le poids décodé, pas la longueur de la chaîne base64", () => {
    // "abc" → "YWJj" : 4 caractères base64 pour 3 octets, sans padding.
    expect(dataUrlByteLength("data:image/jpeg;base64,YWJj")).toBe(3);
  });

  it("retire le padding d'un octet", () => {
    // "ab" → "YWI=" (un "=").
    expect(dataUrlByteLength("data:image/jpeg;base64,YWI=")).toBe(2);
  });

  it("retire le padding de deux octets", () => {
    // "a" → "YQ==" (deux "=").
    expect(dataUrlByteLength("data:image/jpeg;base64,YQ==")).toBe(1);
  });

  it("reste exact sur une charge réaliste", () => {
    const bytes = 512 * 1024;
    const dataUrl = `data:image/jpeg;base64,${Buffer.alloc(bytes).toString("base64")}`;
    expect(dataUrlByteLength(dataUrl)).toBe(bytes);
  });
});

describe("ENCODE_STEPS", () => {
  it("n'envoie jamais au modèle une entrée plus petite que sa sortie 2K", () => {
    // C'était le défaut d'origine : un plafond à 1536 px forçait
    // gemini-3-pro-image à agrandir ×1,56 et à inventer le micro-détail.
    expect(ENCODE_STEPS[0].maxDimension).toBeGreaterThanOrEqual(
      OUTPUT_LONG_SIDE_2K,
    );
  });

  it("dégrade de façon monotone : jamais un palier plus généreux que le précédent", () => {
    for (let i = 1; i < ENCODE_STEPS.length; i++) {
      const previous = ENCODE_STEPS[i - 1];
      const current = ENCODE_STEPS[i];
      expect(current.maxDimension).toBeLessThanOrEqual(previous.maxDimension);
      const degraded =
        current.maxDimension < previous.maxDimension ||
        current.quality < previous.quality;
      expect(degraded, `le palier ${i} ne dégrade rien`).toBe(true);
    }
  });

  it("garde des qualités JPEG exploitables", () => {
    for (const step of ENCODE_STEPS) {
      expect(step.quality).toBeGreaterThanOrEqual(0.8);
      expect(step.quality).toBeLessThanOrEqual(1);
    }
  });

  it("laisse un dernier palier assez bas pour tenir sous le plafond d'upload", () => {
    const last = ENCODE_STEPS[ENCODE_STEPS.length - 1];
    expect(last.maxDimension).toBeLessThanOrEqual(1536);
    expect(MAX_UPLOAD_BYTES).toBe(4 * 1024 * 1024);
  });
});
