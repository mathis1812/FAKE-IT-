/**
 * Expiration des photos sources.
 *
 * Ce code SUPPRIME des fichiers, et il tourne sans personne pour le regarder.
 * Deux erreurs y seraient invisibles et opposées : ne rien supprimer, et le
 * bucket enfle indéfiniment ; supprimer trop, et la photo d'un client
 * disparaît alors qu'il pouvait encore régénérer. D'où ces tests sur les deux
 * fonctions pures qui décident.
 */

import { describe, expect, it } from "vitest";
import {
  UPLOAD_RETENTION_DAYS,
  expiredPaths,
  isExpired,
  type StorageEntry,
} from "@/lib/upload-cleanup";

const NOW = new Date("2026-01-20T12:00:00.000Z");
const daysBefore = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

/** Un fichier : Supabase lui donne un `id`. */
const file = (name: string, createdAt: string | null): StorageEntry => ({
  name,
  id: `id-${name}`,
  created_at: createdAt,
});

/** Un dossier : Supabase ne matérialise pas les préfixes, `id` vaut `null`. */
const folder = (name: string): StorageEntry => ({
  name,
  id: null,
  created_at: null,
});

describe("isExpired", () => {
  it("garde un fichier plus récent que la rétention", () => {
    expect(isExpired(daysBefore(1), NOW)).toBe(false);
    expect(isExpired(daysBefore(UPLOAD_RETENTION_DAYS - 1), NOW)).toBe(false);
  });

  it("supprime un fichier plus ancien que la rétention", () => {
    expect(isExpired(daysBefore(UPLOAD_RETENTION_DAYS + 1), NOW)).toBe(true);
    expect(isExpired(daysBefore(90), NOW)).toBe(true);
  });

  it("garde un fichier pile à la limite", () => {
    // Strictement au-delà seulement : à la seconde près, on garde.
    expect(isExpired(daysBefore(UPLOAD_RETENTION_DAYS), NOW)).toBe(false);
  });

  it("garde tout ce dont la date est absente ou illisible", () => {
    // La suppression est irréversible : dans le doute, on ne touche à rien.
    expect(isExpired(null, NOW)).toBe(false);
    expect(isExpired(undefined, NOW)).toBe(false);
    expect(isExpired("", NOW)).toBe(false);
    expect(isExpired("pas une date", NOW)).toBe(false);
  });

  it("garde un fichier daté dans le futur", () => {
    expect(isExpired(daysBefore(-3), NOW)).toBe(false);
  });

  it("respecte une rétention explicite", () => {
    const age = daysBefore(10);
    expect(isExpired(age, NOW, 30)).toBe(false);
    expect(isExpired(age, NOW, 5)).toBe(true);
  });
});

describe("expiredPaths", () => {
  const userId = "11111111-2222-3333-4444-555555555555";

  it("préfixe les chemins par le dossier de l'utilisateur", () => {
    const entries = [file("a.jpg", daysBefore(30))];
    expect(expiredPaths(userId, entries, NOW)).toEqual([`${userId}/a.jpg`]);
  });

  it("ne retient que les fichiers expirés", () => {
    const entries = [
      file("vieux.jpg", daysBefore(30)),
      file("recent.jpg", daysBefore(1)),
      file("aussi-vieux.png", daysBefore(8)),
    ];
    expect(expiredPaths(userId, entries, NOW)).toEqual([
      `${userId}/vieux.jpg`,
      `${userId}/aussi-vieux.png`,
    ]);
  });

  it("ignore les sous-dossiers, même anciens", () => {
    // Un dossier n'a pas de date exploitable et ne doit jamais être supprimé
    // comme un fichier.
    const entries = [folder("un-sous-dossier"), file("x.jpg", daysBefore(30))];
    expect(expiredPaths(userId, entries, NOW)).toEqual([`${userId}/x.jpg`]);
  });

  it("rend une liste vide quand rien n'a expiré", () => {
    const entries = [file("a.jpg", daysBefore(1)), file("b.jpg", null)];
    expect(expiredPaths(userId, entries, NOW)).toEqual([]);
  });

  it("rend une liste vide sur un dossier vide", () => {
    expect(expiredPaths(userId, [], NOW)).toEqual([]);
  });
});
