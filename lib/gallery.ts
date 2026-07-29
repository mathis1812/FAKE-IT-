export type GalleryItem = {
  id: string;
  type: "image" | "video";
  url: string;
  createdAt: number;
  label?: string;
};

const STORAGE_KEY = "bluminoo-gallery-v1";
const MAX_ITEMS = 24;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadGallery(): GalleryItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GalleryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.url === "string" &&
        (item.type === "image" || item.type === "video"),
    );
  } catch {
    return [];
  }
}

export function saveGalleryItem(
  item: Omit<GalleryItem, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  },
): GalleryItem[] {
  if (!canUseStorage()) return [];
  const nextItem: GalleryItem = {
    id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: item.type,
    url: item.url,
    createdAt: item.createdAt ?? Date.now(),
    label: item.label,
  };
  const existing = loadGallery().filter((g) => g.url !== nextItem.url);
  const next = [nextItem, ...existing].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded — drop older items aggressively
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next.slice(0, 8)),
      );
    } catch {
      /* ignore */
    }
  }
  return next;
}

export function clearGallery(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function removeGalleryItem(id: string): GalleryItem[] {
  const next = loadGallery().filter((item) => item.id !== id);
  if (!canUseStorage()) return next;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
