/**
 * Tests du parseur de verdict du juge qualité (boucle retry des gabarits).
 * Le juge répond par texte ; parseAssessment en extrait PASS/FAIL, et traite
 * tout cas ambigu comme PASS (ne pas régénérer dans le doute).
 */

import { describe, expect, it } from "vitest";
import { parseAssessment } from "@/lib/gemini-jobs";

describe("parseAssessment", () => {
  it("PASS => true (ne régénère pas)", () => {
    expect(parseAssessment("PASS")).toBe(true);
    expect(parseAssessment("pass")).toBe(true);
    expect(parseAssessment("The result is PASS.")).toBe(true);
  });

  it("FAIL => false (régénère)", () => {
    expect(parseAssessment("FAIL")).toBe(false);
    expect(parseAssessment("fail")).toBe(false);
    expect(parseAssessment("Verdict: FAIL — subject is a real photo.")).toBe(
      false,
    );
  });

  it("réponse ambiguë ou vide => true (défensif)", () => {
    expect(parseAssessment("")).toBe(true);
    expect(parseAssessment("hmm not sure")).toBe(true);
    expect(parseAssessment("passable")).toBe(true); // pas le mot isolé PASS
  });

  it("si FAIL apparaît en premier, gagne", () => {
    expect(parseAssessment("FAIL, definitely not a PASS")).toBe(false);
  });
});
