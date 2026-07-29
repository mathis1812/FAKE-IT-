# Exemple de résultat (onglet Vidéo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une section "Exemple de résultat" (vidéo de démo en autoplay muette en boucle + badge crédits statique) sur l'onglet Vidéo de Bluminoo Studio, entre le titre existant et le formulaire d'upload.

**Architecture:** Un fichier vidéo statique compressé va dans `public/exemple-resultat.mp4` et est servi tel quel par Next.js. Le JSX correspondant est ajouté inline dans `app/page.tsx` (branche `mode === "video"`), sans nouveau composant partagé — ce bloc n'apparaît qu'à un seul endroit.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, ffmpeg (préparation de l'asset, hors build).

## Global Constraints

- Le badge de crédits est **statique** : texte "Tes crédits" + valeur figée `0`, aucune logique de comptage — pas de vrai système de crédits (spec `docs/superpowers/specs/2026-07-29-video-example-showcase-design.md`, section Non-objectifs).
- La vidéo doit être `autoPlay muted loop playsInline`, sans barre de contrôle.
- Aucun nouveau composant partagé — JSX inline dans `app/page.tsx`.
- L'onglet Image n'est pas touché.
- Pas de framework de tests dans ce projet (aucun `jest`/`vitest`/`playwright` dans `package.json`). Vérification via `npx tsc --noEmit -p tsconfig.json` et vérification manuelle au navigateur.

---

## Fichiers concernés

- Créer : `public/exemple-resultat.mp4` (asset vidéo compressé, committé dans le repo)
- Modifier : `app/page.tsx` (insertion d'un bloc JSX entre deux `Panel` existants dans la branche vidéo)

---

### Task 1: Compresser la vidéo et ajouter la section "Exemple de résultat"

**Files:**
- Create: `public/exemple-resultat.mp4`
- Modify: `app/page.tsx` (entre les lignes actuelles 781 et 783, dans la branche `mode === "video"` du `return` du composant `Home`)

**Interfaces:**
- Consumes: rien de nouveau — utilise le composant `Panel` déjà importé (`@/components/Panel`) et les classes Tailwind déjà en usage ailleurs dans le fichier.
- Produces: rien consommé par d'autres tâches — ce plan n'a qu'une seule tâche.

Le fichier source fourni par l'utilisateur (`C:\Users\julie\Downloads\v26044gc0000d6oq47vog65q1u31mdsg.mp4`) fait 16,7 Mo, en HEVC 1080×1920 avec piste audio AAC, 8,35 s. Trop lourd pour une vidéo en autoplay au chargement — à recompresser en H.264 sans audio avant de l'intégrer.

- [ ] **Step 1: Compresser la vidéo source avec ffmpeg**

Run:
```bash
mkdir -p public
ffmpeg -y -i "/c/Users/julie/Downloads/v26044gc0000d6oq47vog65q1u31mdsg.mp4" -vf "scale=720:-2" -c:v libx264 -preset slow -crf 23 -an -movflags +faststart -pix_fmt yuv420p public/exemple-resultat.mp4
```

Cette commande : supprime la piste audio (`-an`, inutile puisque la vidéo sera muette), réencode en H.264 (compatibilité navigateur large, contrairement au HEVC source), redimensionne la largeur à 720px en conservant le ratio (`-2` = hauteur automatique, toujours paire), `crf 23` = bonne qualité perceptuelle pour un fichier compact, `+faststart` = la vidéo peut commencer à jouer avant d'être entièrement téléchargée (essentiel pour l'autoplay), `yuv420p` = compatibilité maximale.

- [ ] **Step 2: Vérifier la taille et la durée du fichier compressé**

Run:
```bash
ls -la public/exemple-resultat.mp4
ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 public/exemple-resultat.mp4
```
Expected: `size` significativement inférieur aux 16 760 798 octets (16,7 Mo) du fichier source — viser quelques Mo. `duration` proche de `8.352274` (durée inchangée, seule la piste audio et le débit vidéo ont changé).

Si le fichier obtenu dépasse 6 Mo, relancer l'étape 1 avec `-crf 28` à la place de `-crf 23` (qualité légèrement réduite, fichier plus compact), et revérifier avec cette même commande.

- [ ] **Step 3: Insérer le bloc "Exemple de résultat" dans `app/page.tsx`**

Remplacer, dans la branche `mode === "video"` du composant `Home` :

```tsx
          </Panel>

          <Panel className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <DropZone
                label="Image source (requis)"
```

par :

```tsx
          </Panel>

          <Panel className="mb-6 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
              <p className="shrink-0 text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
                Exemple de résultat
              </p>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
            </div>
            <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src="/exemple-resultat.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-3 text-center text-xs text-neutral-600">
              Remplacement d&apos;objet par IA
            </p>
            <div className="mt-4 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
                </svg>
                Tes crédits
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-ink">
                  0
                </span>
              </div>
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <DropZone
                label="Image source (requis)"
```

Ceci ajoute un nouveau `Panel` entre le titre existant et le formulaire d'upload, sans toucher à quoi que ce soit d'autre dans le fichier (aucun state, aucun handler, aucun autre JSX modifié).

- [ ] **Step 4: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 5: Démarrer le serveur de dev et vérifier le rendu**

Run: `npm run dev` (en arrière-plan si pas déjà lancé)

Dans un navigateur, ouvrir `http://localhost:3000`, cliquer sur l'onglet "Vidéo", et vérifier :
- La nouvelle section "Exemple de résultat" apparaît entre le titre et le formulaire d'upload.
- La vidéo démarre automatiquement, en boucle, sans son, sans barre de contrôle visible.
- Le badge "Tes crédits · 0" s'affiche sous la vidéo.
- L'onglet Image est inchangé (revenir sur "Image" et comparer visuellement à avant).

- [ ] **Step 6: Commit**

```bash
git add public/exemple-resultat.mp4 app/page.tsx
git commit -m "feat: ajouter la section exemple de résultat sur l'onglet Vidéo"
```
