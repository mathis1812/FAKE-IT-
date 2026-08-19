# Réconciliation des branches locale et Replit — design

**Date :** 2026-08-19
**Statut :** validé, prêt pour le plan d'implémentation

## Problème

`main` local et `origin/main` ont divergé de 34 commits chacun à partir de
l'ancêtre commun `5fb567d` (2026-08-09 16:28). La production tourne sur
`origin/main` via le déploiement automatique GitHub Actions, donc sur la
ligne Replit. Les 34 commits locaux (09→17/08) ne sont ni poussés, ni en
production.

Chaque nouvelle fonctionnalité développée d'un côté creuse l'écart. La
réconciliation est le préalable à toute amélioration produit.

### Ce que chaque ligne contient

**Ligne locale (09→17/08)** — refonte `/compte` en dashboard 2 colonnes,
résolution image dynamique par palier (1K/2K/4K), upgrade/downgrade de
palier via le portail Stripe, migration de la génération photo vers l'API
Gemini directe, video-to-video Kling O1 sur fal.ai avec upload direct
Supabase Storage et validation du fichier source, chrono et barre de
progression perçue.

**Ligne Replit (18→19/08, en production)** — rebranding Bluminoo Studio,
correctifs de production critiques (middleware Edge jose 6.x,
`serverExternalPackages` qui cassait le bundle client, build distant
Vercel pour les variables Sensitive), fonctionnalité « Intégration dans un
vrai lieu » (1 à 3 photos, prompt auto-généré par analyse vision), couche
de partage complète (Snapchat, Snap Rouge, Story 9:16, téléchargement
9:16, partage depuis la galerie) extraite dans `lib/share-utils.ts`,
introduction de vitest avec 279 lignes de tests sur le partage.

### Conflits réels

`git merge-tree` confirme que **deux fichiers seulement** entrent en
conflit : `app/page.tsx` et `app/api/generate/route.ts`. Les 32 autres
fichiers s'auto-fusionnent.

## Décisions prises

| Décision | Choix | Raison |
|---|---|---|
| Base d'interface | `origin/main` (Replit) | Déjà en production et éprouvée ; les briques locales à réinjecter sont mieux délimitées que l'inverse |
| Génération photo | API Gemini directe (`gemini-3-pro-image-preview`) | Choix explicite de l'utilisateur |
| Champ prompt libre | Conservé tel quel | Existe déjà dans la base Replit (`id="user-note"`), câblé jusqu'à `place-prompt.ts` via `userNote` — aucun travail |
| vitest | Adopté, non étendu | Les tests existants passent en production ; on ne les supprime pas, on n'ouvre pas de chantier de couverture pendant la réconciliation |
| Stratégie git | Merge classique | Préserve l'historique et l'attribution des deux lignes ; les conflits sont circonscrits |

## Architecture cible

Trois fournisseurs, aux rôles disjoints :

| Service | Rôle | Clé | Fichier |
|---|---|---|---|
| Gemini (direct) | Génération image | `GEMINI_API_KEY` | `lib/gemini-jobs.ts` |
| fal.ai | Vidéo `kling-video/o1/video-to-video/edit` | `FAL_KEY` | `lib/fal-jobs.ts` |
| kie.ai | Hébergement des uploads image + analyse vision du lieu | `KIE_API_KEY` | `app/api/kie/upload/`, `lib/place-prompt.ts` |

### Flux image

Photo sujet et 1 à 3 photos du lieu → upload kie.ai (URLs publiques) →
`buildPlacePrompt` analyse les photos du lieu et rédige le prompt, en y
tissant `userNote` si l'utilisateur l'a rempli → `generateGeminiImage`
télécharge les URLs et les envoie en base64 inline à Gemini, à la
résolution du palier → `persistImageBytes` enregistre le résultat dans
Supabase Storage et la galerie.

Gemini reçoit les images en base64 inline, pas en URL. L'hébergement
kie.ai reste néanmoins nécessaire : `buildPlacePrompt` en a besoin pour
son appel vision, et la galerie manipule des URLs.

### Flux vidéo

Inchangé par rapport à la version locale : validation côté client
(720–2160 px de large, 3 à 10 s, 50 Mo maximum) → upload direct Supabase
Storage → fal.ai Kling O1, photo de l'objet référencée par `@Image1`.

`app/api/generate-video/route.ts` et `lib/kie-jobs.ts` n'ont pas été
modifiés par Replit ; le merge prend donc automatiquement la version
locale de la route vidéo, sans conflit.

## Résolution des conflits

### `app/api/generate/route.ts`

Base Replit, quatre modifications :

1. **Garde des clés** — la route exige désormais `KIE_API_KEY` (pour
   `buildPlacePrompt`) et `GEMINI_API_KEY` (pour la génération), chacune
   vérifiée séparément avec son propre message d'erreur.
2. **Résolution par palier** — lecture de `profiles.plan` →
   `PLANS[planId].imageResolution`, en remplacement du `resolution: "1K"`
   codé en dur, avec repli sur `1K` si la lecture échoue.
3. **Bloc de génération** — `createKieTask` / `pollKieTask` /
   `persistImageResult` devient `generateGeminiImage` /
   `persistImageBytes`. Le débit des crédits avant génération et le
   remboursement dans le `catch` sont identiques des deux côtés, donc
   inchangés.
4. **Messages** — « Erreur du service de génération kie.ai » devient
   « Gemini ».

La route Replit conserve deux chemins : si des photos de lieu sont
fournies, flux « vrai lieu » ; sinon, ancien flux `prompt` +
`objectImageUrl`. **Ce double chemin est préservé** — le cas d'usage
« remplacer un objet » survit côté serveur.

`buildPlacePrompt` rattrape toutes ses erreurs en interne et retombe
toujours sur `fallbackPlacePrompt`. Il ne peut donc pas faire fuiter de
crédits bien qu'il soit appelé hors du `try/catch` de remboursement.
**Cette propriété ne doit pas être cassée** : si un jour la fonction peut
lever, l'appel devra passer dans le `try`.

**Régression assumée :** Gemini est synchrone, sans file d'attente à
interroger. La branche `TIMEOUT` → 504, propre au polling, disparaît. Un
dépassement de délai remontera en 502 avec le message de l'erreur réseau,
moins lisible. C'est déjà le comportement de la route locale actuelle.

### `app/page.tsx`

Base Replit, dans laquelle on réinjecte quatre blocs délimités :

- **Constantes et validation de la vidéo source** — `MIN_VIDEO_WIDTH`
  (720), `MAX_VIDEO_WIDTH` (2160), durée 3 à 10 s,
  `MAX_VIDEO_SOURCE_BYTES` (50 Mo), avec lecture des métadonnées avant
  upload.
- **`uploadVideoDirect`** — upload direct vers Supabase Storage,
  contournant la limite de taille des fonctions Vercel.
- **`useElapsedProgress`** — chrono et barre de progression perçue, plus
  leur affichage dans les deux panneaux.
- **Câblage de la soumission vidéo** vers la route fal.ai, avec
  compression de la photo de l'objet à `MAX_VIDEO_FILE_BYTES` (4 Mo),
  correctif du 413.

Correction au passage : les deux versions affichent encore « Kling 3.0 Pro
via kie.ai » dans l'onglet Vidéo, faux depuis la migration. Devient
« Kling O1 via fal.ai ».

## Nettoyage

**Code mort à supprimer**, après le swap Gemini et pas avant :

- `lib/kie-jobs.ts` (106 lignes) — plus aucun import une fois la
  génération passée sur Gemini ; seul consommateur de
  `MODEL_ID = "nano-banana-pro"`.
- `lib/aleph-jobs.ts` (154 lignes) — reliquat de l'expérience Runway
  Gen-4 revertée le 17/08, jamais importé.

**Configuration :**

- `.env.example` — ajouter `GEMINI_API_KEY` et `FAL_KEY`, aujourd'hui
  absents alors que les deux sont requis.
- `next.config.mjs` — restaurer l'indentation cassée par Replit et la
  newline finale manquante.
- `README.md` — refléter Gemini 3 Pro Image, Kling O1 sur fal.ai, et
  l'analyse vision kie.ai.

## Étapes manuelles préalables au déploiement

Ces deux étapes relèvent de l'utilisateur et conditionnent le succès de
la mise en production :

1. **Ajouter `GEMINI_API_KEY` et `FAL_KEY` sur Vercel** avant le push. La
   production tourne aujourd'hui sur kie.ai seul ; sans ces clés, l'image
   et la vidéo tombent simultanément au premier déploiement.
2. **Activer le changement de palier dans Stripe** (« Customers can switch
   plans » et les 6 prix listés dans le portail). Sans cela, chaque clic
   sur « Passer à ce palier » renverra un 502 — à ne pas confondre avec un
   bug de code. Cette étape est en attente depuis le 10/08.

## Vérification

Le travail se fait sur une **branche dédiée** créée depuis `main`, jamais
directement sur `main` : un push sur `main` déclenche le déploiement
production automatiquement.

**Porte de vérification**, les trois obligatoires dans cet ordre :
`npx tsc --noEmit`, `npm run build`, `npm test`. La leçon du 30/07 tient :
`tsc` seul avait laissé passer une erreur ESLint cassant le build, et
n'aurait pas vu le crash Stripe au chargement du module.

**Vérification manuelle** sur le serveur de dev : onglet Image avec photos
du lieu et note optionnelle ; onglet Vidéo en confirmant qu'une vidéo trop
courte ou trop basse résolution est refusée avant upload ; puis Galerie,
`/compte` et `/tarifs`.

La génération réelle n'est pas testable en local, les clés manquent. Elle
se validera sur un **déploiement preview Vercel** avant toute mise en
production.

Ensuite : revue de branche complète, puis merge vers `main` et push
**uniquement sur feu vert explicite de l'utilisateur**, puisque ce push
déploie.

**Ménage de fin de chantier :** supprimer le worktree `fakeit-replit` et
arrêter les deux serveurs de dev lancés pour la comparaison visuelle.

## Hors périmètre

- **Coût par génération.** La fonctionnalité « vrai lieu » ajoute un appel
  vision kie.ai avant chaque génération d'image, non reflété dans les 150
  crédits actuels d'`IMAGE_GENERATION_COST`. À revoir après la
  réconciliation.
- **Extension de la couverture de tests** au-delà des tests de partage
  existants.
- **Toute amélioration produit** : la réconciliation ne change aucun
  comportement au-delà de ce qui est décrit ici.
