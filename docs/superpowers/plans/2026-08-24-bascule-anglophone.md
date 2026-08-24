# Bascule de Bluminoo vers le marché anglophone — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire passer Bluminoo entièrement en anglais avec une tarification en dollars, sans casser les abonnés en euros existants ni les liens déjà indexés.

**Architecture:** Traduction en place, fichier par fichier — pas de librairie d'internationalisation, pas de module de textes centralisé, puisque le produit n'aura qu'une seule langue. Les dossiers de routes sont renommés avec des redirections 301 dans `next.config.mjs`. `lib/stripe.ts` passe en USD tout en conservant une table de repli des anciens identifiants de prix EUR.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Stripe, Supabase, Vitest (uniquement sur `lib/share-utils.ts`).

**Spec de référence :** `docs/superpowers/specs/2026-08-24-bascule-anglophone-design.md`

## Global Constraints

- **Aucun framework de test n'est introduit.** Ce projet n'en a pas par choix. La vérification de chaque tâche est `npx tsc --noEmit -p tsconfig.json` plus un contrôle visuel dans le navigateur. Les seuls tests existants sont les 10 tests Vitest de `lib/share-utils.ts`, qui doivent continuer à passer.
- **Les identifiants internes de paliers ne changent jamais.** `PlanId` reste `"decouverte" | "essentiel" | "ultimate"` dans le code et dans la base Supabase. Seuls les noms affichés deviennent Starter / Essential / Ultimate.
- **Aucun identifiant de prix Stripe n'est écrit en dur.** Tout passe par `envValue(...)`.
- **« Snap Rouge » devient « Red Snap »** partout, sans exception. Le bouton devient « Unlock Red Snap ».
- **Traduction naturelle, pas mot-à-mot** — sauf les 3 pages légales, traduites fidèlement, références au droit français conservées.
- **Aucun changement fonctionnel.** Pas de nouvelle fonctionnalité, pas de refonte visuelle, pas de modification du schéma Supabase ni de la logique de crédits.
- **`SITE_URL` reste `https://bluminoo.vercel.app`.**
- Grille cible : Starter $9.99 / $95.90 · Essential $19.99 / $191.90 · Ultimate $39.99 / $383.90. Crédits (2 000 / 5 000 / 12 000) et résolutions (1K / 2K / 4K) inchangés.

## Structure des fichiers

| Fichier | Responsabilité après le chantier |
|---|---|
| `lib/stripe.ts` | Grille USD, table de repli des prix EUR, helper de formatage `formatPrice` |
| `next.config.mjs` | Les 9 redirections 301 des anciennes routes françaises |
| `app/layout.tsx` | `lang="en"`, metadata et `openGraph.locale` anglophones |
| `app/sitemap.ts`, `app/robots.ts` | Nouvelles routes |
| `app/{pricing,account,sign-in,sign-up,gallery,about,terms,privacy,legal}/page.tsx` | Pages renommées et traduites |
| `app/page.tsx`, `app/landing/page.tsx` | Studio et landing traduits |
| `components/*.tsx` | Coquille, grille tarifaire, galerie, témoignages traduits |
| `lib/testimonials.ts` | 30 témoignages réécrits en anglais |
| `app/api/**/route.ts` | Messages d'erreur et de journal en anglais |

---

### Task 1: Grille tarifaire USD et repli des anciens prix EUR

C'est le chemin critique : un abonné EUR existant dont le price ID n'est plus reconnu par `resolvePriceId` serait débité sans recevoir ses crédits.

**Files:**
- Modify: `lib/stripe.ts` (bloc `PriceInfo` / `PLANS`, environ lignes 28-70, et `resolvePriceId`, environ lignes 84-99)

**Interfaces:**
- Consumes: rien (première tâche)
- Produces:
  - `PLANS[planId].monthly.priceUsd: number` et `.annual.priceUsd: number` — remplacent `priceEur`
  - `PLANS[planId].name: string` — vaut désormais `"Starter" | "Essential" | "Ultimate"`
  - `formatPrice(amount: number): string` — retourne par exemple `"$9.99"`
  - `resolvePriceId(priceId: string | undefined): { planId: PlanId; period: BillingPeriod } | null` — signature inchangée, comportement étendu

- [ ] **Step 1: Remplacer le type `PriceInfo` et l'objet `PLANS`**

Dans `lib/stripe.ts`, remplacer `type PriceInfo = { priceId: string; priceEur: number };` et l'intégralité de la constante `PLANS` par :

```ts
type PriceInfo = { priceId: string; priceUsd: number };

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
  decouverte: {
    name: "Starter",
    monthly: { priceId: envValue("STRIPE_PRICE_DECOUVERTE"), priceUsd: 9.99 },
    annual: {
      priceId: envValue("STRIPE_PRICE_DECOUVERTE_ANNUEL"),
      priceUsd: 95.9,
    },
    creditsPerMonth: 2000,
    imageResolution: "1K",
  },
  essentiel: {
    name: "Essential",
    monthly: { priceId: envValue("STRIPE_PRICE_ESSENTIEL"), priceUsd: 19.99 },
    annual: {
      priceId: envValue("STRIPE_PRICE_ESSENTIEL_ANNUEL"),
      priceUsd: 191.9,
    },
    creditsPerMonth: 5000,
    imageResolution: "2K",
  },
  ultimate: {
    name: "Ultimate",
    monthly: { priceId: envValue("STRIPE_PRICE_ULTIMATE"), priceUsd: 39.99 },
    annual: {
      priceId: envValue("STRIPE_PRICE_ULTIMATE_ANNUEL"),
      priceUsd: 383.9,
    },
    creditsPerMonth: 12000,
    imageResolution: "4K",
  },
};

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
```

Ne pas toucher à `PlanId`, `BillingPeriod`, `ImageResolution`, `envValue`, `isStripeConfigured`, `priceIdFor` ni `creditsFor`.

- [ ] **Step 2: Ajouter la table de repli et étendre `resolvePriceId`**

Toujours dans `lib/stripe.ts`, juste au-dessus de `resolvePriceId`, ajouter :

```ts
// Les abonnés souscrits en euros avant la bascule vers le marché anglophone
// conservent leurs anciens price IDs. Sans ce repli, leur événement de
// renouvellement ne serait plus associé à un palier et ils paieraient sans
// recevoir de crédits.
const LEGACY_PRICE_IDS: {
  priceId: string;
  planId: PlanId;
  period: BillingPeriod;
}[] = [
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_DECOUVERTE"),
    planId: "decouverte",
    period: "monthly",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_DECOUVERTE_ANNUEL"),
    planId: "decouverte",
    period: "annual",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_ESSENTIEL"),
    planId: "essentiel",
    period: "monthly",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_ESSENTIEL_ANNUEL"),
    planId: "essentiel",
    period: "annual",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_ULTIMATE"),
    planId: "ultimate",
    period: "monthly",
  },
  {
    priceId: envValue("STRIPE_PRICE_LEGACY_ULTIMATE_ANNUEL"),
    planId: "ultimate",
    period: "annual",
  },
].filter((entry) => entry.priceId.length > 0);
```

Puis, dans `resolvePriceId`, remplacer le `return null;` final par :

```ts
  const legacy = LEGACY_PRICE_IDS.find((entry) => entry.priceId === priceId);
  if (legacy) return { planId: legacy.planId, period: legacy.period };

  return null;
```

Les variables `STRIPE_PRICE_LEGACY_*` absentes produisent une table vide : le comportement est alors strictement celui d'aujourd'hui, sans erreur au démarrage.

- [ ] **Step 3: Corriger tous les appelants de `priceEur`**

Lister les appelants restants :

```bash
cd C:/Users/julie/projects/fakeit && grep -rn "priceEur" --include=*.ts --include=*.tsx .
```

Dans chaque fichier remonté, remplacer `priceEur` par `priceUsd` et l'affichage du montant par `formatPrice(...)` importé depuis `@/lib/stripe`. Ne pas modifier les textes environnants à cette étape : ils sont traités par les tâches 6 et suivantes.

- [ ] **Step 4: Vérifier la compilation**

Run: `cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json`
Expected: aucune sortie, code de retour 0. Toute erreur `Property 'priceEur' does not exist` signale un appelant oublié à l'étape 3.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add lib/stripe.ts && git commit -m "feat: grille tarifaire en USD et repli des anciens price IDs EUR"
```

Si l'étape 3 a modifié d'autres fichiers, les ajouter au même commit.

---

### Task 2: Renommage des routes et redirections 301

**Files:**
- Rename: les 9 dossiers de `app/` (voir le tableau ci-dessous)
- Modify: `next.config.mjs`
- Modify: `app/sitemap.ts`, `app/robots.ts`
- Modify: les 12 fichiers contenant des liens internes (35 occurrences)

**Interfaces:**
- Consumes: rien de la tâche 1
- Produces: les chemins définitifs `/pricing`, `/account`, `/sign-in`, `/sign-up`, `/gallery`, `/about`, `/terms`, `/privacy`, `/legal`, utilisés par toutes les tâches suivantes

- [ ] **Step 1: Renommer les dossiers avec `git mv`**

```bash
cd C:/Users/julie/projects/fakeit && git mv app/tarifs app/pricing && git mv app/compte app/account && git mv app/connexion app/sign-in && git mv app/inscription app/sign-up && git mv app/galerie app/gallery && git mv app/a-propos app/about && git mv app/cgv app/terms && git mv app/confidentialite app/privacy && git mv app/mentions-legales app/legal
```

`git mv` préserve l'historique de chaque fichier, contrairement à une suppression suivie d'une création.

- [ ] **Step 2: Ajouter les redirections dans `next.config.mjs`**

Remplacer l'intégralité de `next.config.mjs` par :

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/tarifs", destination: "/pricing", permanent: true },
      { source: "/compte", destination: "/account", permanent: true },
      { source: "/connexion", destination: "/sign-in", permanent: true },
      { source: "/inscription", destination: "/sign-up", permanent: true },
      { source: "/galerie", destination: "/gallery", permanent: true },
      { source: "/a-propos", destination: "/about", permanent: true },
      { source: "/cgv", destination: "/terms", permanent: true },
      { source: "/confidentialite", destination: "/privacy", permanent: true },
      { source: "/mentions-legales", destination: "/legal", permanent: true },
    ];
  },
};

export default nextConfig;
```

`permanent: true` produit bien un 301.

- [ ] **Step 3: Mettre à jour les 35 liens internes**

Lister les occurrences restantes :

```bash
cd C:/Users/julie/projects/fakeit && grep -rn '"/\(tarifs\|compte\|connexion\|inscription\|galerie\|a-propos\|cgv\|confidentialite\|mentions-legales\)"' --include=*.ts --include=*.tsx app components lib
```

Les 12 fichiers concernés sont : `app/account/page.tsx`, `app/sign-in/page.tsx`, `app/gallery/page.tsx`, `app/sign-up/page.tsx`, `app/landing/page.tsx`, `app/page.tsx`, `app/robots.ts`, `app/sitemap.ts`, `components/SignOutButton.tsx`, `components/SiteFooter.tsx`, `components/SiteHeader.tsx`, `components/SubscribeButton.tsx`.

Remplacer chaque chemin selon le tableau : `/tarifs`→`/pricing`, `/compte`→`/account`, `/connexion`→`/sign-in`, `/inscription`→`/sign-up`, `/galerie`→`/gallery`, `/a-propos`→`/about`, `/cgv`→`/terms`, `/confidentialite`→`/privacy`, `/mentions-legales`→`/legal`. Vérifier aussi les redirections après authentification (paramètres `redirect`/`next` éventuels) et les appels `router.push` / `router.replace`.

- [ ] **Step 4: Vérifier qu'il ne reste aucun ancien chemin**

```bash
cd C:/Users/julie/projects/fakeit && grep -rn '"/\(tarifs\|compte\|connexion\|inscription\|galerie\|a-propos\|cgv\|confidentialite\|mentions-legales\)"' --include=*.ts --include=*.tsx app components lib
```

Expected: aucune sortie. Puis `npx tsc --noEmit -p tsconfig.json` sans erreur.

- [ ] **Step 5: Vérifier dans le navigateur**

Lancer `npm run dev`, puis ouvrir successivement `/pricing`, `/account`, `/sign-in`, `/sign-up`, `/gallery`, `/about`, `/terms`, `/privacy`, `/legal` : chacune doit répondre 200. Ouvrir ensuite `/tarifs` : le navigateur doit atterrir sur `/pricing`.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add -A app components next.config.mjs && git commit -m "refactor: routes en anglais et redirections 301 des anciennes URL"
```

---

### Task 3: Coquille du site — layout, en-tête, pied de page

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/SiteHeader.tsx`, `components/SiteFooter.tsx`, `components/SignOutButton.tsx`, `components/LegalIdentityNotice.tsx`, `components/Panel.tsx`, `components/PlaceholderSection.tsx`
- Modify: `app/sitemap.ts`, `app/robots.ts`

**Interfaces:**
- Consumes: les chemins définitifs de la tâche 2
- Produces: la coquille anglophone visible sur toutes les pages

- [ ] **Step 1: Passer `app/layout.tsx` en anglais**

Remplacer les constantes et l'attribut de langue :

```ts
const SITE_URL = "https://bluminoo.vercel.app";
const SITE_TITLE = "Bluminoo Studio";
const SITE_DESCRIPTION =
  "Create a hyper-realistic photo or video of the life you dream about — a place, a scene, a moment — and post it to your story to stun everyone you know.";
```

Puis, dans `metadata.openGraph`, remplacer `locale: "fr_FR"` par `locale: "en_US"`.

Et l'élément racine :

```tsx
    <html lang="en" className={`${cormorant.variable} ${montserrat.variable}`}>
```

`SITE_URL` et `SITE_TITLE` ne changent pas de valeur ; ils sont rappelés ici pour lever toute ambiguïté.

- [ ] **Step 2: Traduire l'en-tête et le pied de page**

Traduire tous les libellés visibles de `components/SiteHeader.tsx` et `components/SiteFooter.tsx` : intitulés de navigation, boutons, mentions du pied de page. Correspondances imposées : « Tarifs »→« Pricing », « Mon compte »→« My account », « Galerie »→« Gallery », « À propos »→« About », « Connexion »→« Sign in », « Inscription »→« Sign up », « CGV »→« Terms », « Confidentialité »→« Privacy », « Mentions légales »→« Legal ».

- [ ] **Step 3: Traduire les composants de coquille restants**

`components/SignOutButton.tsx` (« Se déconnecter »→« Sign out »), `components/LegalIdentityNotice.tsx`, `components/Panel.tsx` et `components/PlaceholderSection.tsx` : traduire tout texte visible. `LegalIdentityNotice` porte des mentions d'identité légale — les traduire fidèlement, sans changer les informations elles-mêmes.

- [ ] **Step 4: Mettre à jour sitemap et robots**

Dans `app/sitemap.ts` et `app/robots.ts`, vérifier que les entrées listent bien les nouvelles routes et uniquement elles (les anciennes ne doivent plus figurer, elles ne sont plus que des redirections).

- [ ] **Step 5: Vérifier**

Run: `cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

Puis dans le navigateur : l'en-tête et le pied de page sont entièrement en anglais sur toutes les pages, et l'inspecteur montre `<html lang="en">`.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add app/layout.tsx app/sitemap.ts app/robots.ts components && git commit -m "feat: coquille du site en anglais et metadata en_US"
```

---

### Task 4: Landing

**Files:**
- Modify: `app/landing/page.tsx`
- Modify: `components/HeroShowcaseMosaic.tsx`, `components/MagicSparkles.tsx`, `components/StudioBackdrop.tsx` (uniquement si du texte visible ou des `alt` en français y subsistent)

**Interfaces:**
- Consumes: les chemins de la tâche 2, la coquille de la tâche 3
- Produces: la landing anglophone

- [ ] **Step 1: Traduire la landing**

Traduire l'intégralité des textes visibles de `app/landing/page.tsx` : titre principal, sous-titres, sections d'arguments, libellés d'appel à l'action, questions fréquentes. Écrire un anglais naturel et direct, adressé au lecteur (« you »), sans calquer la tournure française.

Toute mention de « Snap Rouge » devient « Red Snap ».

- [ ] **Step 2: Traduire les attributs `alt` et `aria-label`**

```bash
cd C:/Users/julie/projects/fakeit && grep -rn 'alt="\|aria-label="' --include=*.tsx app/landing components/HeroShowcaseMosaic.tsx components/MagicSparkles.tsx components/StudioBackdrop.tsx
```

Traduire chaque valeur remontée. Ces textes sont invisibles à l'écran mais lus par les lecteurs d'écran et indexés.

- [ ] **Step 3: Vérifier**

Run: `cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

Dans le navigateur, parcourir `/landing` de haut en bas : aucun mot français, aucune coupure de mise en page due à un texte anglais plus long ou plus court.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add app/landing components && git commit -m "feat: landing en anglais"
```

---

### Task 5: Studio (page d'accueil)

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/MagicSparkles.tsx` si des textes y restent

**Interfaces:**
- Consumes: les chemins de la tâche 2
- Produces: le studio anglophone, y compris le hard paywall et le bouton de déblocage

- [ ] **Step 1: Traduire l'interface du studio**

Traduire tous les textes de `app/page.tsx` : étiquettes de champs, textes d'aide, libellés de boutons, messages d'état de génération, messages d'erreur, textes du hard paywall affiché aux visiteurs non connectés ou non abonnés.

- [ ] **Step 2: Traduire la fonctionnalité Red Snap**

`app/page.tsx` contient la variable `hasSnapRouge` et le bouton « Débloquer le Snap Rouge » destiné au palier Starter. Renommer la variable en `hasRedSnap`, et le libellé du bouton en « Unlock Red Snap ». La destination du bouton devient `/pricing`. La restriction reste identique : la fonctionnalité demeure réservée aux paliers `essentiel` et `ultimate`.

- [ ] **Step 3: Vérifier qu'aucune référence à l'ancien nom ne subsiste**

```bash
cd C:/Users/julie/projects/fakeit && grep -rni "snap rouge\|hasSnapRouge" --include=*.ts --include=*.tsx .
```

Expected: seules peuvent subsister les occurrences de `lib/testimonials.ts` et `app/pricing/page.tsx`, traitées par les tâches 6 et 8. Aucune dans `app/page.tsx`.

- [ ] **Step 4: Vérifier**

Run: `cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

Dans le navigateur, sur `/` : en visiteur déconnecté, le hard paywall s'affiche en anglais ; le bouton « Unlock Red Snap » mène bien à `/pricing`.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add app/page.tsx components && git commit -m "feat: studio en anglais et renommage Red Snap"
```

---

### Task 6: Page de tarifs et grille

**Files:**
- Modify: `app/pricing/page.tsx`
- Modify: `components/PricingGrid.tsx`, `components/SubscribeButton.tsx`, `components/ManageSubscriptionButton.tsx`

**Interfaces:**
- Consumes: `PLANS`, `formatPrice`, `priceUsd` de la tâche 1 ; le chemin `/pricing` de la tâche 2
- Produces: la page de vente anglophone affichant les montants en dollars

- [ ] **Step 1: Traduire la page et la grille**

Traduire tous les textes de `app/pricing/page.tsx` et `components/PricingGrid.tsx` : titres, avantages de chaque palier, bascule mensuel/annuel, mentions de remise, libellés de boutons. Les noms de paliers affichés proviennent de `PLANS[...].name` et valent déjà Starter / Essential / Ultimate depuis la tâche 1 — ne pas les réécrire en dur.

La ligne « Snap Rouge » de la grille devient « Red Snap ».

- [ ] **Step 2: Corriger les formats de nombres**

`app/pricing/page.tsx` lignes 36, 40 et 44, et `components/PricingGrid.tsx` ligne 195, appellent `toLocaleString("fr-FR")`. Remplacer `"fr-FR"` par `"en-US"` à ces quatre endroits, et traduire les libellés qui les accompagnent : `/mois` → `/mo`, `crédits/mois` → `credits/mo`.

- [ ] **Step 3: Vérifier l'affichage des montants**

Tous les prix affichés doivent passer par `formatPrice(...)`. Rechercher tout symbole euro résiduel :

```bash
cd C:/Users/julie/projects/fakeit && grep -rn "€" --include=*.tsx --include=*.ts app components lib
```

Expected: aucune sortie.

- [ ] **Step 4: Traduire les boutons d'abonnement**

`components/SubscribeButton.tsx` et `components/ManageSubscriptionButton.tsx` : traduire libellés, états de chargement et messages d'erreur.

- [ ] **Step 5: Vérifier**

Run: `cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

Dans le navigateur, sur `/pricing` : les trois paliers affichent $9.99, $19.99 et $39.99 en mensuel, $95.90, $191.90 et $383.90 en annuel, et les crédits sont formatés `2,000` et non `2 000`.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add app/pricing components && git commit -m "feat: page de tarifs en anglais avec montants en dollars"
```

---

### Task 7: Compte, galerie et authentification

**Files:**
- Modify: `app/account/page.tsx`, `app/gallery/page.tsx`, `app/sign-in/page.tsx`, `app/sign-up/page.tsx`
- Modify: `components/AccountStatCard.tsx`, `components/GalleryGrid.tsx`

**Interfaces:**
- Consumes: les chemins de la tâche 2, `PLANS[...].name` de la tâche 1
- Produces: l'espace connecté anglophone

- [ ] **Step 1: Traduire les quatre pages**

Traduire tous les textes visibles : intitulés de champs, libellés de boutons, messages de validation et d'erreur d'authentification, états vides de la galerie, libellés des cartes de statistiques du compte.

- [ ] **Step 2: Corriger les formats de dates**

`app/account/page.tsx` ligne 63 et `components/GalleryGrid.tsx` ligne 65 appellent `toLocaleDateString("fr-FR", {...})`. Remplacer `"fr-FR"` par `"en-US"` aux deux endroits, en conservant l'objet d'options tel quel.

- [ ] **Step 3: Vérifier qu'aucun `fr-FR` ne subsiste**

```bash
cd C:/Users/julie/projects/fakeit && grep -rn "fr-FR" --include=*.ts --include=*.tsx app components lib
```

Expected: aucune sortie. Les six occurrences initiales ont été traitées par les tâches 6 et 7.

- [ ] **Step 4: Vérifier**

Run: `cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

Dans le navigateur, connecté : `/account` affiche le nom du palier en anglais et une date au format américain ; `/gallery` affiche des dates en anglais ; `/sign-in` et `/sign-up` sont entièrement en anglais, messages d'erreur compris (tester une soumission avec un mot de passe invalide).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add app/account app/gallery app/sign-in app/sign-up components && git commit -m "feat: espace connecte et authentification en anglais"
```

---

### Task 8: Témoignages

**Files:**
- Modify: `lib/testimonials.ts` (30 entrées)
- Modify: `components/TestimonialMarquee.tsx`

**Interfaces:**
- Consumes: rien
- Produces: `TESTIMONIALS` avec des pseudos et des textes anglophones

- [ ] **Step 1: Traduire les 30 témoignages, sans en inventer aucun**

**Correction du plan, décision utilisateur du 24/08 :** ces témoignages ne sont PAS fictifs. Ce sont de vrais retours clients, recueillis avec le consentement explicite des personnes citées. L'en-tête de `lib/testimonials.ts` porte la consigne « Ne JAMAIS inventer de témoignage ici ». Une version antérieure de ce plan demandait de les réécrire avec des pseudos anglophones : c'est **interdit**, cela fabriquerait de faux avis attribués à des personnes inexistantes.

Ce qu'il faut faire : traduire fidèlement chaque citation en anglais naturel, en **conservant le pseudo d'origine à l'identique** (`ARTHUR_M78`, `SARAH_SHY`, `NEXTAZ_GOAT`…). Ne pas ajouter, retirer ni fusionner d'entrée : le tableau doit contenir exactement les mêmes personnes, dans le même ordre.

La traduction préserve le sens et le registre, y compris quand l'avis est nuancé ou critique (« réduire un peu les prix », « continuer de travailler dessus ») : un avis mitigé traduit en éloge serait un faux avis. Les fautes d'orthographe du français d'origine n'ont pas à être reproduites en anglais, mais le ton familier, oui.

Mettre à jour l'avertissement d'en-tête pour qu'il précise que les citations sont **traduites de leur langue d'origine** — c'est ce qui rend la traduction honnête — tout en conservant l'interdiction d'inventer.

Toute mention de « Snap Rouge » devient « Red Snap ». Conserver la structure du type `Testimonial` telle quelle — les champs `role` et `rating` restent inutilisés, ne pas les supprimer dans cette tâche, cela sortirait du périmètre.

- [ ] **Step 2: Traduire le composant**

`components/TestimonialMarquee.tsx` : traduire le titre de section et tout texte d'accompagnement.

- [ ] **Step 3: Vérifier**

Run: `cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

Dans le navigateur, sur la landing : le bandeau défile avec 30 témoignages anglophones, sans texte tronqué.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add lib/testimonials.ts components/TestimonialMarquee.tsx && git commit -m "feat: temoignages reecrits en anglais"
```

---

### Task 9: Pages légales et page À propos

**Files:**
- Modify: `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/legal/page.tsx`, `app/about/page.tsx`

**Interfaces:**
- Consumes: les chemins de la tâche 2
- Produces: les pages légales et institutionnelles en anglais

- [ ] **Step 1: Traduire fidèlement les trois pages légales**

Contrairement au reste du site, `app/terms/page.tsx`, `app/privacy/page.tsx` et `app/legal/page.tsx` sont traduites **fidèlement**, clause par clause. Les références au droit français, les mentions d'identité de l'éditeur et les obligations légales sont conservées telles quelles : l'entité qui vend reste française. Ne rien retirer, ne rien ajouter, ne pas réécrire dans un format américain.

- [ ] **Step 2: Traduire la page À propos**

`app/about/page.tsx` suit la règle générale : traduction naturelle, pas mot-à-mot.

- [ ] **Step 3: Vérifier**

Run: `cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

Dans le navigateur, comparer chaque page légale à sa version française avant traduction (par exemple `git show HEAD~1:app/cgv/page.tsx`) : aucune clause ne doit avoir disparu.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add app/terms app/privacy app/legal app/about && git commit -m "feat: pages legales et a-propos en anglais"
```

---

### Task 10: Messages des routes API

Ces chaînes ne sont pas dans les pages, mais plusieurs remontent jusqu'à l'écran de l'utilisateur : une erreur de génération ou de paiement s'afficherait en français au milieu d'un site anglais.

**Files:**
- Modify: `app/api/generate/route.ts` (13 chaînes), `app/api/generate-video/route.ts` (11), `app/api/stripe/portal/route.ts` (5), `app/api/kie/upload/route.ts` (4), `app/api/stripe/checkout/route.ts` (3), `app/api/track/route.ts` (3), `app/api/stripe/webhook/route.ts` (2)

**Interfaces:**
- Consumes: rien
- Produces: des réponses d'API en anglais ; aucune signature ni aucun code de statut HTTP ne change

- [ ] **Step 1: Lister les 41 chaînes concernées**

```bash
cd C:/Users/julie/projects/fakeit && grep -rnE '"[^"]*[éèêàçûôî][^"]*"' --include=*.ts app/api
```

- [ ] **Step 2: Traduire les messages renvoyés au client**

Traduire la valeur du champ `error` de chaque `NextResponse.json(...)`. Exemples de correspondance à respecter :

```ts
{ error: "Invalid request: unreadable JSON body." }
{ error: "Missing image. Upload a photo and try again." }
{ error: "Sign in to generate an image." }
{ error: "Sign in to generate a video." }
{ error: "Internal error while checking credits." }
{ error: "Sign in to manage your subscription." }
{ error: "No active subscription to change." }
{ error: "Profile update failed, please try again." }
```

Ne modifier ni les codes de statut HTTP, ni les noms de champs, ni la logique de contrôle.

- [ ] **Step 3: Traduire les messages de journal**

Traduire également les chaînes passées à `console.error` (« Échec de la vérification des crédits : », « Échec de la persistance de l'image générée : », etc.). Elles ne sont pas visibles des utilisateurs mais restent lues à chaque diagnostic.

- [ ] **Step 4: Vérifier**

```bash
cd C:/Users/julie/projects/fakeit && grep -rnE '"[^"]*[éèêàçûôî][^"]*"' --include=*.ts app/api && echo "IL RESTE DES CHAINES" || echo "OK, aucune chaine francaise"
```

Expected: `OK, aucune chaine francaise`. Puis `npx tsc --noEmit -p tsconfig.json` sans erreur.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add app/api && git commit -m "feat: messages des routes API en anglais"
```

---

### Task 11: Messages de partage et tests associés

Lacune découverte pendant l'exécution : `lib/share-utils.ts` ne figurait dans aucune tâche alors qu'il porte des messages affichés à l'utilisateur. C'est aussi le seul fichier couvert par des tests, et **2 des 10 assertions portent sur ses chaînes françaises** — les traduire sans toucher aux tests casserait la suite.

**Files:**
- Modify: `lib/share-utils.ts` (6 messages d'erreur, plus le commentaire de flux « Snap Rouge »)
- Modify: `__tests__/share-button.test.tsx` (lignes 165 et 276)

**Interfaces:**
- Consumes: rien
- Produces: des messages de partage en anglais ; aucune signature de fonction ne change

- [ ] **Step 1: Traduire les messages de `lib/share-utils.ts`**

Traduire les chaînes affichées à l'utilisateur, notamment celles des lignes 57, 65, 110, 119, 174, 183 et 204. Le message de la ligne 204 mentionne « Snap Rouge » : il devient « Red Snap ». Le commentaire de flux ligne 153 (`Two-step "Snap Rouge" flow`) devient également « Red Snap ».

Ne change aucune signature de fonction, aucun type, aucune logique. `shareToSnapchat` est conservée même si elle n'est plus appelée par l'interface : elle est couverte par les tests.

- [ ] **Step 2: Mettre à jour les deux assertions de test**

`__tests__/share-button.test.tsx` ligne 165 attend `"Le résultat ne peut pas être préparé pour le partage."` et ligne 276 attend `"Le résultat ne peut pas être préparé."`. Remplacer ces deux valeurs attendues par les traductions exactes retenues à l'étape 1, au caractère près.

Ne modifier que ces valeurs attendues : ni la structure des tests, ni les cas couverts, ni les simulacres.

- [ ] **Step 3: Vérifier**

```bash
cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json && npx vitest run
```

Expected: compilation sans erreur et **10 tests sur 10 au vert**. Un test rouge signale une chaîne attendue qui ne correspond pas exactement à la traduction retenue.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/julie/projects/fakeit && git add lib/share-utils.ts __tests__/share-button.test.tsx && git commit -m "feat: messages de partage en anglais"
```

---

### Task 12: Vérification finale de la bascule

**Files:** aucun fichier modifié par défaut — cette tâche recherche les oublis et les corrige là où elle en trouve.

**Interfaces:**
- Consumes: le résultat des tâches 1 à 11
- Produces: la confirmation que la bascule est complète

- [ ] **Step 1: Chercher tout texte français résiduel**

```bash
cd C:/Users/julie/projects/fakeit && grep -rnE "[éèêëàâçùûôîï]" --include=*.tsx --include=*.ts app components | grep -v "^[^:]*:[0-9]*: *//"
```

Chaque occurrence dans une chaîne affichée à l'utilisateur est un oubli à corriger. Les accents présents dans les commentaires de code français sont acceptables et restent en l'état : ce projet est commenté en français.

- [ ] **Step 2: Vérifier l'absence d'euro, de locale française et d'ancien nom**

```bash
cd C:/Users/julie/projects/fakeit && grep -rni "€\|fr-FR\|snap rouge\|priceEur" --include=*.ts --include=*.tsx app components lib
```

Expected: aucune sortie.

- [ ] **Step 3: Compilation et tests existants**

```bash
cd C:/Users/julie/projects/fakeit && npx tsc --noEmit -p tsconfig.json && npx vitest run
```

Expected: compilation sans erreur, et les 10 tests de `lib/share-utils.ts` au vert.

- [ ] **Step 4: Parcours manuel des 11 pages**

Lancer `npm run dev` et parcourir `/`, `/landing`, `/pricing`, `/account`, `/sign-in`, `/sign-up`, `/gallery`, `/about`, `/terms`, `/privacy`, `/legal`. Sur chacune : aucun texte français, aucun lien mort, aucune rupture de mise en page. Cliquer chaque lien de l'en-tête et du pied de page.

- [ ] **Step 5: Commit des corrections éventuelles**

```bash
cd C:/Users/julie/projects/fakeit && git add -A app components lib && git commit -m "fix: derniers textes francais residuels"
```

Si les étapes 1 et 2 n'ont rien remonté, sauter ce commit.

---

## Après l'exécution du plan — actions manuelles hors code

Ces points ne peuvent pas être traités par du code et restent à la charge de l'utilisateur. Ils sont listés ici pour ne pas être oubliés, pas pour être exécutés par un agent.

1. **Créer les 6 prix USD dans Stripe** (Starter, Essential, Ultimate × mensuel, annuel), aux montants de la grille.
2. **Avant de modifier quoi que ce soit dans Vercel, relever les 6 valeurs actuelles des `STRIPE_PRICE_*`** (les IDs EUR) et les enregistrer dans les nouvelles variables `STRIPE_PRICE_LEGACY_*`. Cet ordre est impératif : une fois les `STRIPE_PRICE_*` écrasées, les anciennes valeurs ne sont plus lisibles depuis Vercel.
3. **Renseigner les `STRIPE_PRICE_*` avec les nouveaux IDs USD**, puis vérifier que le mode des clés (`sk_test` ou `sk_live`) correspond bien au mode dans lequel les prix ont été créés. Un `sk_live` avec des prix de test encaisse un paiement sans attribuer de crédits.
4. **Traduire les e-mails d'authentification Supabase** (confirmation d'inscription, réinitialisation de mot de passe) dans le tableau de bord Supabase.
5. **Faire relire les pages légales traduites par un juriste** avant toute commercialisation.
6. **Tester un achat réel de bout en bout**, ainsi qu'une génération d'image et une génération de vidéo — deux vérifications que ce projet n'a jamais faites et que la bascule tarifaire rend plus urgentes.

## Déploiement

Le build local `vercel build` échoue sous Windows sur une erreur EPERM de lien symbolique. Déployer directement, ce qui déclenche un build distant :

```bash
cd C:/Users/julie/projects/fakeit && vercel deploy --prod --yes
```

Avant tout push, exécuter `git fetch` et comparer avec `origin/main` : Replit pousse en parallèle sur ce dépôt.
