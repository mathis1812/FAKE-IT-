# Migration fal.ai → kie.ai (vidéo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fal.ai with kie.ai as the video-generation and image-hosting provider behind `app/api/generate-video/route.ts` and `app/page.tsx`'s upload flow, and remove every fal.ai dependency (code, package, env var, content mention) from the repo.

**Architecture:** One new server route for image hosting (`app/api/kie/upload`), a full rewrite of the video-generation route to call kie.ai's async job API (`createTask` + polling, replacing `fal.subscribe`), a frontend swap of two `fal.storage.upload` calls for the new route, and a cleanup pass removing the fal.ai proxy route, its two npm packages, `FAL_KEY`, and every "fal.ai" content mention.

**Tech Stack:** Next.js 14 App Router, TypeScript, kie.ai REST API (`api.kie.ai`, `kieai.redpandaai.co`).

## Global Constraints

- Git identity on this machine: every commit MUST use
  `git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "..."`
  (no global git config exists).
- No test framework in this project. Verification is
  `npx tsc --noEmit -p tsconfig.json` (expect zero errors) plus the
  specific manual/documentation checks named in each task.
- `KIE_API_KEY` is a brand-new secret — it exists in neither `.env.local`
  nor Vercel yet, and the user's kie.ai account balance is currently 0
  credits. Real end-to-end generation cannot be verified as part of this
  plan; every task's verification is limited to typecheck + code review
  (and, where noted, a request against kie.ai's endpoints that fails only
  on auth/balance, which still proves the code path is reachable and
  correctly shaped). Do not attempt to add `KIE_API_KEY` to `.env.local`
  or Vercel as part of this plan — that's the user's manual step,
  matching how `FAL_KEY`/`GEMINI_API_KEY` were handled in prior plans.
- The `app/api/generate-video` route's external contract does not change:
  still takes `{ sourceImageUrl, objectImageUrl, prompt }` and returns
  `{ videoUrl }` or `{ error }`. No change to `app/api/generate` (Gemini
  image route) — out of scope, see the spec's Non-objectifs.
- Historical spec/plan files under `docs/superpowers/specs/` and
  `docs/superpowers/plans/` are a frozen record of past decisions — never
  edit old ones to reflect the provider change.
- Video output parameters stay identical to today: 5-second duration, no
  audio, "pro" quality mode — this is a provider swap, not a quality
  change.

---

### Task 1: Créer la route d'upload d'image kie.ai

**Files:**
- Create: `app/api/kie/upload/route.ts`

**Interfaces:**
- Consumes: nothing from other tasks (independent).
- Produces: `POST /api/kie/upload` accepting `multipart/form-data` with a
  `file` field, returning `{ fileUrl: string }` on success or
  `{ error: string }` on failure. Task 3 (frontend) calls this exact
  contract.

- [ ] **Step 1: Write the route**

  Create `app/api/kie/upload/route.ts`:

  ```ts
  import { NextRequest, NextResponse } from "next/server";

  export const runtime = "nodejs";

  const KIE_UPLOAD_URL =
    "https://kieai.redpandaai.co/api/file-stream-upload";

  export async function POST(req: NextRequest) {
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Clé API manquante. Définissez KIE_API_KEY dans vos variables d'environnement.",
        },
        { status: 500 },
      );
    }

    let incomingForm: FormData;
    try {
      incomingForm = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Requête invalide : formulaire illisible." },
        { status: 400 },
      );
    }

    const file = incomingForm.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Fichier manquant. Envoyez un champ 'file'." },
        { status: 400 },
      );
    }

    const uploadForm = new FormData();
    uploadForm.append("file", file, file.name);
    uploadForm.append("uploadPath", "fakeit-uploads");

    let res: Response;
    try {
      res = await fetch(KIE_UPLOAD_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: uploadForm,
      });
    } catch {
      return NextResponse.json(
        {
          error:
            "Impossible de contacter le service d'upload. Vérifiez votre connexion et réessayez.",
        },
        { status: 502 },
      );
    }

    let json: {
      success?: boolean;
      msg?: string;
      data?: { fileUrl?: string };
    };
    try {
      json = await res.json();
    } catch {
      return NextResponse.json(
        { error: "Réponse illisible du service d'upload." },
        { status: 502 },
      );
    }

    if (!res.ok || !json.success || !json.data?.fileUrl) {
      return NextResponse.json(
        {
          error: `Échec de l'upload (${res.status}). ${json.msg ?? ""}`.trim(),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ fileUrl: json.data.fileUrl });
  }
  ```

  This mirrors the error-handling style already used in
  `app/api/generate-video/route.ts` (missing-key check, JSON-parse guard,
  upstream-error passthrough).

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output, exit code 0.

- [ ] **Step 3: Manual smoke check (no real key required)**

  Run: `npm run dev`, then in a second terminal:
  `curl -i -X POST http://localhost:3000/api/kie/upload -F "file=@package.json"`
  Expected: HTTP 500 with `{"error":"Clé API manquante...KIE_API_KEY..."}`
  (since `KIE_API_KEY` isn't set locally — see Global Constraints). This
  confirms the route compiles, mounts, and reaches the key check; it does
  not confirm the real kie.ai call, which needs a funded account (out of
  scope for this plan).

- [ ] **Step 4: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/api/kie/upload/route.ts
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: ajouter la route d'upload d'image kie.ai"
  ```

---

### Task 2: Migrer la génération vidéo vers kie.ai

**Files:**
- Modify: `app/api/generate-video/route.ts` (whole file rewrite)

**Interfaces:**
- Consumes: nothing from other tasks (independent of Task 1 — this route
  receives already-hosted image URLs, it doesn't upload anything itself).
- Produces: `app/api/generate-video`'s contract stays
  `{ sourceImageUrl, objectImageUrl, prompt }` → `{ videoUrl }` /
  `{ error }` — unchanged for Task 3/frontend.

- [ ] **Step 1: Confirm the exact kie.ai request/response schema before coding**

  This plan's research (session of 2026-08-07) confirmed the endpoint
  shapes below, but **not** the precise field kie.ai uses to pass a
  reference/object image separately from the source image (i.e. whether
  it's a second entry in a shared `image_urls` array referenced as
  `@Element1` in the prompt, or a distinct `elements` array like fal.ai's
  API). Before writing Step 2, check the live schema at
  https://kie.ai/kling-3-0 (Playground tab → "JSON" toggle next to
  "Form", which shows the exact request body kie.ai sends) and/or
  https://docs.kie.ai (Kling section under "Video Models"). If the
  confirmed shape differs from the fallback in Step 2 below (e.g. a
  separate `elements` field, or a different array key), use the
  confirmed shape instead and say so explicitly in your report — same
  treatment as the verification steps in
  `docs/superpowers/plans/2026-07-30-migration-gemini3-kling3.md` Task 1
  Step 1 / Task 2 Step 1 for this exact repo.

  Also confirm the task-status polling endpoint path (fallback below
  assumes `GET /api/v1/jobs/recordInfo?taskId=...` by REST-sibling
  convention with `POST /api/v1/jobs/createTask`, seen listed as "Get
  Task Details" in the docs.kie.ai sidebar but not opened during this
  plan's research) and the shape of its response when the task succeeds
  (fallback below assumes `data.state` is `"waiting"|"success"|"fail"`
  and `data.resultJson` is a JSON-encoded string containing
  `resultUrls: string[]` on success).

- [ ] **Step 2: Replace the whole file**

  Replace the full contents of `app/api/generate-video/route.ts` with:

  ```ts
  import { NextRequest, NextResponse } from "next/server";

  export const runtime = "nodejs";
  export const maxDuration = 300;

  const KIE_API_BASE = "https://api.kie.ai/api/v1";
  const MODEL_ID = "kling-3.0/video";
  const POLL_INTERVAL_MS = 4_000;
  const POLL_TIMEOUT_MS = 280_000;

  type GenerateVideoBody = {
    sourceImageUrl?: string;
    objectImageUrl?: string;
    prompt?: string;
  };

  type KieCreateTaskResponse = {
    code: number;
    msg?: string;
    data?: { taskId?: string };
  };

  type KieTaskStatusResponse = {
    code: number;
    msg?: string;
    data?: {
      state?: "waiting" | "success" | "fail";
      resultJson?: string;
      failMsg?: string;
    };
  };

  type KieVideoResult = { resultUrls?: string[] };

  async function createKieTask(
    apiKey: string,
    prompt: string,
    imageUrls: string[],
  ): Promise<string> {
    const res = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_ID,
        input: {
          prompt,
          image_urls: imageUrls,
          mode: "pro",
          duration: "5",
          generate_audio: false,
        },
      }),
    });

    const json = (await res.json()) as KieCreateTaskResponse;
    if (!res.ok || json.code !== 200 || !json.data?.taskId) {
      throw new Error(
        json.msg || `Erreur kie.ai (${res.status}) à la création de la tâche.`,
      );
    }
    return json.data.taskId;
  }

  async function pollKieTask(apiKey: string, taskId: string): Promise<string> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const res = await fetch(
        `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      const json = (await res.json()) as KieTaskStatusResponse;

      if (!res.ok || json.code !== 200) {
        throw new Error(
          json.msg || `Erreur kie.ai (${res.status}) en interrogeant la tâche.`,
        );
      }

      if (json.data?.state === "success") {
        const result = JSON.parse(
          json.data.resultJson ?? "{}",
        ) as KieVideoResult;
        const videoUrl = result.resultUrls?.[0];
        if (!videoUrl) {
          throw new Error(
            "La tâche a réussi mais aucune vidéo n'a été renvoyée.",
          );
        }
        return videoUrl;
      }

      if (json.data?.state === "fail") {
        throw new Error(
          json.data.failMsg || "La génération vidéo a échoué côté kie.ai.",
        );
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error("TIMEOUT");
  }

  export async function POST(req: NextRequest) {
    const apiKey = process.env.KIE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Clé API manquante. Définissez KIE_API_KEY dans vos variables d'environnement.",
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

    const { sourceImageUrl, objectImageUrl, prompt } = body;

    if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
      return NextResponse.json(
        { error: "Image source manquante. Uploadez une image puis réessayez." },
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
    const imageUrls = [sourceImageUrl];
    if (objectImageUrl && typeof objectImageUrl === "string") {
      imageUrls.push(objectImageUrl);
      finalPrompt +=
        " Integrate the luxury replacement object shown in @Element1 photorealistically, " +
        "while preserving the subject, pose, lighting and background.";
    }

    try {
      const taskId = await createKieTask(apiKey, finalPrompt, imageUrls);
      const videoUrl = await pollKieTask(apiKey, taskId);
      return NextResponse.json({ videoUrl });
    } catch (err) {
      if (err instanceof Error && err.message === "TIMEOUT") {
        return NextResponse.json(
          {
            error:
              "La génération a dépassé le délai imparti. Réessayez dans quelques instants.",
          },
          { status: 504 },
        );
      }
      const message =
        err instanceof Error
          ? err.message
          : "Erreur inconnue lors de la génération vidéo.";
      return NextResponse.json(
        { error: `Erreur du service vidéo kie.ai. ${message}` },
        { status: 502 },
      );
    }
  }
  ```

  If Step 1 found a different field name for the reference-image
  mechanism (e.g. a separate `elements` array instead of appending to
  `image_urls`), adjust the `input` object and the `imageUrls`/`elements`
  construction accordingly, but keep every other part of this file
  (error handling, status codes, polling loop, timeout handling)
  unchanged.

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output, exit code 0.

- [ ] **Step 4: Manual smoke check (no real key required)**

  Run: `npm run dev`, then:
  `curl -i -X POST http://localhost:3000/api/generate-video -H "Content-Type: application/json" -d "{\"sourceImageUrl\":\"https://example.com/a.jpg\",\"prompt\":\"test\"}"`
  Expected: HTTP 500 with the `KIE_API_KEY manquante` error — confirms
  the route compiles and mounts correctly before any real credentials
  exist.

- [ ] **Step 5: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/api/generate-video/route.ts
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: migrer la génération vidéo de fal.ai vers kie.ai"
  ```

---

### Task 3: Basculer le frontend vers la nouvelle route d'upload

**Files:**
- Modify: `app/page.tsx:1-10` (imports + `fal.config`)
- Modify: `app/page.tsx:476-479` (upload calls)

**Interfaces:**
- Consumes: `POST /api/kie/upload` from Task 1 (`{ fileUrl }` /
  `{ error }` contract).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Remove the fal.ai client import and config**

  Change `app/page.tsx:1-10` from:

  ```tsx
  "use client";

  import { fal } from "@fal-ai/client";
  import { useCallback, useEffect, useRef, useState } from "react";
  import Panel from "@/components/Panel";
  import { addGalleryEntry } from "@/lib/gallery";

  fal.config({
    proxyUrl: "/api/fal/proxy",
  });
  ```

  to:

  ```tsx
  "use client";

  import { useCallback, useEffect, useRef, useState } from "react";
  import Panel from "@/components/Panel";
  import { addGalleryEntry } from "@/lib/gallery";
  ```

- [ ] **Step 2: Add an upload helper and use it**

  Add this function above the component (or in the same file, near the
  other module-level helpers — check the file for an existing spot such
  as near `validateImageFile`; if none is obvious, place it directly
  above the component definition):

  ```tsx
  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/kie/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.fileUrl) {
      throw new Error(data?.error || "Échec de l'upload de l'image.");
    }
    return data.fileUrl as string;
  }
  ```

  Change `app/page.tsx:476-479` from:

  ```tsx
      const sourceImageUrl = await fal.storage.upload(videoSource.file);
      const objectImageUrl = videoObject
        ? await fal.storage.upload(videoObject.file)
        : undefined;
  ```

  to:

  ```tsx
      const sourceImageUrl = await uploadImage(videoSource.file);
      const objectImageUrl = videoObject
        ? await uploadImage(videoObject.file)
        : undefined;
  ```

  This call is already inside the existing `try { ... } catch` block in
  `generateVideo` (see the surrounding code) — an upload failure will be
  caught the same way a `fetch` failure is today; no new error-handling
  path is needed. If the existing `catch` block's error message is
  generic, that's pre-existing behavior and out of scope for this task.

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/page.tsx
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: basculer l'upload d'image vers kie.ai"
  ```

---

### Task 4: Nettoyage — retirer fal.ai du repo et mettre à jour le contenu

**Files:**
- Delete: `app/api/fal/proxy/route.ts`
- Modify: `package.json:14-15`
- Modify: `app/a-propos/page.tsx:43-46`
- Modify: `app/page.tsx:822-824` (line number shifts slightly after Task 3's edits — locate by content, not exact line)
- Modify: `README.md` (lines listed below)

**Interfaces:**
- Consumes: nothing new — this task only makes sense after Tasks 1-3
  have removed every code reference to fal.ai (otherwise deleting the
  proxy route or the packages would break the build).
- Produces: nothing consumed by other tasks (terminal cleanup task).

- [ ] **Step 1: Delete the fal.ai proxy route**

  Delete the file `app/api/fal/proxy/route.ts`. If the parent directory
  `app/api/fal/` is now empty, it can be left — Next.js ignores empty
  directories, no action needed.

- [ ] **Step 2: Remove the fal.ai npm dependencies**

  Change `package.json:13-17` from:

  ```json
    "dependencies": {
      "@fal-ai/client": "^1.10.1",
      "@fal-ai/server-proxy": "^1.2.1",
      "@supabase/ssr": "^0.12.4",
      "@supabase/supabase-js": "^2.111.0",
  ```

  to:

  ```json
    "dependencies": {
      "@supabase/ssr": "^0.12.4",
      "@supabase/supabase-js": "^2.111.0",
  ```

  Then run: `npm install`
  Expected: `package-lock.json` updates to drop `@fal-ai/client` and
  `@fal-ai/server-proxy` and their now-unused transitive dependencies;
  exit code 0.

- [ ] **Step 3: Update `app/a-propos/page.tsx`**

  Change lines 43-46 from:

  ```tsx
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Propulsé par Google Gemini 3 Pro Image pour l&apos;image, et
            Kling 3.0 Pro (via fal.ai) pour la vidéo.
          </p>
  ```

  to:

  ```tsx
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Propulsé par Google Gemini 3 Pro Image pour l&apos;image, et
            Kling 3.0 Pro (via kie.ai) pour la vidéo.
          </p>
  ```

- [ ] **Step 4: Update `app/page.tsx`**

  Find the line containing `Kling 3.0 Pro via fal.ai` (was line 823
  before Task 3's edits shifted line numbers slightly — search for the
  exact string instead of relying on the line number) and change it
  from:

  ```tsx
              ~5 s de vidéo · génération ~90 s · Kling 3.0 Pro via fal.ai
  ```

  to:

  ```tsx
              ~5 s de vidéo · génération ~90 s · Kling 3.0 Pro via kie.ai
  ```

- [ ] **Step 5: Update `README.md`**

  Change line 8 from:

  ```markdown
  Propulsée par **Google Gemini 3 Pro Image**, **fal.ai Kling 3.0 Pro**, Next.js 14
  ```

  to:

  ```markdown
  Propulsée par **Google Gemini 3 Pro Image**, **kie.ai Kling 3.0 Pro**, Next.js 14
  ```

  Change line 23 from:

  ```markdown
  ### Vidéo — Remplacer un Objet (fal.ai)
  ```

  to:

  ```markdown
  ### Vidéo — Remplacer un Objet (kie.ai)
  ```

  Change line 27 from:

  ```markdown
  - Upload sécurisé via proxy fal (`/api/fal/proxy`) — `FAL_KEY` jamais exposée au client
  ```

  to:

  ```markdown
  - Upload sécurisé via `/api/kie/upload` — `KIE_API_KEY` jamais exposée au client
  ```

  Change line 32 from:

  ```markdown
  - fal.ai : [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)
  ```

  to:

  ```markdown
  - kie.ai : [kie.ai/api-key](https://kie.ai/api-key)
  ```

  Change line 44 from:

  ```markdown
  FAL_KEY=votre_cle_fal
  ```

  to:

  ```markdown
  KIE_API_KEY=votre_cle_kie
  ```

  Change line 91 from:

  ```markdown
  FAL_KEY = votre_cle_fal
  ```

  to:

  ```markdown
  KIE_API_KEY = votre_cle_kie
  ```

  Change lines 101-103 from:

  ```markdown
  - Image Gemini 3 Pro Image : environ **~0,15 $ / image** (résolution standard)
  - Vidéo Kling 3.0 Pro (fal) : environ **~1,68 $ / 10 s avec audio**, soit
    **~0,84 $ pour 5 s** (l'app génère sans audio par défaut, coût réel
    probablement inférieur à cette estimation)
  ```

  to:

  ```markdown
  - Image Gemini 3 Pro Image : environ **~0,15 $ / image** (résolution standard)
  - Vidéo Kling 3.0 Pro (kie.ai, mode pro sans audio) : environ **~0,45 $
    pour 5 s** (tarif kie.ai, ~20 % sous le prix officiel/fal.ai)
  ```

  Change lines 116-117 from:

  ```markdown
  - `FAL_KEY` : utilisée côté serveur (`app/api/generate-video` + proxy
    `app\api\fal\proxy`) — le client appelle fal via `proxyUrl: "/api/fal/proxy"`
  ```

  to:

  ```markdown
  - `KIE_API_KEY` : utilisée côté serveur uniquement
    (`app/api/generate-video`, `app/api/kie/upload`) — jamais exposée au
    client
  ```

- [ ] **Step 6: Typecheck and build**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output, exit code 0.

  Run: `npm run build`
  Expected: build succeeds (this is the real gate for catching issues
  `tsc --noEmit` alone would miss, per this repo's established lesson
  from prior chantiers — e.g. an unused import or a dangling reference to
  a removed package would surface here).

- [ ] **Step 7: Grep for leftover mentions**

  Run: `grep -rn "fal.ai\|FAL_KEY\|@fal-ai" app lib README.md package.json`
  Expected: no output (empty grep result) — confirms no stray mention was
  missed. If anything appears, fix it before committing.

- [ ] **Step 8: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add -A
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "chore: retirer fal.ai du repo (proxy, dépendances, mentions)"
  ```

---

## Après ce plan (hors scope, actions manuelles utilisateur)

- Ajouter des crédits sur le compte kie.ai (solde actuellement à 0).
- Ajouter `KIE_API_KEY` dans `.env.local` (local) et dans Vercel
  (Production + Preview).
- Tester une génération vidéo réelle avec et sans photo de référence,
  comparer visuellement à un rendu fal.ai précédent si possible (voir la
  section Vérification de la spec).
