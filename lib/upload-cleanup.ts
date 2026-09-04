/**
 * Expiration des photos sources déposées par les clients.
 *
 * Depuis que ces photos ne transitent plus par un hébergeur tiers mais vivent
 * dans notre bucket `photo-uploads`, elles s'y accumulaient sans limite : c'est
 * nous qui les détenons, donc à nous de les faire expirer. Ce sont des photos
 * de personnes identifiables, et rien ne justifie de les garder au-delà de leur
 * usage.
 *
 * On ne peut pas les supprimer juste après la génération : le navigateur garde
 * leur URL en cache pour le bouton « régénérer ». D'où une expiration par
 * ancienneté, balayée une fois par jour (cf. `app/api/cron/cleanup-uploads`).
 *
 * Seuls les RÉSULTATS sont conservés durablement, dans le bucket `gallery` —
 * c'est ce que le client veut garder, pas sa photo d'origine.
 */

import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "photo-uploads";

/**
 * Sept jours. La photo source ne sert qu'à régénérer, ce qui arrive dans les
 * minutes qui suivent la première génération ; sept jours laissent une marge
 * confortable sans conserver indéfiniment des photos de personnes.
 *
 * Cette valeur est annoncée au client dans `app/privacy/page.tsx` : la changer
 * ici oblige à l'y changer aussi.
 */
export const UPLOAD_RETENTION_DAYS = 7;

/** Plafond d'une page de `Storage.list()`, et d'un lot de suppression. */
const PAGE_SIZE = 1000;
const DELETE_CHUNK = 100;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Ce que `Storage.list()` renvoie, réduit aux champs qui nous servent. */
export type StorageEntry = {
  name: string;
  /** `null` pour un dossier : Supabase ne matérialise pas les préfixes. */
  id: string | null;
  created_at?: string | null;
};

/**
 * `true` si l'objet a dépassé la durée de rétention.
 *
 * Défensif : une date absente ou illisible rend `false`. La suppression est
 * irréversible, donc dans le doute on garde — un fichier de trop coûte
 * quelques kilo-octets, un fichier supprimé à tort est perdu.
 */
export function isExpired(
  createdAt: string | null | undefined,
  now: Date,
  retentionDays: number = UPLOAD_RETENTION_DAYS,
): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return now.getTime() - created.getTime() > retentionDays * MS_PER_DAY;
}

/**
 * Chemins à supprimer dans le dossier d'un utilisateur. Les entrées sans `id`
 * sont des sous-dossiers, jamais des fichiers : on ne les touche pas.
 */
export function expiredPaths(
  folder: string,
  entries: StorageEntry[],
  now: Date,
  retentionDays: number = UPLOAD_RETENTION_DAYS,
): string[] {
  return entries
    .filter((e) => e.id !== null && isExpired(e.created_at, now, retentionDays))
    .map((e) => `${folder}/${e.name}`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

type StorageApi = ReturnType<
  ReturnType<typeof createServiceClient>["storage"]["from"]
>;

/** Parcourt toutes les pages de `list()` pour un préfixe donné. */
async function listAll(
  storage: StorageApi,
  path: string,
): Promise<StorageEntry[]> {
  const all: StorageEntry[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await storage.list(path, {
      limit: PAGE_SIZE,
      offset,
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as StorageEntry[]));
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export type SweepResult = {
  scanned: number;
  deleted: number;
  /** Dossiers dont le balayage a échoué, sans interrompre les autres. */
  failedFolders: number;
};

/**
 * Supprime toutes les photos sources ayant dépassé la rétention.
 *
 * L'échec d'un dossier n'interrompt pas les autres : un balayage partiel vaut
 * mieux qu'un balayage abandonné, et le passage du lendemain rattrapera.
 */
export async function sweepExpiredUploads(
  now: Date = new Date(),
): Promise<SweepResult> {
  const storage = createServiceClient().storage.from(BUCKET);
  const folders = await listAll(storage, "");

  let scanned = 0;
  let deleted = 0;
  let failedFolders = 0;

  for (const folder of folders) {
    // Un dossier par utilisateur. Une entrée avec un `id` à la racine serait
    // un fichier égaré, hors de notre convention de chemins : on l'ignore.
    if (folder.id !== null) continue;

    try {
      const entries = await listAll(storage, folder.name);
      scanned += entries.length;

      const stale = expiredPaths(folder.name, entries, now);
      for (const batch of chunk(stale, DELETE_CHUNK)) {
        const { error } = await storage.remove(batch);
        if (error) throw error;
        deleted += batch.length;
      }
    } catch (err) {
      failedFolders++;
      console.error(`Upload sweep failed for folder ${folder.name}:`, err);
    }
  }

  return { scanned, deleted, failedFolders };
}
