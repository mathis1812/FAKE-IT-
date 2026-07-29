const DB_NAME = "bluminoo-gallery";
const DB_VERSION = 1;
const STORE_NAME = "entries";
const MAX_ENTRIES = 15;

export type GalleryEntry = {
  id: string;
  mode: "image" | "video";
  createdAt: number;
  resultUrl: string;
  beforeUrl?: string;
  label: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAll(db: IDBDatabase): Promise<GalleryEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as GalleryEntry[]);
    request.onerror = () => reject(request.error);
  });
}

async function pruneOldEntries(db: IDBDatabase): Promise<void> {
  const entries = await readAll(db);
  if (entries.length <= MAX_ENTRIES) return;
  const toDelete = [...entries]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(MAX_ENTRIES);

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const entry of toDelete) store.delete(entry.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Sauvegarde une génération réussie ; purge automatiquement au-delà de MAX_ENTRIES. */
export async function addGalleryEntry(
  entry: Omit<GalleryEntry, "id" | "createdAt">,
): Promise<void> {
  const db = await openDb();
  const full: GalleryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(full);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  await pruneOldEntries(db);
  db.close();
}

/** Retourne les entrées sauvegardées, de la plus récente à la plus ancienne. */
export async function listGalleryEntries(): Promise<GalleryEntry[]> {
  const db = await openDb();
  const entries = await readAll(db);
  db.close();
  return entries.sort((a, b) => b.createdAt - a.createdAt);
}
