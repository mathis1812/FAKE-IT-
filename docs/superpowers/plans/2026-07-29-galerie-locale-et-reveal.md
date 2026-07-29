# Galerie locale + reveal dramatisé — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sauvegarder automatiquement chaque génération réussie (image/vidéo) dans un store local (IndexedDB, max 15 entrées), afficher cet historique sur `/galerie`, et dramatiser l'attente/l'apparition du résultat sur les deux onglets.

**Architecture:** Un nouveau module `lib/gallery.ts` encapsule IndexedDB derrière deux fonctions (`addGalleryEntry`, `listGalleryEntries`). `app/page.tsx` appelle `addGalleryEntry` après chaque génération réussie et affiche des messages de chargement rotatifs + une animation d'entrée plus marquée. `app/galerie/page.tsx` passe de placeholder statique à composant client qui lit le store.

**Tech Stack:** Next.js 14 App Router, TypeScript, React 18, API `indexedDB` native (aucune dépendance ajoutée), Tailwind CSS.

## Global Constraints

- Max **15** entrées dans la galerie locale ; au-delà, la plus ancienne (par `createdAt`) est supprimée automatiquement à chaque ajout.
- Couvre **Image et Vidéo** (les deux modes de génération).
- Aucun backend, aucune synchronisation entre appareils — IndexedDB du navigateur uniquement.
- Échec d'écriture/lecture IndexedDB : catché silencieusement (`console.error`), ne doit jamais bloquer ni afficher d'erreur utilisateur sur le flux de génération principal.
- Respect de `prefers-reduced-motion` pour toute nouvelle animation (liste déjà présente dans `app/globals.css:60-65`).
- Pas de framework de tests dans ce projet. Vérification via `npx tsc --noEmit -p tsconfig.json` + vérification manuelle au navigateur.

---

## Fichiers concernés

- Créer : `lib/gallery.ts`
- Modifier : `app/page.tsx` (import, appels `addGalleryEntry`, messages de chargement rotatifs, classes d'animation)
- Modifier : `app/globals.css` (ajout de `.animate-reveal` à la liste neutralisée sous `prefers-reduced-motion`)
- Modifier : `tailwind.config.ts` (nouvelle animation/keyframes `reveal`)
- Modifier : `app/galerie/page.tsx` (remplacement complet — composant client)

---

### Task 1: Store local IndexedDB — `lib/gallery.ts`

**Files:**
- Create: `lib/gallery.ts`

**Interfaces:**
- Produces: `GalleryEntry` (type exporté), `addGalleryEntry(entry: Omit<GalleryEntry, "id" | "createdAt">): Promise<void>`, `listGalleryEntries(): Promise<GalleryEntry[]>` — consommés par Task 2 (écriture) et Task 4 (lecture).

- [ ] **Step 1: Créer `lib/gallery.ts`**

```ts
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
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur mentionnant `lib/gallery.ts`.

- [ ] **Step 3: Vérification manuelle rapide via la console navigateur**

Run: `npm run dev` (en arrière-plan si pas déjà lancé), ouvrir `http://localhost:3000`, ouvrir la console devtools, et exécuter :

```js
const { addGalleryEntry, listGalleryEntries } = await import("/lib/gallery.ts");
```

Cette ligne échouera probablement (les modules TS ne sont pas servis tels quels au navigateur) — ce n'est pas grave : cette étape n'est qu'un sanity check optionnel. La vérification réelle du store se fait en Task 2 (écriture depuis l'app) et Task 4 (lecture depuis `/galerie`). Ne pas bloquer sur cette étape si elle ne fonctionne pas telle quelle ; passer directement à la Task 2.

- [ ] **Step 4: Commit**

```bash
git add lib/gallery.ts
git commit -m "feat: ajouter le store local de galerie (IndexedDB)"
```

---

### Task 2: Sauvegarder chaque génération réussie

**Files:**
- Modify: `app/page.tsx` (import, fonctions `generate` et `generateVideo`)

**Interfaces:**
- Consumes: `addGalleryEntry` (Task 1) — `(entry: { mode: "image"|"video"; resultUrl: string; beforeUrl?: string; label: string }) => Promise<void>`.

- [ ] **Step 1: Importer `addGalleryEntry`**

En haut de `app/page.tsx`, avec les autres imports :

```tsx
import { addGalleryEntry } from "@/lib/gallery";
```

- [ ] **Step 2: Sauvegarder la génération image**

Dans la fonction `generate`, remplacer :

```tsx
      if (data.imageBase64) {
        setResult(
          `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`,
        );
      } else {
        setError("Réponse inattendue du serveur. Réessayez.");
      }
```

par :

```tsx
      if (data.imageBase64) {
        const resultDataUrl = `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`;
        setResult(resultDataUrl);
        addGalleryEntry({
          mode: "image",
          resultUrl: resultDataUrl,
          beforeUrl: prepared.previewUrl,
          label: PRESETS[category].label,
        }).catch((err) => {
          console.error(
            "Impossible de sauvegarder la génération dans la galerie locale.",
            err,
          );
        });
      } else {
        setError("Réponse inattendue du serveur. Réessayez.");
      }
```

- [ ] **Step 3: Sauvegarder la génération vidéo**

Dans la fonction `generateVideo`, remplacer :

```tsx
      if (data.videoUrl) setVideoUrl(data.videoUrl);
      else setVideoError("Réponse inattendue du serveur. Réessayez.");
```

par :

```tsx
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
        addGalleryEntry({
          mode: "video",
          resultUrl: data.videoUrl,
          label: "Remplacement d'objet",
        }).catch((err) => {
          console.error(
            "Impossible de sauvegarder la génération dans la galerie locale.",
            err,
          );
        });
      } else {
        setVideoError("Réponse inattendue du serveur. Réessayez.");
      }
```

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 5: Vérification manuelle**

Dans le navigateur, générer une image (upload + preset + Générer). Une fois le résultat affiché, ouvrir les devtools → Application → IndexedDB → `bluminoo-gallery` → `entries` : une entrée `mode: "image"` doit apparaître. Répéter sur l'onglet Vidéo si possible (nécessite `FAL_KEY`) ; sinon, noter que cette partie sera vérifiée avec la Task 4 du plan `2026-07-29-video-to-video-kling-o1.md`.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: sauvegarder les générations réussies dans la galerie locale"
```

---

### Task 3: Reveal dramatisé (messages rotatifs + animation d'entrée)

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

**Interfaces:** aucune — modifications visuelles autonomes, ne dépendent pas des Tasks 1-2.

- [ ] **Step 1: Ajouter l'animation `reveal` dans `tailwind.config.ts`**

Remplacer :

```ts
      animation: {
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up-delay":
          "fade-up 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
```

par :

```ts
      animation: {
        "fade-up": "fade-up 0.55s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-up-delay":
          "fade-up 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
        reveal: "reveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        reveal: {
          from: { opacity: "0", transform: "translateY(18px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
```

- [ ] **Step 2: Neutraliser `animate-reveal` sous `prefers-reduced-motion`**

Dans `app/globals.css`, remplacer :

```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-up,
  .animate-fade-up-delay {
    animation: none !important;
  }
}
```

par :

```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-up,
  .animate-fade-up-delay,
  .animate-reveal {
    animation: none !important;
  }
}
```

- [ ] **Step 3: Ajouter les messages de chargement rotatifs dans `app/page.tsx`**

Juste avant `export default function Home() {`, ajouter :

```tsx
const GENERATION_LOADING_MESSAGES = [
  "Analyse de la lumière…",
  "Ajustement des reflets…",
  "Intégration du luxe…",
  "Finalisation du rendu…",
];
```

À l'intérieur du composant `Home`, avec les autres `useState`, ajouter :

```tsx
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
```

Avec les autres `useEffect` du composant (par exemple juste après ceux qui gèrent la libération des URLs d'upload vidéo), ajouter :

```tsx
  useEffect(() => {
    if (!loading && !videoLoading) {
      setLoadingMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMessageIndex(
        (i) => (i + 1) % GENERATION_LOADING_MESSAGES.length,
      );
    }, 1800);
    return () => clearInterval(interval);
  }, [loading, videoLoading]);
```

- [ ] **Step 4: Appliquer les messages rotatifs et l'animation au résultat image**

Remplacer :

```tsx
                  {loading ? (
                    <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 lg:min-h-[520px]">
                      <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                      <p className="text-sm text-neutral-400">
                        Rendu photoréaliste en cours…
                      </p>
                    </div>
                  ) : result && prepared ? (
                    <div className="animate-fade-up">
```

par :

```tsx
                  {loading ? (
                    <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 lg:min-h-[520px]">
                      <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                      <p className="text-sm text-neutral-400">
                        {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
                      </p>
                    </div>
                  ) : result && prepared ? (
                    <div className="animate-reveal">
```

- [ ] **Step 5: Ajouter un bloc de chargement vidéo et appliquer l'animation au résultat vidéo**

Remplacer :

```tsx
                {videoError && (
                  <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                    {videoError}
                  </div>
                )}

                {videoUrl && (
                  <section className="mt-8 animate-fade-up">
```

par :

```tsx
                {videoError && (
                  <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                    {videoError}
                  </div>
                )}

                {videoLoading && (
                  <div className="mt-8 flex min-h-[200px] flex-col items-center justify-center gap-4">
                    <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    <p className="text-sm text-neutral-400">
                      {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
                    </p>
                  </div>
                )}

                {videoUrl && (
                  <section className="mt-8 animate-reveal">
```

- [ ] **Step 6: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 7: Vérification manuelle**

Dans le navigateur, lancer une génération image : les messages doivent tourner toutes les ~1,8 s pendant le chargement, puis le résultat apparaît avec l'animation `reveal` (fondu + léger scale-in, plus marqué qu'un simple fondu). Émuler `prefers-reduced-motion: reduce` (DevTools → Rendering) et vérifier qu'aucune animation ne joue.

- [ ] **Step 8: Commit**

```bash
git add tailwind.config.ts app/globals.css app/page.tsx
git commit -m "feat: dramatiser l'attente et l'apparition du résultat"
```

---

### Task 4: Réécrire `/galerie` en vrai historique

**Files:**
- Modify: `app/galerie/page.tsx` (fichier entier remplacé)

**Interfaces:**
- Consumes: `listGalleryEntries` et le type `GalleryEntry` (Task 1) — `() => Promise<GalleryEntry[]>`.

- [ ] **Step 1: Remplacer `app/galerie/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import PlaceholderSection from "@/components/PlaceholderSection";
import { listGalleryEntries, type GalleryEntry } from "@/lib/gallery";

export default function GaleriePage() {
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);

  useEffect(() => {
    listGalleryEntries()
      .then(setEntries)
      .catch((err) => {
        console.error("Impossible de charger la galerie locale.", err);
        setEntries([]);
      });
  }, []);

  if (entries === null) {
    return null;
  }

  if (entries.length === 0) {
    return (
      <PlaceholderSection
        eyebrow="Galerie"
        title="Vos prochaines générations apparaîtront ici."
        description="Chaque génération réussie (image ou vidéo) est automatiquement sauvegardée dans ce navigateur — générez votre première photo ou vidéo pour la voir apparaître."
      />
    );
  }

  return (
    <div className="animate-fade-up mx-auto max-w-6xl py-8">
      <div className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Galerie
        </p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-white">
          Vos dernières générations
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry) => (
          <Panel key={entry.id} className="overflow-hidden">
            {entry.mode === "video" ? (
              <video
                src={entry.resultUrl}
                muted
                loop
                playsInline
                className="aspect-square w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.resultUrl}
                alt={entry.label}
                className="aspect-square w-full object-cover"
              />
            )}
            <div className="p-3">
              <p className="text-xs font-medium text-neutral-200">
                {entry.label}
              </p>
              <p className="text-[11px] text-neutral-600">
                {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Vérification manuelle**

Sans aucune génération sauvegardée (navigateur/IndexedDB vierge), `/galerie` affiche l'état vide avec le nouveau texte. Après avoir généré une image (Task 2 déjà en place), recharger `/galerie` : la génération apparaît dans la grille avec sa miniature, son libellé et sa date.

- [ ] **Step 4: Commit**

```bash
git add app/galerie/page.tsx
git commit -m "feat: afficher l'historique des générations sur /galerie"
```
