# Refonte de la page "Mon compte"

**Date**: 2026-08-09
**Statut**: Approuvé, prêt pour planification

## Contexte

La page `/compte` actuelle (`app/compte/page.tsx`) est un unique `Panel` centré
(`max-w-md`) contenant une liste `dl` (email, palier, renouvellement, crédits)
suivie du bouton de gestion d'abonnement (ou d'un lien vers `/tarifs`) et du
bouton de déconnexion.

L'utilisateur a fourni une capture d'écran d'un concurrent (CREDIA) montrant
une page "Mon Profil" en dashboard 2 colonnes : à gauche un panneau
"Informations Personnelles" + un bloc "Recharger mes crédits" ; à droite deux
cards distinctes "Crédits" (teinte verte) et "Abonnement" (teinte ambre).
L'objectif est de se rapprocher de cette **structure**, pas de sa palette —
le site garde sa charte violette/glass actuelle.

## Décisions validées avec l'utilisateur

- **Couleurs** : tout reste dans la charte violette existante (`primary` :
  `#a855f7`/`#d8b4fe`/`#7e22ce`). Pas de nouveaux tokens vert/ambre — les 2
  cards latérales se distinguent par une bordure/accent `primary`, pas par
  une couleur différente entre elles.
- **Champ "Langue du site"** : omis. L'app n'a aucun système multilingue
  (tout est en dur en français, aucune trace de i18n dans le code). On ne
  simule pas une fonctionnalité qui n'existe pas.
- **Bouton "Recharger mes crédits"** : `Link` vers `/tarifs`, dans tous les
  cas (abonné ou non) — pas de recharge à l'unité côté Stripe pour l'instant.
- **Bouton "Se déconnecter"** : reste en bas de page, comme aujourd'hui (pas
  déplacé en haut à droite malgré la capture).
- **Champ "Rôle"** : la table `profiles` n'a pas de colonne `role`
  (confirmé dans `supabase/migrations/0001_create_profiles.sql`). Ce champ
  sera affiché en dur avec la valeur `"User"` (texte statique, pas de
  requête). Pas de système de rôles à construire pour ce chantier.

## Design

### Layout

- Container passe de `max-w-md` à `max-w-4xl`.
- Titre de page inchangé dans son style : label `Mon compte` (uppercase,
  `text-primary`) + `h2` "Bienvenue".
- Grid : `grid-cols-1 lg:grid-cols-[1fr_320px] gap-6` — colonne principale à
  gauche, colonne latérale à droite ; empilées en une seule colonne en
  dessous du breakpoint `lg`.

### Colonne principale

1. `Panel` "Informations Personnelles" :
   - En-tête avec icône (lucide `User` ou équivalent déjà utilisé dans le
     projet) + titre "Informations Personnelles" + sous-titre discret
     (ex. "Vos données de base sur Bluminoo Studio").
   - Champ **Email** : `user.email`, en lecture seule (style champ
     désactivé, cohérent avec les inputs existants du site).
   - Champ **Rôle** : valeur statique `"User"`.
2. Section "Recharger mes crédits" (en dessous du panel, même colonne) :
   - Titre "Recharger mes crédits".
   - CTA (`Link` vers `/tarifs`) réutilisant le style bouton primaire déjà
     utilisé ailleurs sur le site (voir `ManageSubscriptionButton` ou les
     CTA de `/tarifs` pour le pattern de classe Tailwind).

### Colonne latérale

1. Card "Crédits" (`Panel`, léger accent `primary` — ex. `border-primary/20`
   ou un dégradé de fond subtil `from-primary/10`) :
   - Icône + titre "Crédits".
   - Nombre de crédits en grand (`profile.credits ?? 0`), ou message de
     fallback si `profileError` (comportement conservé de l'existant).
   - Sous-texte explicatif court (ex. "crédits restants").
2. Card "Abonnement" (`Panel`, même traitement visuel que la card Crédits
   pour rester cohérent — pas de distinction de couleur entre les deux) :
   - Icône + titre "Abonnement".
   - Nom du palier actuel (`PLANS[planId]?.name`) ou "Plan Gratuit" si
     `planId` est absent.
   - Si `renewalDate` existe, l'afficher en sous-texte ("Renouvellement le
     JJ/MM/AAAA").
   - CTA : si `planId` existe → `ManageSubscriptionButton` (inchangé) ; sinon
     → `Link` "Voir les offres" vers `/tarifs`, stylé comme un bouton
     secondaire/outline pour distinguer visuellement du CTA "Recharger mes
     crédits" de la colonne principale.

### Bas de page

- `SignOutButton` reste sous les deux colonnes (pleine largeur ou centré,
  comme aujourd'hui), inchangé dans son comportement.

### Data flow

Aucune nouvelle requête. Réutilisation stricte des données déjà fetchées en
haut du composant serveur : `user`, `profile.credits`, `profile.plan`,
`profile.current_period_end`, `profileError`.

### Gestion d'erreur

Comportement identique à l'existant : si `profileError`, la card Crédits
affiche le message de fallback actuel ("Impossible de charger ton solde pour
le moment.") à la place du nombre.

### Responsive

- `lg` et plus : 2 colonnes (`1fr` / `320px`).
- En dessous : une seule colonne, ordre = Informations Personnelles →
  Recharger mes crédits → Crédits → Abonnement → Déconnexion (ordre naturel
  du DOM, colonne latérale après colonne principale).

## Hors scope

- Tout système de rôles réel (le champ "Rôle" est décoratif).
- Tout sélecteur de langue / i18n.
- Recharge de crédits à l'unité (hors abonnement Stripe).
- Déplacement du bouton de déconnexion.
- Nouveaux tokens de couleur Tailwind.

## Fichiers concernés

- `app/compte/page.tsx` (réécriture du markup, logique serveur inchangée).
- Éventuellement extraction de petits sous-composants de présentation
  (ex. une card stat réutilisable) si ça réduit la duplication entre les
  cards Crédits/Abonnement — à trancher en phase de plan si pertinent, pas
  une exigence de ce spec.
