# Galerie locale + reveal dramatisé — Design

Date : 2026-07-29
Statut : Approuvé

## Contexte

L'app n'a aujourd'hui **aucune persistance** : ni base de données, ni
compte utilisateur, ni sauvegarde des générations. La page `/galerie`
(`app/galerie/page.tsx`) est un simple placeholder "bientôt disponible".
L'objectif produit est d'augmenter la rétention/l'engagement ("dopamine",
envie de revenir) tout en gardant la direction artistique actuelle
(fond animé violet, panneaux vitrés) — sans repartir sur un redesign
visuel, et sans construire un vrai backend pour l'instant (chantier
volontairement séparé, comme pour Tarifs/crédits).

Deux ajouts couvrent cet objectif :

1. Une **Galerie locale** qui sauvegarde automatiquement chaque
   génération réussie (image et vidéo) dans le navigateur.
2. Un **reveal dramatisé** de l'attente et de l'apparition du résultat,
   sur l'onglet Image comme sur l'onglet Vidéo.

## Objectifs

- Chaque génération réussie (image via `generate()`, vidéo via
  `generateVideo()`, dans `app/page.tsx`) est automatiquement enregistrée
  dans un store local.
- `/galerie` affiche les générations sauvegardées (miniature + date +
  libellé), les 15 plus récentes ; au-delà, la plus ancienne est
  automatiquement supprimée à l'ajout d'une nouvelle.
- Pendant le chargement (image ou vidéo), des messages qui tournent
  remplacent le texte statique actuel ("Rendu photoréaliste en cours…").
- L'apparition du résultat utilise une animation d'entrée plus travaillée
  qu'un simple fondu, tout en respectant `prefers-reduced-motion` (déjà
  géré dans `app/globals.css:60-65` pour `animate-fade-up`/
  `animate-fade-up-delay`).

## Non-objectifs

- Pas de backend, pas de compte, pas de synchronisation entre appareils —
  la Galerie est strictement locale au navigateur (IndexedDB).
- Pas de garantie de pérennité des vidéos : les URLs renvoyées par fal.ai
  ne sont pas garanties permanentes. Si une URL vidéo sauvegardée expire
  côté fal.ai, la miniature correspondante dans la Galerie locale cessera
  de fonctionner — c'est une limite acceptée, pas un bug à corriger dans
  ce chantier (résoudrait un vrai stockage backend, hors scope).
- Pas de suppression manuelle d'entrées individuelles par l'utilisateur
  dans cette première version (seule la purge automatique au-delà de 15
  existe).
- Pas de streak/compteur de générations quotidien — évoqué en option plus
  légère, mais pas retenu dans ce chantier ; à reconsidérer séparément si
  souhaité plus tard.

## Architecture

### Store local — `lib/gallery.ts` (nouveau fichier)

Utilise l'API `indexedDB` native du navigateur (aucune dépendance
supplémentaire — le projet n'a que `@fal-ai/client`, `next`, `react`,
`react-dom`, `three`). Une seule base, un seul object store `entries`,
clé `id` (chaîne, générée via `crypto.randomUUID()`).

Schéma d'une entrée :

```ts
type GalleryEntry = {
  id: string;
  mode: "image" | "video";
  createdAt: number; // Date.now()
  resultUrl: string; // data URI (image) ou URL fal.ai (vidéo)
  beforeUrl?: string; // aperçu "avant", uniquement pour le mode image
  label: string; // ex. "Montre", "Voiture", "Lieu", ou "Remplacement d'objet"
};
```

Fonctions exposées :
- `addGalleryEntry(entry: Omit<GalleryEntry, "id" | "createdAt">): Promise<void>`
  — génère `id`/`createdAt`, insère, puis purge les entrées au-delà des 15
  plus récentes (triées par `createdAt` décroissant).
- `listGalleryEntries(): Promise<GalleryEntry[]>` — retourne les entrées
  triées de la plus récente à la plus ancienne.

Ces fonctions ne sont appelées que côté client (le composant qui les
utilise a déjà `"use client"`, comme tout `app/page.tsx` et le futur
`app/galerie/page.tsx`).

### Intégration dans `app/page.tsx`

- Dans `generate()` : juste après `setResult(...)` en cas de succès,
  appeler `addGalleryEntry({ mode: "image", resultUrl: <data URI reçue>, beforeUrl: prepared.previewUrl, label: PRESETS[category].label })`.
- Dans `generateVideo()` : juste après `setVideoUrl(data.videoUrl)` en cas
  de succès, appeler `addGalleryEntry({ mode: "video", resultUrl: data.videoUrl, label: "Remplacement d'objet" })`.
- Ces appels sont "fire-and-forget" (pas de blocage de l'UI si l'écriture
  IndexedDB échoue — on log en console, sans afficher d'erreur utilisateur,
  puisque la génération elle-même a réussi).

### `app/galerie/page.tsx` (réécriture, passe de composant serveur à client)

- `"use client"`, charge les entrées via `listGalleryEntries()` dans un
  `useEffect` au montage.
- Si aucune entrée : réutilise `PlaceholderSection` existant, avec un
  texte mis à jour (plus "bientôt disponible" puisque la fonctionnalité
  existe désormais, juste vide pour l'instant — ex. "Vos prochaines
  générations apparaîtront ici.").
- Sinon : grille de cartes, une par entrée — miniature (`<img>` si
  `mode === "image"`, `<video muted loop controls={false}>`
  avec lecture au survol ou statique — à trancher en plan) + libellé +
  date formatée, dans le style visuel déjà établi (`Panel`, accent
  `primary`).

### Reveal dramatisé — `app/page.tsx` + `app/globals.css`

- Nouveau tableau de messages rotatifs, ex. :
  `["Analyse de la lumière…", "Ajustement des reflets…", "Intégration du luxe…", "Finalisation du rendu…"]`,
  affiché à la place du texte statique actuel
  ("Rendu photoréaliste en cours…", `app/page.tsx:731`), et ajouté côté
  vidéo pendant `videoLoading` (qui n'a aujourd'hui pas de bloc de
  chargement dédié équivalent). Rotation toutes les ~1,8 s via un
  `useEffect`/`setInterval`, nettoyé à l'arrêt du chargement.
- Nouvelle classe CSS `.animate-reveal` dans `app/globals.css` (fondu +
  translation + léger scale-in), appliquée à l'apparition du résultat
  (remplace `animate-fade-up` sur le conteneur du résultat, `app/page.tsx:735`,
  et sur la section résultat vidéo, `app/page.tsx:886`). Ajoutée à la liste
  déjà neutralisée sous `prefers-reduced-motion` (`app/globals.css:60-65`).

## Gestion des erreurs

- Écriture IndexedDB défaillante (quota dépassé, navigateur en mode
  privé restrictif, etc.) : catchée silencieusement, logguée en
  `console.error`, n'affecte jamais le flux de génération principal (qui a
  déjà réussi à ce stade).
- Lecture IndexedDB défaillante sur `/galerie` : affiche l'état vide
  (comme s'il n'y avait aucune entrée) plutôt qu'une erreur bloquante.

## Vérification

Pas de suite de tests dans ce projet. Vérification manuelle :

- Générer une image : elle apparaît dans `/galerie` après rechargement de
  la page.
- Générer une vidéo : elle apparaît aussi dans `/galerie`.
- Générer une 16ᵉ entrée (au total, image+vidéo confondues) : la plus
  ancienne des 15 précédentes disparaît.
- Vider le cache/IndexedDB du navigateur : `/galerie` revient à l'état
  vide, sans erreur.
- Pendant un chargement (image ou vidéo), les messages tournent
  visiblement ; à l'arrivée du résultat, l'animation d'entrée est plus
  marquée qu'un simple fondu.
- Avec `prefers-reduced-motion: reduce` activé (émulation navigateur) :
  aucune animation sur le reveal.
