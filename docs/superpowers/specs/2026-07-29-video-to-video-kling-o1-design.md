# Passage à Kling O1 video-to-video — Design

Date : 2026-07-29
Statut : Approuvé

## Contexte

L'onglet Vidéo utilise aujourd'hui `fal-ai/kling-video/o3/standard/image-to-video`
(`app/api/generate-video/route.ts:7`) : ce modèle prend une **image fixe**
en entrée (`image_url`) et l'anime en un clip de 5s. Le champ d'upload
principal est pourtant libellé "Image source" alors que le produit voulu
est un vrai remplacement d'objet **dans une vidéo existante** fournie par
l'utilisateur (jusqu'à 200 Mo, MP4/MOV) — ce que Kling O3 image-to-video ne
peut pas faire.

## Objectif

Migrer vers `fal-ai/kling-video/o1/video-to-video/edit`, un éditeur vidéo
en langage naturel qui prend une vidéo source + un prompt (avec tags
`@Element1`, `@Element2`… référençant des images de remplacement) et rend
une vidéo éditée en préservant le mouvement et la caméra d'origine.

## ⚠️ Risque connu : schéma d'API non confirmé

fal.ai bloque les accès automatisés à ses pages de documentation (429 sur
toutes les tentatives, WebFetch et navigateur). Le schéma d'entrée exact de
`fal-ai/kling-video/o1/video-to-video/edit` n'a **pas** pu être vérifié.

Les noms de champs utilisés dans cette spec (`video_url`, `image_urls`,
`prompt`) sont une hypothèse basée sur les conventions déjà observées sur
Kling O3 dans ce repo, pas une certitude. Le plan d'implémentation traite
le premier appel réel (avec la vraie clé `FAL_KEY` de l'utilisateur) comme
partie de la vérification de la tâche : si fal.ai renvoie une erreur de
validation de schéma, son message énumère généralement le(s) champ(s)
attendu(s), et le nom de champ est corrigé sur cette base.

## Non-objectifs

- Pas de limite de durée supplémentaire sur la vidéo source uploadée
  (au-delà de la taille de 200 Mo) — le `maxDuration = 300` (5 min) de la
  fonction Vercel existante est conservé tel quel ; si le traitement d'une
  vidéo plus longue s'avère systématiquement plus long que 5 min en
  pratique, ce sera un chantier séparé.
- Pas de changement sur l'onglet Image, ni sur le champ "Objet (optionnel)"
  qui reste une image de référence (photo de l'objet de luxe à intégrer).
- Pas de traitement/compression côté client de la vidéo uploadée (elle est
  envoyée telle quelle à `fal.storage.upload`, comme c'est déjà le cas
  aujourd'hui pour les images).

## Changements

### Backend — `app/api/generate-video/route.ts`

- `MODEL_ID` devient `"fal-ai/kling-video/o1/video-to-video/edit"`.
- Le body accepté devient `{ sourceVideoUrl?: string; objectImageUrl?: string; prompt?: string }`
  (renommage de `sourceImageUrl` en `sourceVideoUrl` — c'est désormais une
  vraie vidéo).
- Message d'erreur si source manquante : "Vidéo source manquante. Uploadez
  une vidéo puis réessayez." (au lieu de "Image source manquante").
- Input envoyé à `fal.subscribe` :
  - `video_url: sourceVideoUrl`
  - `prompt: finalPrompt`
  - `image_urls: [objectImageUrl]` uniquement si `objectImageUrl` est fourni
    (tableau à un seul élément — correspond à `@Element1` dans le prompt).
- Suppression des champs `duration` et `generate_audio` : spécifiques au
  schéma de Kling O3 image-to-video (qui génère un clip de 5s ex-nihilo),
  sans équivalent connu pour un éditeur qui transforme une vidéo déjà
  existante et en préserve la durée.
- Quand `objectImageUrl` est fourni, le prompt final référence
  explicitement `@Element1` :
  `${prompt} Replace the target luxury object in the video with @Element1, preserving the original motion, camera angles, lighting and background.`
  (remplace l'instruction actuelle qui mentionnait l'image par son URL brute).
- `extractVideoUrl` (forme de la réponse `{data:{video:{url}}}` ou
  `{video:{url}}`) reste inchangée — hypothèse à plus faible risque, ce
  format est cohérent avec les autres modèles vidéo de fal.ai déjà vus dans
  ce repo.

### Frontend — `app/page.tsx`

- Nouvelle constante `MAX_VIDEO_FILE_BYTES = 200 * 1024 * 1024`.
- Nouvelle fonction `validateVideoFile(file: File): string | null` :
  accepte uniquement `video/mp4` et `video/quicktime` (MOV), rejette au-delà
  de `MAX_VIDEO_FILE_BYTES`, message d'erreur dédié.
- `pickVideoUpload` : utilise `validateVideoFile` pour `kind === "source"`
  et continue d'utiliser `validateImageFile` (inchangé) pour
  `kind === "object"`.
- `DropZone` : deux nouvelles props `accept: string` et `formatHint: string`
  (remplacent le `accept="image/*"` et le texte `"JPG, PNG, WebP — max 10 Mo"`
  actuellement codés en dur dans le composant), pour que les deux
  instances (source vidéo vs objet image) puissent différer. L'aperçu
  affiché quand un fichier est sélectionné devient conditionnel : `<video>`
  (avec `controls`, sans autoplay) si `upload.file.type` commence par
  `"video/"`, sinon `<img>` comme aujourd'hui.
- Textes mis à jour sur le premier `DropZone` :
  `label="Vidéo source (requise)"`, `hint="Votre vidéo source"`,
  `accept="video/mp4,video/quicktime"`,
  `formatHint="MP4, MOV — max 200 Mo"`.
- Le second `DropZone` ("Objet (optionnel)") passe explicitement
  `accept="image/*"` et `formatHint="JPG, PNG, WebP — max 10 Mo"` (mêmes
  valeurs qu'aujourd'hui, mais désormais explicites plutôt que codées en
  dur dans le composant).
- `generateVideo` : renomme la variable locale `sourceImageUrl` en
  `sourceVideoUrl`, envoie `{ sourceVideoUrl, objectImageUrl, prompt }` au
  lieu de `{ sourceImageUrl, objectImageUrl, prompt }`. Le message d'erreur
  "Veuillez uploader une image source." devient "Veuillez uploader une
  vidéo source.".

## Gestion des erreurs

- Validation client (type de fichier, taille) avant tout upload, comme le
  pattern déjà en place pour les images.
- Si le premier appel réel à Kling O1 échoue à cause d'un nom de champ
  incorrect (risque documenté ci-dessus), l'erreur fal.ai est déjà
  remontée à l'utilisateur via `setVideoError` (mécanisme existant,
  inchangé) — elle sera aussi lue pendant le développement pour corriger le
  schéma si besoin.

## Vérification

Pas de suite de tests dans ce projet. Vérification manuelle :

- Upload d'une vraie vidéo MP4 comme source : acceptée, aperçu vidéo affiché.
- Upload d'un fichier > 200 Mo ou d'un format non vidéo comme source :
  rejeté avec le bon message d'erreur.
- Upload d'une image comme objet (optionnel) : comportement inchangé.
- Appel réel de génération avec la clé `FAL_KEY` de l'utilisateur : si
  succès, la vidéo éditée s'affiche comme aujourd'hui ; si erreur de schéma,
  ajuster les noms de champs d'après le message d'erreur renvoyé par fal.ai.
- L'onglet Image reste inchangé.
