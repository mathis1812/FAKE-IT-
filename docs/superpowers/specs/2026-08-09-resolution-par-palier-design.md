# Résolution d'image dynamique par palier + bénéfices tarifs enrichis

**Date**: 2026-08-09
**Statut**: Approuvé, prêt pour planification

## Contexte

La page `/tarifs` affiche actuellement une liste de bénéfices très courte et
peu différenciée par palier (`app/tarifs/page.tsx` : `PLAN_FEATURES`), avec
seulement 3 à 5 items quasi identiques d'un palier à l'autre. L'utilisateur a
montré une capture d'un concurrent (CREDIA) avec des listes bien plus
riches et différenciées, avec 1-2 points forts mis en gras.

Une fonctionnalité du concurrent ("Tutoriel Snap Rouge inclus" — un tuto
pour envoyer une photo générée par IA via le mode "snap rouge" de Snapchat
de façon à ce qu'elle passe pour une vraie photo non retouchée aux yeux du
destinataire) a été explicitement exclue du périmètre : c'est une
fonctionnalité conçue pour tromper un tiers réel sur l'authenticité d'une
image (catfishing), et Claude a refusé de la construire. Ce chantier ne
contient donc aucune référence à cette fonctionnalité.

En creusant ce qui pourrait servir de vrai différenciateur (plutôt que du
marketing non vérifiable), on a découvert que le modèle utilisé pour la
génération photo, `nano-banana-pro` sur kie.ai, accepte un paramètre
`resolution` avec 3 valeurs (`1K` / `2K` / `4K`, defaut `1K`) — actuellement
figé en dur à `"1K"` pour tous les utilisateurs
(`app/api/generate/route.ts:109`). C'est un vrai levier de différenciation
technique, pas une promesse en l'air.

## Décisions validées avec l'utilisateur

- **Mapping résolution/palier** :
  - `decouverte` → `1K`
  - `essentiel` → `2K`
  - `ultimate` → `4K`
- **Coût kie.ai confirmé par recherche** (docs.kie.ai + recherche web,
  2026-08-09) : 1K et 2K coûtent le même prix côté kie.ai (~0,09 $/image),
  seul le 4K coûte plus cher (~0,12 $/image, soit +33%). Le mapping choisi
  n'a donc aucun impact de marge sur Découverte→Essentiel, et un impact
  mineur sur Ultimate.
- **Coût en crédits inchangé** : `IMAGE_GENERATION_COST` reste fixe à 150
  crédits (`lib/credits.ts:3`) pour tous les paliers, quelle que soit la
  résolution. Pas de système de coût variable par résolution — hors scope.
- **Pas de sélecteur de résolution côté client** : la résolution n'est
  jamais acceptée depuis le corps de la requête `POST /api/generate` —
  elle est dérivée côté serveur du palier réel de l'utilisateur (comme
  `/compte` le fait déjà pour afficher le palier). Un utilisateur ne peut
  donc pas se faire passer pour un palier supérieur en modifiant la
  requête.
- **Fallback sans palier actif** : `1K` (comportement par défaut de
  kie.ai lui-même, le plus sûr côté coût). Note : un utilisateur sans
  abonnement actif a de toute façon 0 crédit par défaut à l'inscription
  (`profiles.credits = 0`), donc ce cas ne se présente en pratique que si
  des crédits ont été accordés manuellement sans palier associé.
- **Bénéfices honnêtes uniquement** : pas de mentions vitesse/qualité/file
  d'attente non vérifiables (ex. "Vitesse Ultra", "Support 24/7", "File
  d'attente prioritaire") — seuls des éléments réellement vrais dans le
  code actuel sont listés.

## Design

### 1. Résolution dynamique par palier

**`lib/stripe.ts`** : ajouter un type et un champ sur chaque entrée de
`PLANS` :

```ts
export type ImageResolution = "1K" | "2K" | "4K";
```

```ts
export const PLANS: Record<
  PlanId,
  {
    name: string;
    monthly: PriceInfo;
    annual: PriceInfo;
    creditsPerMonth: number;
    imageResolution: ImageResolution;
  }
> = {
  decouverte: { /* ...existant..., */ imageResolution: "1K" },
  essentiel: { /* ...existant..., */ imageResolution: "2K" },
  ultimate: { /* ...existant..., */ imageResolution: "4K" },
};
```

**`app/api/generate/route.ts`** : après avoir authentifié l'utilisateur
(le code fait déjà `await supabase.auth.getUser()`), récupérer son
`profile.plan` (comme `/compte` le fait déjà via
`.from("profiles").select(...).eq("id", user.id).single()`), résoudre la
résolution via `PLANS[planId]?.imageResolution ?? "1K"`, et remplacer le
`resolution: "1K"` codé en dur par cette valeur dynamique dans l'appel à
`createKieTask`.

Le champ `resolution` n'est **jamais** lu depuis `GenerateBody` (le corps
de la requête HTTP) — uniquement calculé côté serveur à partir du profil
Supabase de l'utilisateur authentifié.

### 2. Bénéfices par palier enrichis

**Type** — dans `app/tarifs/page.tsx` et `components/PricingGrid.tsx`, le
type de `features` passe de `string[]` à :

```ts
type PlanFeature = { text: string; bold?: boolean };
```

**Contenu** (`PLAN_FEATURES` dans `app/tarifs/page.tsx`) :

```ts
const PLAN_FEATURES: Record<PlanId, PlanFeature[]> = {
  decouverte: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité 1K" },
    { text: "Photo de référence optionnelle" },
    { text: "Historique complet" },
  ],
  essentiel: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité 2K", bold: true },
    { text: "Photo de référence optionnelle" },
    { text: "Historique complet" },
    { text: "Support prioritaire" },
  ],
  ultimate: [
    { text: "Génération photo & vidéo" },
    { text: "Qualité 4K Ultra-détails", bold: true },
    { text: "Photo de référence optionnelle" },
    { text: "Historique complet" },
    { text: "Support prioritaire" },
    { text: "12 000 crédits/mois (plafonné)" },
  ],
};
```

### 3. Affichage (`components/PricingGrid.tsx`)

La liste `<ul>` qui rend `plan.features` (actuellement `feature` en
`string`, itéré avec `key={feature}`) change pour itérer sur des objets :

```tsx
<ul className="mb-6 flex-1 space-y-2.5 text-sm text-neutral-400">
  {plan.features.map((feature) => (
    <li key={feature.text} className="flex items-start gap-2">
      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
      <span className={feature.bold ? "font-semibold text-white" : undefined}>
        {feature.text}
      </span>
    </li>
  ))}
</ul>
```

Le type `PlanView` dans `PricingGrid.tsx` (actuellement `features:
string[]`) est mis à jour vers `features: PlanFeature[]` en conséquence.

### Data flow

- `app/tarifs/page.tsx` construit déjà `plans` à partir de `PLANS` +
  `PLAN_FEATURES` et les passe à `<PricingGrid />` — le seul changement est
  le type de `features`, la construction reste identique.
- `app/api/generate/route.ts` ajoute une requête Supabase supplémentaire
  (fetch du `profile.plan` de l'utilisateur) avant l'appel à kie.ai — coût
  négligeable, même pattern que `/compte`.

### Gestion d'erreur

Si la requête Supabase du profil échoue dans `/api/generate` (erreur
réseau, etc.), fallback silencieux sur `1K` plutôt que de bloquer la
génération — cohérent avec le principe existant de la route de ne jamais
laisser un souci secondaire empêcher une génération dont l'utilisateur a
déjà payé les crédits.

## Hors scope

- Différenciation de résolution/qualité pour la génération vidéo (Kling) —
  l'utilisateur a explicitement limité la demande à l'image.
- Coût en crédits variable selon la résolution — coût fixe conservé.
- Sélecteur de résolution manuel côté utilisateur.
- Toute fonctionnalité de type "Snap Rouge" ou équivalent — explicitement
  exclue.
- Vitesse de génération, file d'attente prioritaire, support 24/7, ou tout
  autre différenciateur non vérifiable dans le code actuel.

## Fichiers concernés

- `lib/stripe.ts` (ajout du type `ImageResolution` et du champ
  `imageResolution` sur `PLANS`).
- `app/api/generate/route.ts` (résolution dynamique de la résolution
  d'image via le profil utilisateur).
- `app/tarifs/page.tsx` (type `PlanFeature`, contenu de `PLAN_FEATURES`).
- `components/PricingGrid.tsx` (type `PlanView.features`, rendu de la
  liste avec support du gras).
