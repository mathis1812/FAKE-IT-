# Refonte de la landing page — design

**Date :** 2026-08-19
**Statut :** validé, prêt pour le plan d'implémentation

## Problème

La landing page `/landing` livrée par Replit (354 lignes,
`app/landing/page.tsx`) ne satisfait pas l'utilisateur. Il souhaite la
remplacer par une page calquée sur la structure de
**crediacreation.com**, son autre site, dont la landing convertit bien.

## Point de départ clarifié

Une ambiguïté importante a été levée pendant le brainstorming :
crediacreation.com a d'abord été présenté comme « mon concurrent », ce qui
m'a conduit à refuser d'en reprendre les témoignages. La lecture réelle des
avis a révélé qu'ils mentionnent le « Snap Rouge », fonctionnalité propre à
Bluminoo — l'utilisateur a confirmé que **Credia est son propre site et que
ces avis sont de vrais retours de ses clients**.

Ils peuvent donc être repris tels quels, sans problème de droit ni de
publicité trompeuse. Cette clarification conditionne tout le reste de la
spec : sans elle, la section preuve sociale aurait dû être vidée.

## Structure cible

Sept blocs, dans l'ordre de Credia :

1. **Hero plein écran** — badge d'annonce, titre géant
   « Fake it 'til you make it », promesse en une phrase, CTA principal
2. **Bandeau défilant de témoignages** — les 29 avis réels, deux rangées en
   boucle continue, sens opposés
3. **Encart « solution exclusive »** — le Snap Rouge mis en avant seul
4. **Avant / Après** — une transformation côte à côte, avec légende
5. **La différence Bluminoo** — arguments produit
6. **FAQ** — accordéon
7. **CTA final + footer**

## Animation

### Bandeau défilant

Deux rangées de cartes défilant horizontalement en boucle continue, sens
opposés. Chaque rangée contient la liste **dupliquée deux fois** et se
translate de `-50%` avant de repartir à zéro : la couture est invisible.

- Cycle lent (~40 s), pause au survol pour permettre la lecture
- Masques dégradés sur les bords gauche et droit (fondu, pas de coupe nette)
- Cartes : citation + pseudo en capitales, comme sur Credia

### Fond du hero

**`StudioBackdrop` est déjà monté globalement dans `app/layout.tsx`
(ligne 56)** — il s'affiche donc déjà derrière `/landing`. Le hero ne doit
**pas** le réinstancier : il doit simplement éviter de le masquer avec un
fond opaque, et poser un voile sombre semi-transparent par-dessus pour
garantir la lisibilité du titre.

C'est le fond animé demandé (ColorBends + DotField, shader violet), déjà
cohérent avec le reste du site — plutôt qu'une animation étrangère à la DA.

### Accessibilité

`prefers-reduced-motion` est respecté : bandeau figé et fond statique pour
les visiteurs ayant activé ce réglage système. Deux lignes de CSS.

## Copywriting

**Repris tel quel** (contenu propre à l'utilisateur) : le titre « Fake it
'til you make it », l'angle « impressionner ton entourage », le ton direct
et tutoyant, la mise en avant du Snap Rouge comme solution exclusive, les
29 témoignages.

**Adapté** : toutes les occurrences de « Credia » deviennent « Bluminoo
Studio ». L'adresse de contact est celle déjà utilisée dans les pages
légales de Bluminoo, pas `credia.contact@gmail.com`.

**Angle différenciant** : l'avant/après de Credia montre une Mercedes
transformée en Ferrari. Chez Bluminoo, il portera sur l'**intégration dans
un lieu réel** — la fonctionnalité la plus récente et la plus
différenciante, illustrée par les visuels déjà présents dans
`public/landing/` (`jet`, `rooftop`, `restaurant`, `car`, `concert`,
`pool`).

**FAQ** : reprend les questions de Credia pertinentes chez Bluminoo, dont
« Qu'est-ce que le système de Snap Rouge ? » (la fonctionnalité existe).

### Omis volontairement

Le compteur « 21 341 personnes ont généré une photo aujourd'hui ».
Impossible à calculer honnêtement sans le brancher sur une vraie requête.
L'utilisateur a explicitement choisi de **l'omettre** plutôt que de le
brancher sur `gallery_entries` ou d'afficher un nombre inventé.

## Fichiers

| Fichier | Action |
|---|---|
| `app/landing/page.tsx` | Réécrit (354 lignes actuelles remplacées) |
| `lib/testimonials.ts` | Rempli avec les 29 avis réels |
| `components/TestimonialMarquee.tsx` | **Créé** — bandeau défilant, composant client isolé |

Le bandeau est un composant client (`"use client"`) isolé, pour que le
reste de la page reste en rendu serveur.

## Contraintes à préserver

**Le tracking analytics existant ne doit pas être perdu.** `lib/analytics.ts`
expose `trackLandingPageView()` et `trackLandingCtaClick(ctaId)`, avec les
identifiants typés `LandingCtaId` : `"hero_primary"`, `"difference_link"`,
`"difference_cta"`, `"final_cta"`. La nouvelle page doit rebrancher ces
appels sur ses CTA équivalents — refaire la page sans cela ferait perdre la
mesure de conversion, ainsi que la table `landing_events` (migration 0007) et
la route `/api/track` qui l'alimentent.

Si la nouvelle structure introduit un CTA sans équivalent dans le type
`LandingCtaId`, ajouter l'identifiant au type plutôt que de réutiliser un
identifiant existant pour un bouton différent — sans quoi les statistiques
mélangeraient deux boutons distincts.

**`lib/testimonials.ts` porte un avertissement en tête** : « Ne JAMAIS
inventer de témoignage ici ». Il reste valable — les 29 entrées ajoutées
sont des retours authentiques, ce que cette spec documente.

## Vérification

Porte habituelle, dans cet ordre : `npx tsc --noEmit -p tsconfig.json`,
`npx next build`, `npm test` (les 10 tests de partage doivent rester verts).

Vérification manuelle du rendu via le DOM sur le serveur de dev — le pane
visuel du navigateur n'étant pas disponible dans cette session, aucune
capture d'écran n'est possible. Le rendu visuel final (notamment sur mobile)
devra être validé par l'utilisateur.

Avant tout push : `git fetch` et comparaison avec `origin/main`. Le dépôt a
reçu des commits Replit en cours de travail à trois reprises le 19/08 ;
vérifier la divergence avant de pousser est devenu la règle sur ce projet.

## Hors périmètre

- Le compteur d'activité en temps réel (omis, voir ci-dessus)
- Toute modification de `/tarifs`, `/compte` ou du studio
- La page `/` (accueil), distincte de `/landing`
