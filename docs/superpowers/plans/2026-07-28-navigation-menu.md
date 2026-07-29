# Menu de navigation principal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un menu de navigation principal (Accueil, Galerie, Tarifs, À propos) à Bluminoo Studio, avec un header et un fond animé partagés entre toutes les pages, et un tiroir mobile pour les petits écrans.

**Architecture:** Le chrome partagé (fond animé + header) migre de `app/page.tsx` vers `app/layout.tsx`. Deux nouveaux composants client (`StudioBackdrop`, `SiteHeader`) encapsulent respectivement le rendu WebGL et la navigation. Trois nouvelles routes App Router (`/galerie`, `/tarifs`, `/a-propos`) réutilisent un composant de présentation partagé (`PlaceholderSection`).

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, React 18, three.js (fonds `DotField`/`ColorBends` existants, inchangés).

## Global Constraints

- Routes exactes : `/` (Accueil/Studio, existant), `/galerie`, `/tarifs`, `/a-propos`.
- Libellés de nav exacts : "Accueil", "Galerie", "Tarifs", "À propos".
- Aucun stockage réel d'historique, aucun système de crédits/facturation, aucune authentification (pages placeholder uniquement) — spec `docs/superpowers/specs/2026-07-28-navigation-menu-design.md`.
- Style : réutiliser `Panel` (composant existant), l'accent `primary` (violet), la police `font-display` pour les titres — aucun nouveau système visuel.
- **Pas de framework de tests dans ce projet** (aucun `jest`/`vitest`/`playwright` dans `package.json` — confirmé, scripts existants : `dev`, `build`, `start`, `lint`). Conformément à la spec approuvée, la vérification de chaque tâche se fait via `curl` contre le serveur de dev (`npm run dev`, port 3000) pour les vérifications de contenu/markup, et une vérification manuelle au navigateur pour les comportements interactifs (tiroir mobile, focus, viewport). Ce n'est pas un TDD classique faute d'infrastructure existante — introduire un framework de test complet ne fait pas partie de ce chantier (hors scope, cf. spec).
- Alias d'import `@/*` déjà configuré dans `tsconfig.json` → racine du projet (ex. `@/components/Panel`).

---

## Fichiers concernés

- Créer : `components/StudioBackdrop.tsx`
- Créer : `components/SiteHeader.tsx`
- Créer : `components/PlaceholderSection.tsx`
- Créer : `app/galerie/page.tsx`
- Créer : `app/tarifs/page.tsx`
- Créer : `app/a-propos/page.tsx`
- Modifier : `app/layout.tsx`
- Modifier : `app/page.tsx`

---

### Task 1: Extraire le fond animé dans `StudioBackdrop`

**Files:**
- Create: `components/StudioBackdrop.tsx`
- Test: vérification manuelle/curl (pas de fichier de test dédié — voir Global Constraints)

**Interfaces:**
- Consumes: `DotField` (default export, `@/components/react-bits/DotField`), `ColorBends` (default export, `@/components/react-bits/ColorBends`) — signatures déjà en place, inchangées.
- Produces: `StudioBackdrop` — composant sans props, `export default function StudioBackdrop(): JSX.Element`. Les tâches suivantes (Task 5) l'importent et le rendent tel quel dans `app/layout.tsx`.

Ce composant reprend **exactement** le bloc `studio-backdrop`/`studio-vignette` actuellement en haut du `return` de `app/page.tsx`, avec les imports `dynamic` et la constante `BEND_COLOR` qui l'accompagnent. Aucune valeur de prop ne change.

- [ ] **Step 1: Créer le fichier `components/StudioBackdrop.tsx`**

```tsx
"use client";

import dynamic from "next/dynamic";

const DotField = dynamic(() => import("@/components/react-bits/DotField"), {
  ssr: false,
});

const ColorBends = dynamic(
  () => import("@/components/react-bits/ColorBends"),
  { ssr: false },
);

const BEND_COLOR = "#A855F7";

/** Fond animé partagé (DotField + ColorBends), rendu une seule fois dans le layout racine. */
export default function StudioBackdrop() {
  return (
    <>
      <div className="studio-backdrop" aria-hidden>
        <div className="absolute inset-0">
          <DotField
            dotRadius={1.5}
            dotSpacing={14}
            cursorRadius={500}
            cursorForce={0.1}
            bulgeOnly
            bulgeStrength={67}
            glowRadius={160}
            sparkle={false}
            waveAmplitude={0}
          />
        </div>
        <div className="absolute inset-0">
          <ColorBends
            color={BEND_COLOR}
            rotation={90}
            speed={0.2}
            scale={1}
            frequency={1}
            warpStrength={1}
            yOffset={0.3}
            mouseInfluence={0.3}
            noise={0.15}
            iterations={1}
            intensity={1.3}
            bandWidth={0.14}
            fadeTop={0.75}
          />
        </div>
      </div>
      <div className="studio-vignette" aria-hidden />
    </>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur mentionnant `StudioBackdrop.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/StudioBackdrop.tsx
git commit -m "feat: extraire le fond animé dans StudioBackdrop"
```

---

### Task 2: Créer `SiteHeader` (nav desktop + tiroir mobile)

**Files:**
- Create: `components/SiteHeader.tsx`
- Test: vérification manuelle/curl (voir Step 3)

**Interfaces:**
- Consumes: `usePathname` (`next/navigation`), `Link` (`next/link`).
- Produces: `SiteHeader` — composant sans props, `export default function SiteHeader(): JSX.Element`. Task 5 l'importe et le rend dans `app/layout.tsx`, à la place de l'ancien `<header>` de `app/page.tsx`.

- [ ] **Step 1: Créer le fichier `components/SiteHeader.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Accueil" },
  { href: "/galerie", label: "Galerie" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/a-propos", label: "À propos" },
] as const;

/**
 * Header partagé par toutes les pages : logo, nav desktop, et bouton
 * hamburger qui ouvre un panneau de navigation en overlay sur mobile.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Ferme le panneau mobile à chaque changement de route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Verrouille le scroll du body tant que le panneau mobile est ouvert.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Échap ferme le panneau mobile.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/55 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
            Blumin<span className="text-primary">oo</span>
          </h1>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500 sm:inline">
            Studio
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition duration-200 ${
                  active
                    ? "bg-primary text-ink"
                    : "text-neutral-400 hover:text-neutral-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="cursor-pointer rounded-xl border border-white/10 p-2 text-neutral-300 transition hover:border-white/20 hover:text-white md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
          />
          <div
            id="mobile-nav-panel"
            className="absolute inset-x-0 top-full z-30 border-b border-white/[0.06] bg-ink/95 backdrop-blur-2xl"
          >
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition ${
                      active
                        ? "bg-primary text-ink"
                        : "text-neutral-300 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur mentionnant `SiteHeader.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/SiteHeader.tsx
git commit -m "feat: ajouter SiteHeader (nav desktop + tiroir mobile)"
```

---

### Task 3: Créer `PlaceholderSection`

**Files:**
- Create: `components/PlaceholderSection.tsx`

**Interfaces:**
- Consumes: `Panel` (default export, `@/components/Panel`, props `{ children, className? }` — déjà existant, inchangé).
- Produces: `PlaceholderSection` — `export default function PlaceholderSection(props: { eyebrow: string; title: string; description: string }): JSX.Element`. Task 4 l'utilise dans les 3 pages placeholder.

- [ ] **Step 1: Créer le fichier `components/PlaceholderSection.tsx`**

```tsx
import Panel from "@/components/Panel";

type PlaceholderSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
};

/** Page de contenu "bientôt disponible", réutilisée par les sections encore vides du menu. */
export default function PlaceholderSection({
  eyebrow,
  title,
  description,
}: PlaceholderSectionProps) {
  return (
    <div className="animate-fade-up mx-auto max-w-2xl py-12">
      <Panel className="p-8 text-center sm:p-10">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          {description}
        </p>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur mentionnant `PlaceholderSection.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/PlaceholderSection.tsx
git commit -m "feat: ajouter PlaceholderSection"
```

---

### Task 4: Créer les 3 pages placeholder

**Files:**
- Create: `app/galerie/page.tsx`
- Create: `app/tarifs/page.tsx`
- Create: `app/a-propos/page.tsx`

**Interfaces:**
- Consumes: `PlaceholderSection` (Task 3) — `{ eyebrow: string; title: string; description: string }`.
- Produces: trois routes App Router (`/galerie`, `/tarifs`, `/a-propos`) consommées par `SiteHeader` (Task 2, déjà écrit avec ces chemins) et vérifiées en Task 6.

- [ ] **Step 1: Créer `app/galerie/page.tsx`**

```tsx
import PlaceholderSection from "@/components/PlaceholderSection";

export default function GaleriePage() {
  return (
    <PlaceholderSection
      eyebrow="Galerie"
      title="Vos rendus, bientôt réunis ici."
      description="L'historique de vos générations sera bientôt disponible sur cette page."
    />
  );
}
```

- [ ] **Step 2: Créer `app/tarifs/page.tsx`**

```tsx
import PlaceholderSection from "@/components/PlaceholderSection";

export default function TarifsPage() {
  return (
    <PlaceholderSection
      eyebrow="Tarifs"
      title="Des tarifs simples arrivent bientôt."
      description="Cette page détaillera bientôt les coûts et crédits disponibles."
    />
  );
}
```

- [ ] **Step 3: Créer `app/a-propos/page.tsx`**

```tsx
import PlaceholderSection from "@/components/PlaceholderSection";

export default function AProposPage() {
  return (
    <PlaceholderSection
      eyebrow="À propos"
      title="En savoir plus sur Bluminoo Studio."
      description="Cette page présentera bientôt le fonctionnement du studio et répondra à vos questions."
    />
  );
}
```

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur mentionnant ces 3 fichiers.

- [ ] **Step 5: Commit**

```bash
git add app/galerie/page.tsx app/tarifs/page.tsx app/a-propos/page.tsx
git commit -m "feat: ajouter les pages placeholder Galerie/Tarifs/A propos"
```

---

### Task 5: Brancher le layout partagé et simplifier la page Studio

**Files:**
- Modify: `app/layout.tsx` (fichier entier remplacé)
- Modify: `app/page.tsx` (imports en tête de fichier, et tout le `return` du composant `Home`)

**Interfaces:**
- Consumes: `StudioBackdrop` (Task 1), `SiteHeader` (Task 2) — tous deux `export default`, sans props.
- Produces: `app/layout.tsx` fournit désormais `<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">{children}<footer>…</footer></main>` autour de chaque route — Task 4 et `app/page.tsx` s'appuient sur ce `<main>` partagé pour leur mise en page (elles ne rendent plus leur propre `<main>`).

Ce fichier `app/layout.tsx` et le retour de `app/page.tsx` sont modifiés **ensemble, dans le même commit** : les déplacer séparément laisserait un état intermédiaire avec fond/header dupliqués (page.tsx contient encore l'ancien chrome pendant que layout.tsx en ajoute un nouveau).

- [ ] **Step 1: Remplacer `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Cormorant, Montserrat } from "next/font/google";
import "./globals.css";
import StudioBackdrop from "@/components/StudioBackdrop";
import SiteHeader from "@/components/SiteHeader";

const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Bluminoo Studio",
  description:
    "Uploadez une photo et générez une version ultra-réaliste avec un élément de luxe intégré.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body className="bg-ink font-body text-neutral-100 antialiased">
        <div className="studio-shell min-h-screen">
          <StudioBackdrop />
          <div className="studio-content min-h-screen">
            <SiteHeader />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
              {children}
              <footer className="mt-12 text-center text-[11px] uppercase tracking-[0.18em] text-neutral-700">
                Gemini Flash Image · Kling O3 · React Bits
              </footer>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Retirer les imports du fond animé dans `app/page.tsx`**

Remplacer les toutes premières lignes du fichier (les imports et la constante `BEND_COLOR`, avant `type Mode = ...`) par :

```tsx
"use client";

import { fal } from "@fal-ai/client";
import { useCallback, useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";

fal.config({
  proxyUrl: "/api/fal/proxy",
});
```

(Suppression des imports `dynamic`, `DotField`, `ColorBends` et de la constante `BEND_COLOR` — ils vivent maintenant uniquement dans `StudioBackdrop.tsx`.)

- [ ] **Step 3: Simplifier le `return` de `app/page.tsx`**

Remplacer tout le bloc de retour du composant `Home` (de `return (` jusqu'au `}` final de la fonction) par :

```tsx
  return (
    <>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(["image", "video"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition duration-200 ${
                mode === m
                  ? "bg-primary text-ink"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {m === "image" ? "Image" : "Vidéo"}
            </button>
          ))}
        </div>
      </div>

      {mode === "image" ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <aside className="animate-fade-up lg:col-span-5">
            <Panel className="p-5 sm:p-6 lg:sticky lg:top-24">
              <div className="mb-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
                  Génération image
                </p>
                <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
                  Intégrez le luxe. Gardez tout le reste.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                  Une photo. Un preset. Un rendu photoréaliste, sans trahir
                  le cadre d&apos;origine.
                </p>
              </div>

              <div className="mb-6 rounded-2xl border border-dashed border-white/10">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Choisir une photo à transformer"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
                  className={`cursor-pointer overflow-hidden rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                    isDragging
                      ? "bg-primary/[0.08]"
                      : "bg-white/[0.02] hover:bg-white/[0.035]"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onInputChange}
                  />
                  {prepared ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={prepared.previewUrl}
                        alt="Aperçu"
                        className="max-h-52 w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                        <p className="truncate text-xs text-neutral-300">
                          {fileName || "Image sélectionnée"} · cliquer pour
                          changer
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M12 16V8m0 0l-3 3m3-3l3 3M4 16.5V17a3 3 0 003 3h10a3 3 0 003-3v-.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-neutral-100">
                        Déposez une photo ou cliquez
                      </p>
                      <p className="text-xs text-neutral-600">
                        Max 10 Mo · compression auto au-delà de 2 Mo
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <section className="mb-6">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Preset
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PRESETS) as CategoryId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCategory(id)}
                      className={`cursor-pointer rounded-xl px-2 py-3 text-left transition duration-200 ${
                        category === id
                          ? "bg-primary text-ink"
                          : "border border-white/10 bg-white/[0.02] text-neutral-300 hover:border-primary/30"
                      }`}
                    >
                      <span className="block text-sm font-semibold leading-none">
                        {PRESETS[id].label}
                      </span>
                      <span
                        className={`mt-1.5 block text-[10px] leading-none ${
                          category === id
                            ? "text-ink/70"
                            : "text-neutral-600"
                        }`}
                      >
                        {PRESETS[id].subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mb-6">
                <label
                  htmlFor="custom-prompt"
                  className="mb-3 block text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500"
                >
                  Prompt libre{" "}
                  <span className="normal-case tracking-normal text-neutral-600">
                    (optionnel)
                  </span>
                </label>
                <textarea
                  id="custom-prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                  placeholder="Remplace le preset si rempli…"
                  className="w-full resize-y rounded-2xl border border-white/10 bg-black/40 p-3.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-700 focus:border-primary/50"
                />
              </section>

              {error && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading || !prepared}
                  className="flex-1 cursor-pointer rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-ink transition duration-200 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Génération… (~15-30s)" : "Générer"}
                </button>
                {prepared && (
                  <button
                    type="button"
                    onClick={reset}
                    disabled={loading}
                    className="cursor-pointer rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-medium text-neutral-400 transition hover:border-white/20 hover:text-neutral-200 disabled:opacity-40"
                  >
                    Reset
                  </button>
                )}
              </div>
            </Panel>
          </aside>

          <section className="animate-fade-up-delay lg:col-span-7">
            <Panel className="min-h-[420px] p-4 sm:p-6 lg:min-h-[640px]">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Canvas
                  </p>
                  <h3 className="font-display mt-1 text-2xl font-semibold text-white">
                    {result ? "Avant / Après" : "Aperçu"}
                  </h3>
                </div>
                {result && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={download}
                      className="cursor-pointer rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-ink transition duration-200 hover:bg-primary-soft"
                    >
                      Télécharger
                    </button>
                    <button
                      type="button"
                      onClick={generate}
                      disabled={loading}
                      className="cursor-pointer rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-white/20 disabled:opacity-40"
                    >
                      {loading ? "…" : "Régénérer"}
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 lg:min-h-[520px]">
                  <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  <p className="text-sm text-neutral-400">
                    Rendu photoréaliste en cours…
                  </p>
                </div>
              ) : result && prepared ? (
                <div className="animate-fade-up">
                  <BeforeAfterSlider
                    before={prepared.previewUrl}
                    after={result}
                  />
                  <p className="mt-3 text-center text-xs text-neutral-600">
                    Glissez pour comparer
                  </p>
                </div>
              ) : prepared ? (
                <div className="flex min-h-[360px] items-center justify-center lg:min-h-[520px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prepared.previewUrl}
                    alt="Original"
                    className="max-h-[520px] w-full rounded-2xl object-contain"
                  />
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center lg:min-h-[520px]">
                  <div className="h-px w-16 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  <p className="font-display text-xl font-semibold text-neutral-300">
                    Votre rendu apparaîtra ici
                  </p>
                  <p className="max-w-sm text-sm text-neutral-600">
                    Uploadez une photo, choisissez un preset, générez. Le
                    slider avant/après s&apos;affiche dès que le résultat
                    est prêt.
                  </p>
                </div>
              )}
            </Panel>
          </section>
        </div>
      ) : (
        <div className="animate-fade-up mx-auto max-w-4xl">
          <Panel className="mb-6 p-5 sm:p-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
              Remplacer un objet
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold text-white">
              Vidéo courte, intégration réaliste
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              ~5 s de vidéo · génération ~90 s · Kling O3 via fal.ai
            </p>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
            </div>

            <section className="mt-6">
              <label
                htmlFor="video-prompt"
                className="mb-3 block text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500"
              >
                Prompt
              </label>
              <textarea
                id="video-prompt"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                rows={4}
                placeholder={VIDEO_PROMPT_PLACEHOLDER}
                disabled={videoLoading}
                className="w-full resize-y rounded-2xl border border-white/10 bg-black/40 p-3.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-700 focus:border-primary/50 disabled:opacity-50"
              />
            </section>

            <section className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateVideo}
                disabled={
                  videoLoading || !videoSource || !videoPrompt.trim()
                }
                className="cursor-pointer rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-ink transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                {videoLoading
                  ? "Génération vidéo… (~90s+)"
                  : "Générer la vidéo"}
              </button>
              {(videoSource || videoObject || videoPrompt) && (
                <button
                  type="button"
                  onClick={resetVideo}
                  disabled={videoLoading}
                  className="cursor-pointer rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-medium text-neutral-400 transition hover:border-white/20 disabled:opacity-40"
                >
                  Reset
                </button>
              )}
            </section>

            {videoError && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                {videoError}
              </div>
            )}

            {videoUrl && (
              <section className="mt-8 animate-fade-up">
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-full rounded-2xl border border-white/10"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={downloadVideo}
                    className="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-primary-soft"
                  >
                    Télécharger
                  </button>
                  <button
                    type="button"
                    onClick={generateVideo}
                    disabled={videoLoading}
                    className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-white/20 disabled:opacity-40"
                  >
                    {videoLoading ? "…" : "Régénérer"}
                  </button>
                </div>
              </section>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 5: Démarrer le serveur de dev et vérifier l'absence de doublon**

Run: `npm run dev` (en arrière-plan si pas déjà lancé)
Run: `curl -s http://localhost:3000/ | grep -o "studio-backdrop" | wc -l`
Expected: `1` (un seul fond animé rendu, pas de duplication)

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "refactor: partager le fond/header via le layout, simplifier la page Studio"
```

---

### Task 6: Vérification finale multi-routes

**Files:** aucun fichier modifié — validation uniquement.

- [ ] **Step 1: Vérifier que les 4 routes répondent et contiennent le bon contenu**

Run:
```bash
curl -s http://localhost:3000/ | grep -o "Génération image"
curl -s http://localhost:3000/galerie | grep -o "Vos rendus, bient.t r.unis ici."
curl -s http://localhost:3000/tarifs | grep -o "Des tarifs simples arrivent bient.t."
curl -s http://localhost:3000/a-propos | grep -o "En savoir plus sur Bluminoo Studio."
```
Expected: chaque commande affiche la chaîne recherchée (aucune sortie vide, pas de 404).

- [ ] **Step 2: Vérifier la présence du header et de la nav sur chaque route**

Run: `curl -s http://localhost:3000/galerie | grep -o "Blumin"`
Expected: présent (le logo vient du layout partagé, donc visible sur toutes les routes).

- [ ] **Step 3: Vérification manuelle au navigateur (desktop)**

Ouvrir `http://localhost:3000` dans un navigateur :
- Le lien "Accueil" est visuellement actif (fond violet) sur `/`.
- Cliquer "Galerie" → l'URL passe à `/galerie`, le lien "Galerie" devient actif, le fond animé ne clignote pas (pas de remontage).
- Répéter pour "Tarifs" et "À propos".
- Sur `/`, le toggle Image/Vidéo est maintenant au-dessus du panneau de génération (plus dans le header) et fonctionne toujours.

- [ ] **Step 4: Vérification manuelle au navigateur (mobile, largeur < 768px)**

Redimensionner la fenêtre (ou utiliser le mode responsive) :
- Le bouton hamburger apparaît, la nav desktop est masquée.
- Cliquer le hamburger ouvre le panneau (liens empilés).
- `aria-expanded="true"` sur le bouton (vérifiable via l'inspecteur ou `read_page`).
- Cliquer un lien ferme le panneau et navigue.
- Rouvrir puis appuyer sur `Échap` ferme le panneau.
- Rouvrir puis cliquer en dehors du panneau (zone assombrie) le ferme.

- [ ] **Step 5: Commit final (si des ajustements ont été faits pendant la vérification)**

```bash
git status --short
```
S'il y a des changements résiduels, les committer avec un message décrivant l'ajustement (ex. `fix: corriger l'aria-label du hamburger`). Sinon, aucune action.
