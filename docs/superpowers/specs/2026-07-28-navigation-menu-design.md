# Menu de navigation principal — Design

Date : 2026-07-28
Statut : Approuvé

## Contexte

Bluminoo Studio est aujourd'hui une application une-page (`app/page.tsx`) : le
header ne contient que le logo et un toggle Image/Vidéo. Il n'existe aucune
navigation vers d'autres sections.

## Objectif

Ajouter un vrai menu de navigation principal avec 4 sections :

- **Accueil / Studio** — la page actuelle de génération (route `/`)
- **Galerie / Historique** — page placeholder (route `/galerie`)
- **Tarifs / Crédits** — page placeholder (route `/tarifs`)
- **À propos / Aide** — page placeholder (route `/a-propos`)

## Non-objectifs

- Pas de stockage réel de l'historique des rendus (Galerie reste une page
  "bientôt disponible" — le stockage persistant est un chantier séparé).
- Pas de système de crédits/facturation réel (Tarifs reste une page "bientôt
  disponible").
- Pas de contenu rédactionnel final pour À propos/Aide — un texte
  d'espace réservé suffit.
- Pas d'authentification ni de compte utilisateur.

## Architecture

Le header, le fond animé (`DotField` + `ColorBends`) et le vignette sont
actuellement rendus à l'intérieur de `app/page.tsx`. Ils sont déjà en
`position: fixed` (classes `.studio-backdrop` / `.studio-vignette` dans
`app/globals.css`), donc ils peuvent être déplacés tels quels dans
`app/layout.tsx` pour être partagés par toutes les routes, sans changement de
comportement visuel.

Changements :

1. **`app/layout.tsx`** : devient responsable du chrome partagé — `<div
   className="studio-shell">` englobant le fond animé, le vignette, le
   nouveau `<SiteHeader />`, et `<div className="studio-content">{children}</div>`.
2. **`app/page.tsx`** : ne garde que le contenu actuel du Studio (le grid
   Image/Vidéo). Le toggle Image/Vidéo, actuellement dans le header, migre en
   haut de ce contenu (au-dessus du panneau de génération), toujours piloté
   par le state client `mode` local à cette page.
3. **Nouvelles routes** : `app/galerie/page.tsx`, `app/tarifs/page.tsx`,
   `app/a-propos/page.tsx`, chacune un simple composant serveur affichant un
   `PlaceholderSection`.

## Composants

### `components/SiteHeader.tsx` (client component)

Remplace le header actuel. Contient :

- Le logo existant (`Blumin`+`oo` accentué, `Studio` en petit texte).
- Une liste de navigation desktop (`hidden md:flex`), 4 liens vers les routes
  ci-dessus, avec le lien actif mis en évidence via `usePathname()` (comparé
  en égalité stricte à `href`).
- Un bouton hamburger (`md:hidden`), visible sous le breakpoint `md`,
  `aria-expanded`/`aria-controls` corrects, qui bascule l'ouverture d'un
  panneau de navigation mobile.

Data de navigation (locale au fichier, pas de nouvelle prop nécessaire) :

```ts
const NAV_ITEMS = [
  { href: "/", label: "Accueil" },
  { href: "/galerie", label: "Galerie" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/a-propos", label: "À propos" },
];
```

### Panneau de navigation mobile (intégré à `SiteHeader.tsx`)

Pas un fichier séparé : le drawer partage le state d'ouverture et la liste
`NAV_ITEMS` avec le header, une séparation en deux fichiers n'apporterait
rien ici (YAGNI).

Comportement :

- Overlay pleine largeur, ancré sous le header (pas un tiroir latéral), fond
  vitré cohérent avec le `Panel` existant.
- Liens empilés verticalement, taille de cible tactile confortable.
- Fermeture : clic sur un lien, clic en dehors du panneau, touche `Échap`.
- Scroll du `<body>` verrouillé tant que le panneau est ouvert.
- Pas d'animation complexe requise : transition d'opacité/translation simple,
  respecte `prefers-reduced-motion` (pas de transition si activé), cohérent
  avec le traitement déjà présent sur `ColorBends`/`DotField`.

### `components/PlaceholderSection.tsx`

Petit composant de présentation réutilisé par les 3 pages placeholder :

```ts
type PlaceholderSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
};
```

Reprend le motif typographique déjà utilisé dans le panneau Studio actuel
(eyebrow en majuscules `text-primary`, titre `font-display text-3xl`,
description `text-sm text-neutral-500`), englobé dans un `Panel` centré.

Contenu de chaque page :

| Route | eyebrow | title | description |
| --- | --- | --- | --- |
| `/galerie` | Galerie | Vos rendus, bientôt réunis ici. | L'historique de vos générations sera bientôt disponible sur cette page. |
| `/tarifs` | Tarifs | Des tarifs simples arrivent bientôt. | Cette page détaillera bientôt les coûts et crédits disponibles. |
| `/a-propos` | À propos | En savoir plus sur Bluminoo Studio. | Cette page présentera bientôt le fonctionnement du studio et répondra à vos questions. |

## Style

Aucun nouveau système visuel : accent `primary` (violet), police `font-display`
pour les titres, panneaux vitrés (`Panel`), cohérent avec l'existant.

## Gestion des erreurs

Aucune surface d'erreur nouvelle : ce sont des pages statiques et un composant
de présentation. Pas d'appel réseau, pas de saisie utilisateur.

## Vérification

Pas de suite de tests dans ce projet (aucun framework configuré). Vérification
manuelle dans le navigateur (serveur de dev) :

- Les 4 routes s'affichent sans erreur console.
- Le lien actif est visuellement distinct sur chacune des 4 pages.
- Le fond animé et le header restent identiques en naviguant d'une page à
  l'autre (pas de flash, pas de remontage visible).
- Le toggle Image/Vidéo fonctionne toujours sur `/` depuis sa nouvelle
  position.
- Sur une largeur mobile (viewport réduit) : le hamburger apparaît, ouvre le
  panneau, les liens fonctionnent, `Échap` et le clic extérieur ferment le
  panneau.
