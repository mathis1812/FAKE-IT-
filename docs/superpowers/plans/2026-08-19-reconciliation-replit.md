# Réconciliation des branches locale et Replit — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour implémenter ce plan tâche par tâche.
> Les étapes utilisent la syntaxe case à cocher (`- [ ]`) pour le suivi.

**Spec de référence :** `docs/superpowers/specs/2026-08-19-reconciliation-replit-design.md`

**Objectif :** fusionner les 34 commits locaux et les 34 commits Replit en
une seule ligne cohérente, avec la génération photo sur l'API Gemini
directe et la vidéo sur fal.ai Kling O1.

**Architecture :** on fusionne `origin/main` (base Replit, en production)
dans une branche issue de `main`. Deux fichiers seulement entrent en
conflit. `app/api/generate/route.ts` garde la structure Replit (double
flux lieu/objet) avec le bloc de génération remplacé par Gemini.
`app/page.tsx` prend la version Replit telle quelle, puis reçoit par
transplantation quatre blocs venus du local.

**Stack :** Next.js 14 App Router, TypeScript, Supabase (auth, Storage,
RPC crédits), Stripe, vitest + jsdom.

## Contraintes globales

- **Ne jamais pousser sur `main`.** Un push sur `main` déclenche le
  déploiement production via `.github/workflows/deploy.yml`. Tout le
  travail reste sur `reconciliation-replit` jusqu'au feu vert explicite de
  l'utilisateur.
- **Porte de vérification, dans cet ordre :** `npx tsc --noEmit -p tsconfig.json`,
  puis `npx next build`, puis `npm test`. `tsc` seul ne suffit pas — il a
  déjà laissé passer une erreur ESLint qui cassait le build.
- **Identité git :** ce poste n'a pas de config git globale. Chaque commit
  utilise les drapeaux ponctuels
  `git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit ...`
- **Ne pas introduire de nouveaux tests** pendant ce chantier. Les tests de
  partage existants (`__tests__/share-button.test.tsx`) doivent continuer à
  passer, c'est tout.
- **Pas de `.env.local` utilisable** pour la génération réelle : les clés
  manquent. La vérification locale porte sur le build, les tests et le
  rendu ; la génération réelle se valide sur un preview Vercel.
- **Ne pas casser `buildPlacePrompt`** : il rattrape toutes ses erreurs en
  interne et retombe sur `fallbackPlacePrompt`. C'est ce qui autorise son
  appel hors du `try/catch` de remboursement des crédits.

---

### Task 1 : Créer la branche, fusionner, résoudre la route de génération

Le merge laisse deux fichiers en conflit. Cette tâche résout
`app/api/generate/route.ts` complètement et tranche `app/page.tsx` en
faveur de la version Replit, pour obtenir un état qui compile et se
commite. Le mode vidéo sera cassé à l'issue de cette tâche — c'est attendu
et corrigé en Task 4.

**Fichiers :**
- Modifier : `app/api/generate/route.ts` (résolution de conflit, réécriture complète)
- Modifier : `app/page.tsx` (résolution de conflit, on prend la version Replit)

**Interfaces :**
- Consomme : `generateGeminiImage(apiKey, { prompt, imageUrls, resolution })
  → Promise<{ bytes: Buffer; mimeType: string }>` (`lib/gemini-jobs.ts`) ;
  `persistImageBytes(userId, bytes, mimeType, label) → Promise<string>`
  (`lib/gallery-server.ts`) ; `buildPlacePrompt(apiKey, sourceImageUrl,
  placeImageUrls, userNote?) → Promise<string>` (`lib/place-prompt.ts`) ;
  `PLANS[planId].imageResolution: "1K" | "2K" | "4K"` (`lib/stripe.ts`).
- Produit : le tag git `pre-merge-local`, qui donne accès à la version
  locale de `app/page.tsx` dans toutes les tâches suivantes.

- [ ] **Étape 1 : Poser un tag sur la version locale avant merge**

Ce tag est la source des blocs à transplanter en Task 2, 3 et 4. Sans lui,
ces blocs deviennent introuvables une fois le merge commité.

```bash
cd C:/Users/julie/projects/fakeit
git tag pre-merge-local main
git checkout -b reconciliation-replit main
```

- [ ] **Étape 2 : Lancer le merge et constater les deux conflits**

```bash
git merge origin/main
```

Attendu : `CONFLICT (content): Merge conflict in app/api/generate/route.ts`
et `CONFLICT (content): Merge conflict in app/page.tsx`, et rien d'autre.
Si un troisième fichier apparaît en conflit, s'arrêter et le signaler — le
plan repose sur le fait qu'il n'y en a que deux.

- [ ] **Étape 3 : Prendre la version Replit de `app/page.tsx`**

```bash
git checkout --theirs app/page.tsx
git add app/page.tsx
```

- [ ] **Étape 4 : Écrire la version fusionnée de `app/api/generate/route.ts`**

Remplacer intégralement le contenu du fichier par :

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  IMAGE_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { persistImageBytes } from "@/lib/gallery-server";
import { generateGeminiImage } from "@/lib/gemini-jobs";
import { buildPlacePrompt } from "@/lib/place-prompt";
import { PLANS, type PlanId } from "@/lib/stripe";

export const runtime = "nodejs";
// 300 s : la génération photo avait été passée de 100 s à 280 s le
// 10/08 après des dépassements réels. Ne pas revenir à 120 s.
export const maxDuration = 300;

const MAX_PLACE_IMAGES = 3;

type GenerateBody = {
  sourceImageUrl?: string;
  /** 1 à 3 photos du lieu réel où intégrer le sujet. */
  placeImageUrls?: string[];
  /** Note libre optionnelle de l'utilisateur, intégrée au prompt généré. */
  userNote?: string;
  /** Ancien flux (objet + prompt libre) — conservé pour compatibilité. */
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
};

export async function POST(req: NextRequest) {
  // Deux fournisseurs distincts : kie.ai analyse les photos du lieu et
  // héberge les uploads, Gemini génère l'image.
  const kieApiKey = process.env.KIE_API_KEY?.trim();
  if (!kieApiKey) {
    return NextResponse.json(
      {
        error:
          "Clé API manquante. Définissez KIE_API_KEY dans vos variables d'environnement.",
      },
      { status: 500 },
    );
  }

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    return NextResponse.json(
      {
        error:
          "Clé API manquante. Définissez GEMINI_API_KEY dans vos variables d'environnement.",
      },
      { status: 500 },
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const { sourceImageUrl, placeImageUrls, userNote, objectImageUrl, prompt, label } =
    body;

  if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
    return NextResponse.json(
      { error: "Image manquante. Uploadez une photo puis réessayez." },
      { status: 400 },
    );
  }

  const placeUrls = Array.isArray(placeImageUrls)
    ? placeImageUrls.filter((u): u is string => typeof u === "string" && !!u.trim())
    : [];

  if (placeUrls.length > MAX_PLACE_IMAGES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PLACE_IMAGES} photos du lieu.` },
      { status: 400 },
    );
  }

  // Nouveau flux : au moins une photo du lieu, prompt généré automatiquement.
  // Ancien flux (compatibilité) : prompt libre obligatoire.
  if (placeUrls.length === 0 && (!prompt || !prompt.trim())) {
    return NextResponse.json(
      {
        error:
          "Ajoutez au moins une photo du lieu où vous voulez apparaître.",
      },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Connectez-vous pour générer une image." },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  if (profileError) {
    console.error(
      `Échec de la lecture du palier pour l'utilisateur ${user.id} (repli sur 1K) :`,
      profileError.message,
    );
  }
  const planId = profile?.plan as PlanId | null | undefined;
  const resolution = planId ? PLANS[planId]?.imageResolution ?? "1K" : "1K";

  let hasCredits: boolean;
  try {
    hasCredits = await spendCredits(user.id, IMAGE_GENERATION_COST);
  } catch (err) {
    console.error("Échec de la vérification des crédits :", err);
    return NextResponse.json(
      { error: "Erreur interne lors de la vérification des crédits." },
      { status: 500 },
    );
  }
  if (!hasCredits) {
    return NextResponse.json(
      {
        error:
          "Crédits insuffisants. Rendez-vous sur la page Tarifs pour recharger votre compte.",
      },
      { status: 402 },
    );
  }

  const imageInput = [sourceImageUrl];
  let finalPrompt: string;
  if (placeUrls.length > 0) {
    imageInput.push(...placeUrls);
    // Étape d'analyse : un modèle vision examine les photos du lieu
    // (éclairage, matériaux, ambiance, angle) et produit un prompt structuré.
    // buildPlacePrompt rattrape ses propres erreurs et retombe sur un prompt
    // de secours : il ne peut donc pas lever, ce qui autorise cet appel hors
    // du try/catch de remboursement. Ne pas casser cette propriété.
    finalPrompt = await buildPlacePrompt(
      kieApiKey,
      sourceImageUrl,
      placeUrls,
      typeof userNote === "string" ? userNote : undefined,
    );
  } else {
    finalPrompt = (prompt as string).trim();
    if (objectImageUrl && typeof objectImageUrl === "string") {
      imageInput.push(objectImageUrl);
      finalPrompt +=
        " Integrate the reference object shown in the second image photorealistically, " +
        "while preserving the subject, pose, lighting and background from the first image.";
    }
  }

  try {
    const { bytes, mimeType } = await generateGeminiImage(geminiApiKey, {
      prompt: finalPrompt,
      imageUrls: imageInput,
      resolution,
    });
    const imageUrl = await persistImageBytes(
      user.id,
      bytes,
      mimeType,
      label?.trim() || "Génération image",
    );
    return NextResponse.json({ imageUrl });
  } catch (err) {
    await refundCredits(user.id, IMAGE_GENERATION_COST);
    const message =
      err instanceof Error
        ? err.message
        : "Erreur inconnue lors de la génération de l'image.";
    return NextResponse.json(
      { error: `Erreur du service de génération Gemini. ${message}` },
      { status: 502 },
    );
  }
}
```

- [ ] **Étape 5 : Vérifier qu'il ne reste aucun marqueur de conflit**

```bash
grep -rn "<<<<<<<\|>>>>>>>" app/api/generate/route.ts app/page.tsx
```

Attendu : aucune sortie.

- [ ] **Étape 6 : Vérifier que le projet compile**

```bash
npx tsc --noEmit -p tsconfig.json
```

Attendu : aucune erreur. En cas d'erreur sur `lib/kie-jobs.ts` devenu
inutilisé, ne pas y toucher — sa suppression est la Task 5.

- [ ] **Étape 7 : Commiter le merge**

```bash
git add app/api/generate/route.ts app/page.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "merge: réconcilier la ligne Replit et la ligne locale (génération photo sur Gemini)"
```

---

### Task 2 : Réinjecter la validation et l'upload de la vidéo source

**Fichiers :**
- Modifier : `app/page.tsx`

**Interfaces :**
- Consomme : le tag `pre-merge-local` posé en Task 1.
- Produit : les constantes `MAX_VIDEO_FILE_BYTES`, `MAX_VIDEO_SOURCE_BYTES`,
  `MIN_VIDEO_WIDTH`, `MAX_VIDEO_WIDTH`, `MIN_VIDEO_DURATION_S`,
  `MAX_VIDEO_DURATION_S` ; la fonction `validateVideoFile(file: File)` et
  la fonction `uploadVideoDirect(file: File, userId: string):
  Promise<string>`, toutes consommées par la Task 4.

- [ ] **Étape 1 : Extraire les blocs de la version locale**

```bash
cd C:/Users/julie/projects/fakeit
git show pre-merge-local:app/page.tsx > /tmp/page-local.tsx
sed -n '16,22p' /tmp/page-local.tsx
sed -n '108,186p' /tmp/page-local.tsx
```

Le premier extrait donne les six constantes vidéo, le second donne
`validateVideoFile` (lignes 108 à 170) et `uploadVideoDirect` (lignes 171
à 186), qui sont contiguës.

- [ ] **Étape 2 : Insérer les constantes**

Coller les six constantes de l'extrait `16,22` dans `app/page.tsx`, juste
après les constantes existantes en tête de fichier, avant la première
déclaration de fonction. Ne pas dupliquer une constante déjà présente dans
la version Replit — vérifier chaque nom avant insertion.

- [ ] **Étape 3 : Insérer les deux fonctions**

Coller le bloc `108,186` juste avant la fonction `validateImageFile` du
fichier fusionné. Ces deux fonctions sont au niveau module, hors du
composant `Home`.

- [ ] **Étape 4 : Vérifier la compilation**

```bash
npx tsc --noEmit -p tsconfig.json
```

Attendu : aucune erreur. `validateVideoFile` et `uploadVideoDirect` sont
déclarées mais pas encore appelées — TypeScript ne s'en plaint pas, ESLint
non plus dans ce projet.

- [ ] **Étape 5 : Commiter**

```bash
git add app/page.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: réinjecter la validation et l'upload direct de la vidéo source"
```

---

### Task 3 : Réinjecter le chrono et la barre de progression

**Fichiers :**
- Modifier : `app/page.tsx`

**Interfaces :**
- Consomme : le tag `pre-merge-local`.
- Produit : le hook `useElapsedProgress(active: boolean) → { elapsedSeconds:
  number; progressPercent: number }`, consommé par les panneaux image et
  vidéo.

- [ ] **Étape 1 : Extraire le hook de la version locale**

```bash
sed -n '356,377p' /tmp/page-local.tsx
```

- [ ] **Étape 2 : Insérer le hook**

Coller le bloc juste avant `export default function Home()`. Conserver le
commentaire d'origine, qui précise que la progression est purement perçue
et sans lien avec l'état réel du fournisseur.

- [ ] **Étape 3 : Repérer les noms réels des états de chargement**

```bash
grep -n "const \[.*[Ll]oading" app/page.tsx
```

La version Replit peut nommer ses états différemment de la version locale.
Noter les deux noms exacts avant l'étape suivante.

- [ ] **Étape 4 : Brancher le hook dans le composant**

Dans `Home`, après les déclarations d'état existantes, ajouter — en
substituant les noms relevés à l'étape 3 si besoin :

```typescript
  const { elapsedSeconds: imageElapsed, progressPercent: imageProgress } =
    useElapsedProgress(loading);
  const { elapsedSeconds: videoElapsed, progressPercent: videoProgress } =
    useElapsedProgress(videoLoading);
```

- [ ] **Étape 5 : Extraire et réinsérer l'affichage**

```bash
grep -n "imageProgress\|imageElapsed\|videoProgress\|videoElapsed" /tmp/page-local.tsx
```

Reporter les blocs JSX correspondants dans les panneaux image et vidéo du
fichier fusionné, aux emplacements équivalents (sous le bouton de
génération, pendant le chargement).

- [ ] **Étape 6 : Vérifier la compilation et le build**

```bash
npx tsc --noEmit -p tsconfig.json
npx next build
```

Attendu : aucune erreur dans les deux cas.

- [ ] **Étape 7 : Commiter**

```bash
git add app/page.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: réinjecter le chrono et la barre de progression perçue"
```

---

### Task 4 : Réinjecter le câblage vidéo fal.ai et corriger les libellés

C'est la tâche qui répare le mode vidéo, cassé depuis la Task 1.

**Fichiers :**
- Modifier : `app/page.tsx`

**Interfaces :**
- Consomme : `validateVideoFile` et `uploadVideoDirect` (Task 2) ; la route
  `POST /api/generate-video`, qui attend `{ sourceVideoUrl: string;
  objectImageUrl: string; prompt: string; label?: string }` et renvoie
  `{ videoUrl: string }`.

- [ ] **Étape 1 : Extraire les handlers de la version locale**

```bash
sed -n '666,784p' /tmp/page-local.tsx
```

Ce bloc contient `pickVideoUpload` (666 à 691) et `generateVideo` (692 à
784), contigus.

- [ ] **Étape 2 : Remplacer les handlers vidéo du fichier fusionné**

Repérer les handlers vidéo hérités de la version Replit :

```bash
grep -n "generate-video\|const generateVideo\|const pickVideo" app/page.tsx
```

Remplacer intégralement les handlers Replit par le bloc extrait. Le
contrat de la route a changé : elle attend désormais une **URL de vidéo
source** (`sourceVideoUrl`) et non plus une photo. Laisser l'ancien appel
en place casserait la génération vidéo en production.

- [ ] **Étape 3 : Corriger les libellés de l'onglet vidéo**

```bash
grep -n "Kling 3.0 Pro via kie.ai" app/page.tsx
```

Remplacer par `Kling O1 via fal.ai`. Mettre également à jour le libellé de
la zone d'upload en `MP4/MOV · 3-10 s · 720p min · max 50 Mo` et
réintroduire l'astuce locale : filmer via l'application Caméra plutôt que
depuis le navigateur, l'enregistrement navigateur dégradant fortement la
qualité.

- [ ] **Étape 4 : Vérifier la porte complète**

```bash
npx tsc --noEmit -p tsconfig.json
npx next build
npm test
```

Attendu : aucune erreur, et les tests de partage passent — ils ne touchent
pas au mode vidéo, toute régression ici signale une transplantation qui a
débordé.

- [ ] **Étape 5 : Commiter**

```bash
git add app/page.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: rebrancher la génération vidéo sur fal.ai Kling O1 et corriger les libellés"
```

---

### Task 5 : Supprimer le code mort et remettre la configuration d'aplomb

**Fichiers :**
- Supprimer : `lib/kie-jobs.ts`, `lib/aleph-jobs.ts`
- Modifier : `.env.example`, `next.config.mjs`, `README.md`

- [ ] **Étape 1 : Confirmer que les deux modules sont orphelins**

```bash
grep -rn "kie-jobs\|aleph-jobs" app lib components --include=*.ts --include=*.tsx
```

Attendu : aucune sortie. Si `kie-jobs` apparaît encore, c'est que la Task 1
n'a pas remplacé le bloc de génération — s'arrêter et corriger avant de
supprimer quoi que ce soit.

- [ ] **Étape 2 : Supprimer les deux fichiers**

```bash
git rm lib/kie-jobs.ts lib/aleph-jobs.ts
```

- [ ] **Étape 3 : Compléter `.env.example`**

Ajouter les deux clés manquantes sous `KIE_API_KEY`, en laissant les
variables Supabase et Stripe existantes inchangées :

```
KIE_API_KEY=
GEMINI_API_KEY=
FAL_KEY=
```

- [ ] **Étape 4 : Restaurer `next.config.mjs`**

Le fichier a été réindenté à tort et a perdu sa newline finale. Le
réécrire exactement ainsi :

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Étape 5 : Mettre le README à jour**

Corriger la section des fournisseurs pour refléter l'architecture réelle :
génération image par l'API Gemini directe (`gemini-3-pro-image-preview`),
vidéo par fal.ai (`fal-ai/kling-video/o1/video-to-video/edit`), kie.ai pour
l'hébergement des uploads et l'analyse vision du lieu. Supprimer toute
mention de `nano-banana-pro` comme modèle de génération.

- [ ] **Étape 6 : Vérifier la porte complète**

```bash
npx tsc --noEmit -p tsconfig.json
npx next build
npm test
```

- [ ] **Étape 7 : Commiter**

```bash
git add -A
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "chore: supprimer le code mort et remettre la configuration à jour"
```

---

### Task 6 : Vérification manuelle et revue de branche

- [ ] **Étape 1 : Lancer le serveur de dev**

Utiliser l'outil de preview du harnais, pas `npm run dev` en tâche de
fond.

- [ ] **Étape 2 : Vérifier l'onglet Image**

Charger une photo sujet, ajouter une à trois photos de lieu, remplir la
note optionnelle. Confirmer que le champ `id="user-note"` est présent, que
le bouton Générer s'active, et qu'aucune erreur n'apparaît en console. La
génération réelle échouera faute de clés — c'est attendu.

- [ ] **Étape 3 : Vérifier l'onglet Vidéo**

Confirmer que le libellé annonce `Kling O1 via fal.ai`, puis vérifier que
la validation rejette **avant upload** une vidéo de moins de 3 s, une
vidéo de plus de 10 s, et une vidéo de moins de 720 px de large, chacune
avec son message d'erreur propre.

- [ ] **Étape 4 : Vérifier les autres pages**

Parcourir `/galerie`, `/compte` et `/tarifs`. Confirmer que la refonte du
compte en dashboard deux colonnes est bien présente et que la grille
tarifaire affiche les trois paliers avec la bascule mensuel/annuel.

- [ ] **Étape 5 : Revue de branche complète**

Lancer une revue sur l'ensemble de la branche, pas tâche par tâche : les
bugs les plus coûteux de ce projet ont tous été trouvés par la revue
finale, jamais par les revues unitaires. Traiter les findings Critical et
Important avant de proposer le déploiement.

- [ ] **Étape 6 : Proposer un déploiement preview**

La génération réelle n'est vérifiable que sur un preview. Demander l'accord
de l'utilisateur avant de déployer — c'est une action sortante, jamais
automatique. Sur accord, et **après** que l'utilisateur a ajouté
`GEMINI_API_KEY` et `FAL_KEY` sur Vercel :

```bash
npx vercel deploy
```

Ne pas passer `--prod`, et ne pas utiliser `vercel build` en local : le
build local échoue sur Windows avec une erreur EPERM de lien symbolique,
alors que le build distant de Vercel fonctionne. Vérifier ensuite une
génération image et une génération vidéo réelles sur l'URL du preview.

- [ ] **Étape 7 : Ménage**

```bash
git worktree remove C:/Users/julie/projects/fakeit-replit
git tag -d pre-merge-local
```

Arrêter également les deux serveurs de dev lancés pour la comparaison
visuelle (ports 3010 et 3011).

- [ ] **Étape 8 : Rendre la main**

Ne pas pousser. Présenter à l'utilisateur : l'état de la branche, le
résultat de la porte de vérification, les findings de revue traités, et le
rappel des deux étapes manuelles qui conditionnent le déploiement — les
clés `GEMINI_API_KEY` et `FAL_KEY` sur Vercel, et l'activation du
changement de palier dans le portail Stripe.
