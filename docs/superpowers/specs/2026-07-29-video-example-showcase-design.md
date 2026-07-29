# Exemple de résultat — onglet Vidéo — Design

Date : 2026-07-29
Statut : Approuvé

## Contexte

L'onglet Vidéo de Bluminoo Studio (`app/page.tsx`, branche `mode === "video"`)
affiche aujourd'hui un titre/sous-titre puis directement le formulaire
d'upload. L'utilisateur a vu, sur un autre outil, une section "exemple de
résultat" (vidéo de démonstration + légende + badge de crédits) affichée
avant le formulaire, et veut reproduire cette idée — pas copier le design
exact, juste le principe, avec le style déjà en place sur Bluminoo Studio.

## Objectif

Ajouter, entre le premier `Panel` (titre "Remplacer un objet" / "Vidéo
courte, intégration réaliste") et le `Panel` du formulaire d'upload, une
nouvelle section montrant :

1. Un séparateur avec le libellé "Exemple de résultat"
2. Une vidéo de démonstration fournie par l'utilisateur, en lecture
   automatique, en boucle, muette, sans barre de contrôle
3. Une légende sous la vidéo
4. Un badge statique "Tes crédits · 0" (purement visuel)

## Non-objectifs

- Pas de vrai système de crédits (le badge est statique, valeur figée à
  `0`, aucune logique de comptage — cohérent avec la page `/tarifs` qui
  reste un placeholder, cf. `docs/superpowers/specs/2026-07-28-navigation-menu-design.md`).
- Pas de contrôle utilisateur sur la vidéo d'exemple (pas de play/pause,
  pas de son) — uniquement `autoPlay muted loop playsInline`.
- Pas de nouveau composant partagé : ce bloc n'apparaît qu'une seule fois
  (onglet Vidéo), donc JSX inline dans `app/page.tsx`, cohérent avec le
  reste de cette branche qui n'est pas componentisée.
- Pas de changement sur l'onglet Image.

## Asset vidéo

Le fichier source (`v26044gc0000d6oq47vog65q1u31mdsg.mp4`, ~16,7 Mo) est
trop lourd pour une vidéo en lecture automatique au chargement de la page.
Avant intégration :

- Réencodage via `ffmpeg` (déjà installé sur la machine de l'utilisateur) :
  suppression de la piste audio (la vidéo est muette de toute façon),
  réencodage H.264 à un bitrate raisonnable pour le web (cible : quelques
  Mo maximum, résolution/bitrate ajustés pour rester net sans être lourd).
- Fichier final placé dans `public/exemple-resultat.mp4` (le dossier
  `public/` n'existe pas encore dans le repo, à créer).
- Référencé dans le JSX via `<video src="/exemple-resultat.mp4" autoPlay
  muted loop playsInline />` — chemin absolu servi directement par Next.js
  depuis `public/`, pas d'import ni de traitement côté build.

## Emplacement et structure

Dans `app/page.tsx`, branche `mode === "video"`, entre le premier `Panel`
(titre) et le second `Panel` (formulaire), insertion d'un nouveau bloc
(pas nécessairement un nouveau `Panel` — à ajuster visuellement lors de
l'implémentation pour rester cohérent avec l'espacement existant entre les
deux panneaux actuels) contenant :

- Séparateur textuel "Exemple de résultat" (reprendre le style eyebrow déjà
  utilisé ailleurs dans le fichier : majuscules, `tracking-[0.18em]` ou
  équivalent, `text-neutral-500`, avec des traits de part et d'autre comme
  sur la référence visuelle).
- `<video>` dans un conteneur `rounded-2xl overflow-hidden` cohérent avec
  les autres médias du studio (cf. `BeforeAfterSlider`, `DropZone`).
- Légende sous la vidéo, en petit texte discret (cf. style des légendes
  déjà présentes, ex. `text-xs text-neutral-600`).
- Badge "Tes crédits · 0" : petit composant pill (cf. style des badges
  déjà présents ailleurs dans le fichier, ex. le badge "Avant"/"Après" du
  slider), statique, sans logique.

## Gestion des erreurs

Aucune : c'est un média statique servi depuis `public/`, aucune saisie
utilisateur, aucun appel réseau supplémentaire.

## Vérification

Pas de suite de tests dans ce projet. Vérification manuelle au navigateur :
la vidéo se charge et joue automatiquement en boucle sans son dès l'arrivée
sur l'onglet Vidéo, aucune barre de contrôle visible, le poids du fichier
livré est significativement réduit par rapport à l'original (16,7 Mo), et
l'onglet Image n'est pas affecté.
