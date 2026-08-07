# Migration fal.ai → kie.ai (vidéo) — Design

Date : 2026-08-07
Statut : Approuvé

## Contexte

La génération vidéo (`app/api/generate-video/route.ts`) utilise aujourd'hui
`fal-ai/kling-video/v3/pro/image-to-video` sur fal.ai, et l'upload des
images source/objet passe par `fal.storage.upload()` côté client
(`app/page.tsx`), relayé par le proxy `app/api/fal/proxy/route.ts`
(`@fal-ai/server-proxy`).

fal.ai est actuellement bloqué en production faute de moyen de paiement
configuré sur le compte (`Forbidden` constaté lors du test de la preview
Vercel, session du 2026-07-30). L'utilisateur a un compte kie.ai déjà
créé, avec une clé API existante ("Default", non encore utilisée) mais un
solde à 0 crédit — kie.ai revend les mêmes modèles (dont Kling 3.0) à un
tarif généralement ~20-30% inférieur au prix officiel/fal.ai.

Recherche menée dans cette session sur `kie.ai/fr/pricing`, le catalogue
de modèles (`kie.ai/kling-3-0`) et `docs.kie.ai` :

- Le modèle `kling-3.0/video` de kie.ai expose un mode `pro`, équivalent
  du `kling-video/v3/pro` actuel, et supporte la **référence d'élément**
  via la syntaxe `@element_name` dans le prompt — exactement le mécanisme
  déjà utilisé (`@Element1`) pour insérer l'objet de luxe dans la vidéo.
  Migration du prompt/logique métier minimale.
- L'API kie.ai est **asynchrone** : `POST /api/v1/jobs/createTask` renvoie
  un `task_id` immédiatement ; le résultat s'obtient soit par callback
  (webhook), soit par polling d'un endpoint de statut avec ce `task_id`.
- kie.ai expose aussi une **File Upload API** propre et gratuite
  (`https://kieai.redpandaai.co`, modes base64/stream/URL), qui peut
  remplacer entièrement `fal.storage.upload()`.

Ce chantier est indépendant du chantier 3 (débit des crédits à la
génération, spec séparée) — il touche uniquement le fournisseur vidéo
sous-jacent, pas la logique de crédits.

## Objectifs

### Route vidéo (`app/api/generate-video/route.ts`)

- Remplacer l'appel `fal.subscribe(MODEL_ID, ...)` par :
  1. `POST https://api.kie.ai/api/v1/jobs/createTask` avec
     `{ model: "kling-3.0/video", input: { prompt, image_urls: [...],
     mode: "pro", ... } }`, authentifié via `Authorization: Bearer
     ${KIE_API_KEY}`.
  2. Polling de l'endpoint de statut de tâche kie.ai (via le `task_id`
     reçu) jusqu'à complétion ou échec, dans la limite du `maxDuration =
     300` déjà en place sur la route (pas de webhook — voir Approche
     retenue ci-dessous).
  3. Extraction de l'URL vidéo depuis la réponse de la tâche terminée.
- Le prompt garde la construction actuelle (`@Element1` + texte
  d'intégration de l'objet) — seule la structure `elements` fal.ai
  (`frontal_image_url`) est remplacée par l'équivalent kie.ai (nom de
  champ exact à confirmer contre la doc/le premier appel réel au moment
  du plan, même traitement que les points de vérification des specs de
  migration précédentes de ce repo).
- Le contrat de la route (`sourceImageUrl`, `objectImageUrl`, `prompt` en
  entrée ; `{ videoUrl }` en sortie) ne change pas — aucune modification
  côté frontend au-delà du point suivant.

### Hébergement image (remplace `fal.storage.upload`)

- Nouvelle route serveur `app/api/kie/upload/route.ts` : reçoit le
  fichier envoyé par le client, le transmet côté serveur à
  `POST https://kieai.redpandaai.co/api/file-stream-upload` avec
  `KIE_API_KEY` (jamais exposée au navigateur, conformément à la doc
  kie.ai), et renvoie l'URL publique (`fileUrl`) au client.
- Dans `app/page.tsx`, les deux appels `fal.storage.upload(videoSource.file
  / videoObject.file)` sont remplacés par un appel `fetch` vers cette
  nouvelle route.
- Fichiers expirent après 24h chez kie.ai — sans impact, l'URL n'est
  utilisée que le temps de la génération immédiate qui suit l'upload.

### Config & nettoyage

- Nouvelle variable d'environnement `KIE_API_KEY` (locale + Vercel,
  Production + Preview), remplace `FAL_KEY`.
- Suppression complète : `app/api/fal/proxy/route.ts`, les dépendances
  `@fal-ai/client` et `@fal-ai/server-proxy` du `package.json`, l'appel
  `fal.config({ proxyUrl: ... })` en tête de `app/page.tsx`.
- Mise à jour de la mention inline "Kling 3.0 Pro via fal.ai" affichée
  près de l'onglet Vidéo de la page d'accueil (`app/page.tsx`, ~ligne
  823) pour ne plus mentionner fal.ai.
- Recherche des autres mentions de "fal.ai"/"fal.storage" dans le code
  applicatif (`app/a-propos/page.tsx`, `README.md`) et mise à jour
  cohérente, même traitement que les migrations de modèles précédentes
  de ce repo (contenu informatif mis à jour, historique des specs/plans
  jamais réécrit rétroactivement).

## Approche retenue : polling plutôt que webhook

kie.ai propose polling ou callback webhook pour récupérer le résultat
d'une tâche asynchrone. Le polling est retenu (confirmé avec
l'utilisateur) : la route existante a déjà un `maxDuration` de 300s et
peut interroger le statut périodiquement jusqu'à complétion, sans
nécessiter de nouvelle route publique ni de complexité supplémentaire en
développement local (un callback nécessiterait une URL joignable
publiquement par kie.ai, ce qui complique le test en local).

## Non-objectifs

- Pas de migration de la route image (`app/api/generate/route.ts`,
  Gemini 3 Pro Image) — kie.ai n'est utilisé que pour la vidéo (Kling) et
  l'hébergement d'image, Gemini reste appelé directement via l'API
  Google.
- Pas de changement de la logique métier de crédits — chantier séparé
  (débit des crédits à la génération), spec distincte.
- Pas de changement des paramètres de sortie vidéo actuels (`duration:
  "5"`, `generate_audio: false`, mode `pro`) — migration de fournisseur à
  l'identique, pas de changement de qualité/résolution.
- Pas de webhook/callback — polling uniquement (voir Approche retenue).

## Architecture

Migration localisée à : `app/api/generate-video/route.ts` (remplacement
de l'appel fal.ai par create-task + polling kie.ai), une nouvelle route
`app/api/kie/upload/route.ts`, `app/page.tsx` (remplacement des deux
appels `fal.storage.upload`, mise à jour du texte "via fal.ai"), retrait
de `app/api/fal/proxy/route.ts` et des dépendances fal.ai du
`package.json`. Aucun changement de schéma de données, aucun lien avec
les chantiers Supabase/Stripe/crédits en cours.

## Gestion des erreurs

- Timeout de polling proche de la limite des 300s → même réponse 504
  qu'aujourd'hui ("La génération a dépassé le délai...").
- Statut de tâche "failed" côté kie.ai → réponse 502 avec le détail
  renvoyé par l'API, même pattern que l'erreur de service actuelle.
- Point à vérifier pendant l'implémentation, pas bloquant pour cette
  spec : confirmer si kie.ai facture les crédits d'une tâche qui échoue
  (comportement à observer via un test réel plutôt qu'à supposer).

## Vérification

Pas de framework de tests dans ce projet. Vérification manuelle après
implémentation (nécessite que l'utilisateur ait ajouté des crédits sur
son compte kie.ai, solde actuellement à 0) :

- Upload d'image réelle via la nouvelle route `app/api/kie/upload` :
  l'URL renvoyée est accessible publiquement.
- Génération vidéo réelle **sans** photo de référence : comportement
  équivalent à la version fal.ai actuelle.
- Génération vidéo réelle **avec** photo de référence : l'objet inséré
  via la référence d'élément kie.ai doit être visuellement fidèle à la
  photo fournie, au même niveau que le rendu fal.ai actuel.
- Plus aucune mention "fal.ai" visible dans l'UI ni dans le code
  applicatif (hors historique de specs/plans).
- `npm run build` (ou `npm run lint`) passe sans erreur après retrait des
  dépendances `@fal-ai/*`.
