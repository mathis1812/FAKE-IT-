# Passage à Kling O1 video-to-video — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le modèle de génération vidéo par `fal-ai/kling-video/o1/video-to-video/edit`, pour que le champ "vidéo source" accepte une vraie vidéo (MP4/MOV, max 200 Mo) au lieu d'une photo.

**Architecture:** Un seul commit couvrant `app/api/generate-video/route.ts` (nouveau modèle + nouveau schéma d'input) et `app/page.tsx` (validation vidéo, DropZone reconfigurable, appel API mis à jour) — les deux côtés doivent changer ensemble pour ne pas casser la génération.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@fal-ai/client`.

## Global Constraints

- Le schéma d'entrée exact de Kling O1 n'est **pas confirmé** (fal.ai bloque les accès docs, 429 partout). Les noms de champs ci-dessous (`video_url`, `image_urls`, `prompt`) sont la meilleure hypothèse, à valider au premier appel réel — voir Task 1 Step 8.
- `MAX_VIDEO_FILE_BYTES = 200 * 1024 * 1024`, formats acceptés pour la vidéo source : `video/mp4`, `video/quicktime`.
- Le champ "Objet (optionnel)" reste une image (`image/*`, max 10 Mo, `validateImageFile` inchangé).
- `maxDuration = 300` sur la route reste inchangé (non-objectif de ce plan).
- L'onglet Image n'est pas touché.
- Pas de framework de tests dans ce projet. Vérification via `npx tsc --noEmit -p tsconfig.json` + test manuel navigateur + un appel réel à l'API (voir Task 1 Step 8).

---

## Fichiers concernés

- Modifier : `app/api/generate-video/route.ts` (modèle + schéma d'input)
- Modifier : `app/page.tsx` (validation, `DropZone`, `pickVideoUpload`, `generateVideo`, JSX des deux `DropZone` de l'onglet Vidéo)

---

### Task 1: Migrer vers Kling O1 video-to-video

**Files:**
- Modify: `app/api/generate-video/route.ts` (fichier entier)
- Modify: `app/page.tsx` (plusieurs zones précises, listées ci-dessous)

**Interfaces:**
- Consumes: `fal.subscribe` du client `@fal-ai/client` (déjà importé/configuré côté serveur dans `route.ts`), `fal.storage.upload` côté client (déjà utilisé dans `app/page.tsx`).
- Produces: rien consommé par une autre tâche — ce plan n'a qu'une seule tâche.

- [ ] **Step 1: Remplacer `app/api/generate-video/route.ts`**

```ts
import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL_ID = "fal-ai/kling-video/o1/video-to-video/edit";

type GenerateVideoBody = {
  sourceVideoUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
};

type FalVideoResult = {
  data?: { video?: { url?: string } };
  video?: { url?: string };
};

function extractVideoUrl(result: FalVideoResult): string | null {
  return result?.data?.video?.url ?? result?.video?.url ?? null;
}

export async function POST(req: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      {
        error:
          "Clé FAL manquante. Définissez FAL_KEY dans vos variables d'environnement.",
      },
      { status: 500 },
    );
  }

  let body: GenerateVideoBody;
  try {
    body = (await req.json()) as GenerateVideoBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const { sourceVideoUrl, objectImageUrl, prompt } = body;

  if (!sourceVideoUrl || typeof sourceVideoUrl !== "string") {
    return NextResponse.json(
      { error: "Vidéo source manquante. Uploadez une vidéo puis réessayez." },
      { status: 400 },
    );
  }

  if (!prompt || !prompt.trim()) {
    return NextResponse.json(
      {
        error:
          "Prompt manquant. Décrivez le remplacement d'objet à réaliser dans la vidéo.",
      },
      { status: 400 },
    );
  }

  let finalPrompt = prompt.trim();
  const input: Record<string, unknown> = {
    video_url: sourceVideoUrl,
    prompt: finalPrompt,
  };

  if (objectImageUrl && typeof objectImageUrl === "string") {
    finalPrompt +=
      " Replace the target luxury object in the video with @Element1, " +
      "preserving the original motion, camera angles, lighting and background.";
    input.prompt = finalPrompt;
    input.image_urls = [objectImageUrl];
  }

  try {
    fal.config({ credentials: falKey });

    const result = (await fal.subscribe(MODEL_ID, {
      input,
      logs: true,
    })) as FalVideoResult;

    const videoUrl = extractVideoUrl(result);
    if (!videoUrl) {
      return NextResponse.json(
        {
          error:
            "Le service vidéo n'a pas renvoyé d'URL. Réessayez dans quelques instants.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ videoUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur inconnue lors de la génération vidéo.";
    return NextResponse.json(
      {
        error: `Erreur du service vidéo fal.ai. ${message}`,
      },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Ajouter `MAX_VIDEO_FILE_BYTES` et `validateVideoFile` dans `app/page.tsx`**

Juste après la déclaration existante de `MAX_FILE_BYTES`/`COMPRESS_THRESHOLD_BYTES`/`MAX_DIMENSION`/`JPEG_QUALITY` (haut du fichier), ajouter :

```ts
const MAX_VIDEO_FILE_BYTES = 200 * 1024 * 1024;
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
```

Puis, juste après la fonction existante `validateImageFile`, ajouter :

```ts
function validateVideoFile(file: File): string | null {
  if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    return "Fichier non pris en charge. Veuillez sélectionner une vidéo MP4 ou MOV.";
  }
  if (file.size > MAX_VIDEO_FILE_BYTES) {
    return "Fichier trop volumineux (max 200 Mo).";
  }
  return null;
}
```

- [ ] **Step 3: Rendre `DropZone` configurable (accept + formatHint) et ajouter l'aperçu vidéo**

Remplacer entièrement la fonction `DropZone` (de `function DropZone({` jusqu'à l'accolade fermante qui la termine) par :

```tsx
function DropZone({
  label,
  hint,
  accept,
  formatHint,
  upload,
  onPick,
  disabled,
}: {
  label: string;
  hint: string;
  accept: string;
  formatHint: string;
  upload: VideoUpload | null;
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const isVideoUpload = upload?.file.type.startsWith("video/") ?? false;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = e.dataTransfer.files?.[0];
          if (file) onPick(file);
        }}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`cursor-pointer rounded-2xl border border-dashed p-5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
          dragging
            ? "border-primary/70 bg-primary/5"
            : "border-white/10 bg-white/[0.02] hover:border-white/20"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onPick(file);
          }}
        />
        {upload ? (
          <div className="flex flex-col items-center gap-3">
            {isVideoUpload ? (
              <video
                src={upload.previewUrl}
                controls
                className="max-h-40 rounded-lg"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={upload.previewUrl}
                alt={label}
                className="max-h-40 rounded-lg object-contain"
              />
            )}
            <p className="text-xs text-neutral-500">{upload.name}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="text-sm font-medium text-neutral-200">{hint}</p>
            <p className="text-xs text-neutral-600">{formatHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mettre à jour `pickVideoUpload` pour valider différemment source et objet**

Remplacer :

```tsx
  const pickVideoUpload = useCallback(
    async (file: File, kind: "source" | "object") => {
      setVideoError("");
      setVideoUrl("");
      const validationError = validateImageFile(file);
      if (validationError) {
        setVideoError(validationError);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const upload: VideoUpload = { file, previewUrl, name: file.name };
      if (kind === "source") setVideoSource(upload);
      else setVideoObject(upload);
    },
    [],
  );
```

par :

```tsx
  const pickVideoUpload = useCallback(
    async (file: File, kind: "source" | "object") => {
      setVideoError("");
      setVideoUrl("");
      const validationError =
        kind === "source" ? validateVideoFile(file) : validateImageFile(file);
      if (validationError) {
        setVideoError(validationError);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const upload: VideoUpload = { file, previewUrl, name: file.name };
      if (kind === "source") setVideoSource(upload);
      else setVideoObject(upload);
    },
    [],
  );
```

- [ ] **Step 5: Mettre à jour `generateVideo` et le JSX des deux `DropZone`**

Dans `generateVideo`, remplacer :

```tsx
  const generateVideo = useCallback(async () => {
    if (!videoSource) {
      setVideoError("Veuillez uploader une image source.");
      return;
    }
```

par :

```tsx
  const generateVideo = useCallback(async () => {
    if (!videoSource) {
      setVideoError("Veuillez uploader une vidéo source.");
      return;
    }
```

Puis, toujours dans `generateVideo`, remplacer :

```tsx
      const sourceImageUrl = await fal.storage.upload(videoSource.file);
      const objectImageUrl = videoObject
        ? await fal.storage.upload(videoObject.file)
        : undefined;
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageUrl, objectImageUrl, prompt }),
      });
```

par :

```tsx
      const sourceVideoUrl = await fal.storage.upload(videoSource.file);
      const objectImageUrl = videoObject
        ? await fal.storage.upload(videoObject.file)
        : undefined;
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceVideoUrl, objectImageUrl, prompt }),
      });
```

Enfin, dans le JSX de l'onglet Vidéo, remplacer les deux `DropZone` :

```tsx
              <DropZone
                label="Image source (requis)"
                hint="Votre photo / scène"
                upload={videoSource}
                onPick={(file) => void pickVideoUpload(file, "source")}
                disabled={videoLoading}
              />
              <DropZone
                label="Objet (optionnel)"
                hint="Référence luxe"
                upload={videoObject}
                onPick={(file) => void pickVideoUpload(file, "object")}
                disabled={videoLoading}
              />
```

par :

```tsx
              <DropZone
                label="Vidéo source (requise)"
                hint="Votre vidéo source"
                accept="video/mp4,video/quicktime"
                formatHint="MP4, MOV — max 200 Mo"
                upload={videoSource}
                onPick={(file) => void pickVideoUpload(file, "source")}
                disabled={videoLoading}
              />
              <DropZone
                label="Objet (optionnel)"
                hint="Référence luxe"
                accept="image/*"
                formatHint="JPG, PNG, WebP — max 10 Mo"
                upload={videoObject}
                onPick={(file) => void pickVideoUpload(file, "object")}
                disabled={videoLoading}
              />
```

- [ ] **Step 6: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 7: Vérifier l'upload/validation dans le navigateur (sans appel réel à l'API)**

Run: `npm run dev` (en arrière-plan si pas déjà lancé)

Dans le navigateur, onglet Vidéo :
- Uploader un fichier `.mp4` comme "Vidéo source" : accepté, aperçu avec lecteur vidéo (`<video controls>`).
- Uploader un fichier image comme "Vidéo source" : rejeté avec le message "Fichier non pris en charge. Veuillez sélectionner une vidéo MP4 ou MOV.".
- Uploader une image comme "Objet (optionnel)" : comportement inchangé (aperçu image).
- Revenir sur l'onglet Image : inchangé.

- [ ] **Step 8: Valider le schéma réel de Kling O1 (nécessite `FAL_KEY`)**

Ce dépôt local n'a pas de `.env.local` avec `FAL_KEY` configurée (vérifié : absent). Le premier vrai appel à `fal-ai/kling-video/o1/video-to-video/edit` doit donc être testé soit :

- localement, si l'utilisateur configure `FAL_KEY` dans `.env.local` et relance `npm run dev`, soit
- via un **déploiement preview Vercel** (`vercel deploy`, sans `--prod`) — l'environnement Vercel a déjà `FAL_KEY` configurée (cf. `README.md`, section Variables d'environnement). Un déploiement preview permet de tester l'appel réel sans affecter la production tant que le schéma n'est pas confirmé.

Faire un essai complet (upload vidéo + prompt + génération) sur l'un de ces deux environnements. Si fal.ai renvoie une erreur de validation de schéma (ex. "video_url is required" ou un nom de champ différent), lire le message d'erreur exact, corriger le(s) nom(s) de champ dans `app/api/generate-video/route.ts`, revérifier avec `npx tsc --noEmit`, et refaire l'essai jusqu'à ce que la génération aboutisse.

- [ ] **Step 9: Commit**

```bash
git add app/api/generate-video/route.ts app/page.tsx
git commit -m "feat: passer la génération vidéo à Kling O1 video-to-video"
```
