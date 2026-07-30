# Migration Gemini 3 Pro Image + Kling 3.0 Pro — Design

Date : 2026-07-30
Statut : Approuvé

## Contexte

Bluminoo Studio génère aujourd'hui ses images via Gemini 2.5 Flash Image
(`app/api/generate/route.ts`) et ses vidéos via Kling O3 sur fal.ai
(`app/api/generate-video/route.ts`, `fal-ai/kling-video/o3/standard/image-to-video`).

Une recherche comparative qualité/prix menée dans cette session (modèles
disponibles mi-2026) a conclu que **Gemini 3 Pro Image** ("Nano Banana Pro")
et **Kling 3.0 Pro** offrent un meilleur rendu pour le cas d'usage exact de
l'app (intégration photoréaliste d'un objet/décor de luxe dans une photo ou
une vidéo, souvent avec une personne) :

- Gemini 3 Pro Image : meilleur rendu photoréaliste avec personnes
  (mains, visages), même fournisseur que le modèle actuel.
- Kling 3.0 Pro : dispose d'un système `elements` (`@Element1`, etc.) pensé
  précisément pour insérer un objet/décor à partir d'une photo de
  référence — ce que l'implémentation actuelle ne fait pas correctement
  (voir Objectifs).

## Objectifs

### Route image (`app/api/generate/route.ts`)

- Remplacer l'URL du modèle par le modèle Gemini 3 Pro Image
  (nom de modèle encore au statut "preview" côté Google au moment de cette
  spec — l'identifiant exact sera reconfirmé lors du premier appel réel,
  au moment du plan/implémentation, avant d'être figé dans le code).
- Le format de requête/réponse (`contents[0].parts`, extraction de
  `inlineData`/`inline_data`) reste inchangé — même famille d'API Gemini.
  Aucune restructuration de code au-delà du changement de constante.
- La logique de retry existante (un deuxième essai si le modèle renvoie du
  texte au lieu d'une image) est conservée telle quelle.
- Pas de sélecteur de résolution 4K pour l'instant — résolution standard
  uniquement (le 4K deviendra pertinent avec le futur système de paliers/
  crédits, chantier séparé, non commencé).

### Route vidéo (`app/api/generate-video/route.ts`)

- Remplacer `MODEL_ID` par `fal-ai/kling-video/v3/pro/image-to-video`.
- **Correction de fond, demandée explicitement** : aujourd'hui, quand une
  photo de l'objet de remplacement est fournie, son URL est simplement
  concaténée dans le texte du prompt ("Use the luxury replacement object
  from this reference image as visual guidance: <url>"). Ce n'est pas une
  vraie image de référence pour le modèle. Kling 3.0 Pro expose un
  paramètre `elements` fait pour ça : quand `objectImageUrl` est fourni,
  construire `elements: [{ image_url: objectImageUrl }]` et référencer
  l'élément dans le prompt via `@Element1` (au lieu de coller l'URL en
  texte brut).
- `duration` et `generate_audio` restent aux valeurs actuelles (`"5"`,
  `false`) — aucune raison de les revoir dans ce chantier.
- Le nom exact des champs de l'API `elements` (structure de chaque entrée
  du tableau, contraintes de format d'image) sera reconfirmé contre la
  documentation fal.ai live ou un premier appel réel au moment du plan —
  traité comme point de vérification, pas comme un risque bloquant (même
  convention que la spec `2026-07-29-video-to-video-kling-o1-design.md`
  déjà présente dans ce repo pour un cas similaire).
- Le contrat de la route (`sourceImageUrl`, `objectImageUrl`, `prompt` en
  entrée ; `{ videoUrl }` en sortie) ne change pas — aucune modification
  côté frontend (`app/page.tsx`) n'est nécessaire.

### Contenu à mettre en cohérence

Recherche exhaustive des mentions des anciens modèles dans le code
applicatif (hors historique de specs/plans, qui reste un enregistrement
figé de décisions passées et n'est jamais réécrit rétroactivement) :

- `app/layout.tsx` : **supprimer entièrement** la ligne de badge footer
  "Gemini Flash Image · Kling O3 · React Bits" — demande explicite de
  l'utilisateur, pas de remplacement par un badge équivalent.
- `app/a-propos/page.tsx` : mettre à jour la mention FAQ ("Propulsé par
  Google Gemini 2.5 Flash Image... Kling O3...") avec les nouveaux noms de
  modèles — contenu informatif sur le fonctionnement du produit, distinct
  du badge décoratif ci-dessus, donc conservé et actualisé.
- `app/page.tsx` (ligne ~823) : mettre à jour la mention inline "Kling O3
  via fal.ai" près de l'onglet Vidéo avec le nouveau nom de modèle.
  L'estimation de temps de génération affichée (~90 s) n'est ajustée que
  si la vérification manuelle (voir plus bas) révèle un écart significatif.
- `README.md` : mettre à jour les noms de modèles et la section "Coût"
  (prix par image/vidéo) avec les tarifs réels de Gemini 3 Pro Image et
  Kling 3.0 Pro trouvés durant la recherche de cette session.

## Non-objectifs

- Pas de migration vidéo-to-vidéo (upload direct d'une vidéo source en
  entrée) — chantier distinct et sans rapport (spec déjà existante :
  `docs/superpowers/specs/2026-07-29-video-to-video-kling-o1-design.md`),
  confirmé hors périmètre par l'utilisateur ("si je veux du vidéo to vidéo
  après c'est bon" — pourra être repris plus tard, indépendamment).
- Pas de sélecteur de résolution 4K pour l'image.
- Pas de changement des clés API ni des variables d'environnement — même
  fournisseurs (Google, fal.ai), donc `GEMINI_API_KEY` et `FAL_KEY`
  restent valables tels quels.
- Pas de changement du `maxDuration = 300` de la route vidéo, sauf si la
  vérification manuelle révèle que Kling 3.0 Pro est sensiblement plus
  lent que Kling O3 (auquel cas l'ajustement est trivial et fait sur
  place, pas un chantier séparé).
- Aucun remplacement du badge footer supprimé par un équivalent — l'espace
  reste simplement vide (pas de nouvelle mention de technologie dans le
  footer).

## Architecture

Migration localisée à 2 fichiers de route API (changement de constante +
restructuration ciblée de la construction du payload fal.ai pour la vidéo)
et 3 fichiers de contenu (`app/layout.tsx`, `app/a-propos/page.tsx`,
`app/page.tsx`) plus `README.md`. Aucune nouvelle dépendance, aucun
nouveau fichier, aucun changement de schéma de données (pas de lien avec
les chantiers Supabase/crédits en cours).

## Gestion des erreurs

Les chemins d'erreur existants (clé API manquante, JSON invalide, image
source manquante, prompt manquant, absence de retour du modèle, erreur du
service) sont conservés à l'identique dans les deux routes — seuls les
identifiants de modèle et la construction du payload vidéo changent, pas
la structure de gestion des erreurs autour.

## Vérification

Pas de framework de tests dans ce projet. Vérification manuelle après
implémentation :

- Génération d'image réelle avec le nouveau modèle : rendu correct, pas
  de régression sur la logique de retry.
- Génération vidéo réelle **sans** photo de référence : comportement
  identique à aujourd'hui (juste un nouveau modèle).
- Génération vidéo réelle **avec** photo de référence : l'objet inséré via
  `elements`/`@Element1` doit être visuellement fidèle à la photo fournie
  (c'est le point précis que corrige ce chantier — à comparer visuellement
  à un rendu Kling O3 équivalent si possible).
- Footer : le badge de technologies n'apparaît plus sur aucune page.
- `/a-propos` et l'onglet Vidéo de la page d'accueil mentionnent les
  nouveaux noms de modèles, `README.md` est à jour.
- Aucune régression sur les routes `app/api/generate*` pour des requêtes
  sans rapport avec le changement (mêmes codes d'erreur, mêmes messages).
