# Migration Gemini 3 Pro Image + Kling 3.0 Pro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Gemini 2.5 Flash Image and Kling O3 with Gemini 3 Pro Image and Kling 3.0 Pro in Bluminoo Studio's two generation routes, fix the video route's object-reference handling to use Kling 3.0's real `elements` API instead of embedding a URL in the prompt text, remove the footer tech badge, and update every content mention of the old model names.

**Architecture:** Two isolated 1-file backend changes (model identifier swap + a payload restructuring for video), one small UI removal, and one content-consistency pass across three files. No new dependencies, no frontend contract changes, no database/schema involvement.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@fal-ai/client`, Gemini REST API (`generativelanguage.googleapis.com`).

## Global Constraints

- Git identity on this machine: every commit MUST use
  `git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "..."`
  (no global git config exists).
- No test framework in this project. Verification is
  `npx tsc --noEmit -p tsconfig.json` (expect zero errors) plus the
  specific manual/documentation checks named in each task.
- `GEMINI_API_KEY` and `FAL_KEY` are NOT set in the local `.env.local` in
  this worktree (confirmed empty) — full live end-to-end generation
  cannot be tested locally in this plan. Both keys ARE already configured
  in Vercel (Production and Preview), so real verification happens via a
  Vercel preview deploy, not `npm run dev` locally. Do not attempt to
  populate `.env.local` with real keys as part of this plan.
- The two API routes' external contracts do not change: `app/api/generate`
  still takes `{ imageBase64, mimeType, prompt }` and returns
  `{ imageBase64, mimeType }` or `{ error }`; `app/api/generate-video`
  still takes `{ sourceImageUrl, objectImageUrl, prompt }` and returns
  `{ videoUrl }` or `{ error }`. No frontend file (`app/page.tsx`'s form
  logic) changes in this plan.
- Historical spec/plan files under `docs/superpowers/specs/` and
  `docs/superpowers/plans/` are a frozen record of past decisions — never
  edit old ones to reflect the new model names.
- No footer badge replacement — the footer element is removed entirely,
  not replaced with new text.

---

### Task 1: Migrer la génération d'image vers Gemini 3 Pro Image

**Files:**
- Modify: `app/api/generate/route.ts:6-7`

**Interfaces:**
- Consumes: nothing from other tasks (independent).
- Produces: nothing consumed by other tasks — Task 2 touches a different
  file entirely.

- [ ] **Step 1: Confirm the current Gemini 3 Pro Image model identifier**

  Before editing, check the current identifier for Gemini 3 Pro Image
  ("Nano Banana Pro") at https://ai.google.dev/gemini-api/docs/models
  (or https://aistudio.google.com/models/gemini-3-pro-image). As of this
  plan's writing, the identifier used in Google's own documentation is
  `gemini-3-pro-image-preview` — it is still a "preview" name and may
  have changed. If the confirmed identifier differs from
  `gemini-3-pro-image-preview`, use the confirmed one in Step 2 instead,
  and say so explicitly in your report (which string you found and where).
  If the docs are unreachable, proceed with `gemini-3-pro-image-preview`
  and flag this assumption clearly in your report instead of guessing
  further.

- [ ] **Step 2: Replace the model URL**

  Change `app/api/generate/route.ts:6-7` from:

  ```ts
  const GEMINI_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";
  ```

  to:

  ```ts
  const GEMINI_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";
  ```

  (substitute the confirmed identifier from Step 1 if it differs). Do not
  change anything else in this file — the request body shape
  (`contents[0].parts`), the `inlineData`/`inline_data` extraction logic,
  the retry-on-no-image loop, and all error handling stay exactly as they
  are; this is the same Gemini `generateContent` REST family, only the
  model name changes.

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output, exit code 0 (a string-literal change cannot break
  types, but run it to confirm the file still compiles cleanly).

- [ ] **Step 4: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/api/generate/route.ts
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: migrer la génération image vers Gemini 3 Pro Image"
  ```

---

### Task 2: Migrer la génération vidéo vers Kling 3.0 Pro et corriger la photo de référence

**Files:**
- Modify: `app/api/generate-video/route.ts` (whole file — see below for
  the exact new content of the changed sections)

**Interfaces:**
- Consumes: nothing from other tasks (independent).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Confirm the `elements` field shape for Kling 3.0 Pro**

  Before editing, check
  https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/api for
  the exact input schema of the `elements` field (this page returned
  HTTP 429 during this plan's research — if it still does, try fal.ai's
  in-browser "API" tab/Playground schema viewer for this model instead,
  or inspect the TypeScript types shipped by the installed `@fal-ai/client`
  version in `node_modules/@fal-ai/client` for this model's input type).
  As of this plan's writing, the documented shape is: `elements` is an
  array where each entry has at least an `image_url` field (string, the
  reference image URL), and elements are referenced in the prompt text
  as `@Element1`, `@Element2`, etc. If the confirmed shape differs
  (e.g. a different field name than `image_url`, or additional required
  fields), use the confirmed shape in Step 2 instead, and say so
  explicitly in your report.

- [ ] **Step 2: Replace the model ID, add the `KlingElement` type, and build `elements`**

  Change `app/api/generate-video/route.ts:7` from:

  ```ts
  const MODEL_ID = "fal-ai/kling-video/o3/standard/image-to-video";
  ```

  to:

  ```ts
  const MODEL_ID = "fal-ai/kling-video/v3/pro/image-to-video";
  ```

  Add this type near the other type declarations (after `FalVideoResult`,
  around line 18):

  ```ts
  type KlingElement = { image_url: string };
  ```

  Change the prompt-building block (currently lines 65-70) from:

  ```ts
  let finalPrompt = prompt.trim();
  if (objectImageUrl && typeof objectImageUrl === "string") {
    finalPrompt +=
      ` Use the luxury replacement object from this reference image as visual guidance: ${objectImageUrl}. ` +
      "Integrate it photorealistically while preserving the subject, pose, lighting and background.";
  }
  ```

  to:

  ```ts
  let finalPrompt = prompt.trim();
  const elements: KlingElement[] = [];
  if (objectImageUrl && typeof objectImageUrl === "string") {
    elements.push({ image_url: objectImageUrl });
    finalPrompt +=
      " Integrate the luxury replacement object shown in @Element1 photorealistically, " +
      "while preserving the subject, pose, lighting and background.";
  }
  ```

  Change the `fal.subscribe` call (currently lines 75-83) from:

  ```ts
  const result = (await fal.subscribe(MODEL_ID, {
    input: {
      image_url: sourceImageUrl,
      prompt: finalPrompt,
      duration: "5",
      generate_audio: false,
    },
    logs: true,
  })) as FalVideoResult;
  ```

  to:

  ```ts
  const result = (await fal.subscribe(MODEL_ID, {
    input: {
      image_url: sourceImageUrl,
      prompt: finalPrompt,
      duration: "5",
      generate_audio: false,
      ...(elements.length > 0 ? { elements } : {}),
    },
    logs: true,
  })) as FalVideoResult;
  ```

  This keeps the payload identical to today when there's no reference
  photo (no `elements` key at all), and adds it only when
  `objectImageUrl` is present — mirroring the existing conditional
  pattern for the prompt text. Do not change anything else in this file
  (the `falKey` check, body parsing/validation, `extractVideoUrl`, error
  handling, `duration`/`generate_audio` values).

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/api/generate-video/route.ts
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: migrer la génération vidéo vers Kling 3.0 Pro avec elements"
  ```

---

### Task 3: Supprimer le badge footer

**Files:**
- Modify: `app/layout.tsx:37-42`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Remove the footer element**

  Change `app/layout.tsx:37-42` from:

  ```tsx
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
              {children}
              <footer className="mt-12 text-center text-[11px] uppercase tracking-[0.18em] text-neutral-700">
                Gemini Flash Image · Kling O3 · React Bits
              </footer>
            </main>
  ```

  to:

  ```tsx
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
              {children}
            </main>
  ```

  Do not add any replacement text or element — the user explicitly asked
  for the badge to be gone, not swapped for new model names.

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/layout.tsx
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "fix: supprimer le badge footer des technologies utilisées"
  ```

---

### Task 4: Mettre à jour les mentions de modèles dans le contenu

**Files:**
- Modify: `app/a-propos/page.tsx:43-46`
- Modify: `app/page.tsx:823`
- Modify: `README.md:8`, `README.md:26`, `README.md:101-102`

**Interfaces:**
- Consumes: nothing from other tasks (purely textual, independent of
  Tasks 1-3's code changes).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Update `app/a-propos/page.tsx`**

  Change lines 43-46 from:

  ```tsx
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Propulsé par Google Gemini 2.5 Flash Image pour l&apos;image, et
            Kling O3 (via fal.ai) pour la vidéo.
          </p>
  ```

  to:

  ```tsx
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Propulsé par Google Gemini 3 Pro Image pour l&apos;image, et
            Kling 3.0 Pro (via fal.ai) pour la vidéo.
          </p>
  ```

- [ ] **Step 2: Update `app/page.tsx`**

  Change line 823 from:

  ```tsx
              ~5 s de vidéo · génération ~90 s · Kling O3 via fal.ai
  ```

  to:

  ```tsx
              ~5 s de vidéo · génération ~90 s · Kling 3.0 Pro via fal.ai
  ```

  Do not change the "~90 s" estimate — there is no live-testing data in
  this plan to justify adjusting it (see Global Constraints: no API keys
  available locally).

- [ ] **Step 3: Update `README.md`**

  Change line 8 from:

  ```markdown
  Propulsée par **Google Gemini 2.5 Flash Image**, **fal.ai Kling O3**, Next.js 14
  ```

  to:

  ```markdown
  Propulsée par **Google Gemini 3 Pro Image**, **fal.ai Kling 3.0 Pro**, Next.js 14
  ```

  Change line 26 from:

  ```markdown
  - Génération d'une courte vidéo (~5 s) via Kling O3 image-to-video
  ```

  to:

  ```markdown
  - Génération d'une courte vidéo (~5 s) via Kling 3.0 Pro image-to-video
  ```

  Change lines 101-102 from:

  ```markdown
  - Image Gemini Flash : environ **~0,04 $ / image**
  - Vidéo Kling O3 (fal) : environ **~0,084 $ / sec** (~0,42 $ pour 5 s)
  ```

  to:

  ```markdown
  - Image Gemini 3 Pro Image : environ **~0,15 $ / image** (résolution standard)
  - Vidéo Kling 3.0 Pro (fal) : environ **~1,68 $ / 10 s avec audio**, soit
    **~0,84 $ pour 5 s** (l'app génère sans audio par défaut, coût réel
    probablement inférieur à cette estimation)
  ```

- [ ] **Step 4: Typecheck**

  Run: `npx tsc --noEmit -p tsconfig.json`
  Expected: no output, exit code 0 (this task only touches `.tsx`/`.md`
  text content, but running it confirms no stray syntax error was
  introduced in the JSX edits).

- [ ] **Step 5: Commit**

  ```bash
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" add app/a-propos/page.tsx app/page.tsx README.md
  git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "docs: mettre à jour les mentions de modèles (Gemini 3 Pro Image, Kling 3.0 Pro)"
  ```
