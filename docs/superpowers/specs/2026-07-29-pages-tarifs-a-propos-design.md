# Finaliser Tarifs et À propos — Design

Date : 2026-07-29
Statut : Approuvé

## Contexte

`app/tarifs/page.tsx` et `app/a-propos/page.tsx` sont aujourd'hui de
simples `PlaceholderSection` ("bientôt disponible"). L'objectif est de
leur donner un vrai contenu, sans construire de backend de
paiement/crédits (chantier séparé, non commencé).

## Objectifs

### Page Tarifs

Grille de tarifs **informative**, deux formules, sans transaction réelle :

- **Gratuit** (actuel) : "Génération photo & vidéo illimitée pour le
  moment", "Presets Montre / Voiture / Lieu", "Galerie locale (15
  dernières générations)". Badge "Plan actuel" au lieu d'un bouton.
- **Pro** (à venir) : "Bientôt disponible" à la place d'un prix,
  fonctionnalités aspirationnelles ("Génération prioritaire",
  "Résolutions supérieures", "Historique étendu", "Support prioritaire"),
  bouton désactivé "Bientôt disponible".

**Contrainte importante** : aucune limite de quota chiffrée ne doit être
inventée pour le plan Gratuit (l'app n'a aucun système de comptage réel
aujourd'hui) — le texte doit rester honnête ("illimité pour le moment",
pas "10 générations/mois").

### Page À propos

Trois blocs :

1. **Présentation** : ce qu'est Bluminoo Studio, comment ça marche,
   technologies utilisées (Gemini 2.5 Flash Image pour l'image, Kling
   O3 via fal.ai pour la vidéo — reprend la description déjà présente
   dans `app/layout.tsx` metadata et `README.md`).
2. **FAQ** : reflète le comportement **actuel réel** de l'app (pas de
   fonctionnalité pas encore livrée) :
   - Formats de photo acceptés (JPG/PNG/WebP, max 10 Mo — cf.
     `validateImageFile`, `app/page.tsx`)
   - Temps de génération (~15-30 s image, ~90 s+ vidéo — cf. les libellés
     déjà affichés sur les boutons Générer)
   - Confidentialité : les rendus réussis sont désormais sauvegardés
     localement dans le navigateur (Galerie, IndexedDB, 15 dernières
     générations max) — rien n'est stocké sur un serveur propre à
     l'application
   - Fonctionnement de l'onglet Vidéo : upload d'une image source (et en
     option une photo de l'objet de remplacement), description du
     changement, génération d'une courte vidéo (~5 s) intégrant la
     modification — **ne pas** mentionner un upload de vidéo source en
     entrée, cette fonctionnalité (migration Kling O1) n'est pas encore
     livrée (spec/plan existants mais non exécutés :
     `docs/superpowers/specs/2026-07-29-video-to-video-kling-o1-design.md`).
3. **Contact** : lien `mailto:mathisvergne27@gmail.com`.

## Non-objectifs

- Aucun vrai paiement, aucun vrai système de crédits/quota.
- Aucune mention de fonctionnalités non livrées (video-to-video Kling
  O1, réseaux sociaux/Discord — aucun lien réel fourni pour l'instant).
- Aucun nouveau composant partagé générique de type "grille de features"
  ou "accordéon FAQ" — JSX inline dans chaque page, cohérent avec le
  reste de l'app qui n'est pas fortement componentisée au-delà de
  `Panel`/`PlaceholderSection`.

## Architecture

Les deux fichiers `app/tarifs/page.tsx` et `app/a-propos/page.tsx` restent
des composants serveur simples (pas de state, pas d'interactivité —
`PlaceholderSection` n'est plus utilisé sur ces deux pages puisqu'elles
ont maintenant un vrai contenu, mais reste utilisé ailleurs si besoin).
Style : réutilisation de `Panel`, de l'accent `primary`, de `font-display`
pour les titres — cohérent avec le reste de l'app, aucun nouveau système
visuel.

## Gestion des erreurs

Aucune : pages statiques, aucune saisie utilisateur, aucun appel réseau.

## Vérification

Pas de suite de tests dans ce projet. Vérification manuelle :

- `/tarifs` affiche les deux formules avec le contenu exact ci-dessus,
  aucun chiffre de quota inventé.
- `/a-propos` affiche Présentation + FAQ + Contact, le lien de contact
  pointe vers `mailto:mathisvergne27@gmail.com`.
- Le contenu ne mentionne aucune fonctionnalité non livrée (pas d'upload
  vidéo en entrée sur l'onglet Vidéo).
- Navigation, header et fond animé inchangés sur ces deux routes.
