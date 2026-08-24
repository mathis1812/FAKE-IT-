# Bascule de Bluminoo vers le marché anglophone

**Date :** 2026-08-24
**Statut :** validé, prêt pour le plan d'implémentation
**Repo :** `fakeit` (produit « Bluminoo Studio »)
**Commit de départ :** `b9809a1`

## Contexte

Bluminoo est aujourd'hui un produit entièrement francophone : interface,
routes, témoignages, pages légales et grille tarifaire en euros. La cible
commerciale devient le marché anglophone. Le produit bascule donc
**intégralement en anglais**, sans version française conservée et sans
librairie d'internationalisation : il n'y aura qu'une seule langue, et
introduire `next-intl` pour un seul locale serait de l'abstraction sans
besoin.

Les prompts envoyés au modèle (`lib/place-prompt.ts`,
`app/api/generate/route.ts`, `app/api/generate-video/route.ts`) sont
**déjà rédigés en anglais** : le pipeline de génération n'est pas concerné
par ce chantier.

Surface concernée : 11 pages sous `app/`, 47 fichiers `.ts`/`.tsx`
contenant du texte français, 5 fichiers référençant « Snap Rouge ».

## Objectif

Un visiteur anglophone doit pouvoir découvrir, comprendre, acheter et
utiliser Bluminoo sans jamais rencontrer de français ni d'euro, sans
qu'aucun client existant ne soit cassé au passage.

## Périmètre

### Dans le périmètre

- Les 11 pages de `app/` et les composants associés
- Le renommage des routes et les redirections des anciennes URL
- La grille tarifaire en USD et la création de 6 nouveaux prix Stripe
- Les metadata, l'`openGraph.locale` et le sitemap
- Les 30 témoignages de `lib/testimonials.ts`
- Les 3 pages légales, en traduction fidèle
- `lang="en"` et les formats de nombres et de dates

### Hors périmètre

- Les prompts modèle, déjà en anglais
- Le schéma Supabase, la logique de crédits, le pipeline de génération
- La mosaïque de rendus du hero et le bandeau
- Toute évolution fonctionnelle : ce chantier est une bascule de langue
  et de devise, rien d'autre

### Ne peut pas être traité en code

Les e-mails d'authentification Supabase (confirmation d'inscription,
réinitialisation de mot de passe) sont en français et se configurent dans
le tableau de bord Supabase, hors du repo. À traiter manuellement après le
déploiement.

## Décisions de conception

### 1. Les identifiants internes de paliers ne changent pas

`PlanId` reste `"decouverte" | "essentiel" | "ultimate"` dans le code et
dans la base. Seul le champ `name` affiché devient Starter / Essential /
Ultimate. Renommer les identifiants imposerait une migration de toutes les
lignes utilisateurs existantes pour un gain purement cosmétique, invisible
du client.

### 2. Les anciens price IDs EUR sont conservés

Les abonnés en euros existants restent actifs. Quand Stripe émettra leur
événement de renouvellement, le webhook doit encore pouvoir associer leur
price ID à un palier. Sans cela, **ils paieraient sans recevoir leurs
crédits**, silencieusement.

`lib/stripe.ts` expose donc une table `LEGACY_PRICE_IDS` associant chaque
ancien identifiant de prix EUR à son palier, consultée en repli par la
résolution price ID → palier. Les nouvelles souscriptions passent
exclusivement par les prix USD.

Les variables `STRIPE_PRICE_*` existantes reçoivent les **nouveaux** IDs
USD ; les anciennes valeurs EUR ne doivent donc pas être perdues. Elles
sont relevées avant la bascule et placées dans 6 nouvelles variables
d'environnement Vercel : `STRIPE_PRICE_LEGACY_DECOUVERTE`,
`STRIPE_PRICE_LEGACY_DECOUVERTE_ANNUEL`, `STRIPE_PRICE_LEGACY_ESSENTIEL`,
`STRIPE_PRICE_LEGACY_ESSENTIEL_ANNUEL`, `STRIPE_PRICE_LEGACY_ULTIMATE`,
`STRIPE_PRICE_LEGACY_ULTIMATE_ANNUEL`. Aucun identifiant de prix n'est
écrit en dur dans le code. Si ces variables sont absentes, la table de
repli est simplement vide et le comportement reste celui d'aujourd'hui —
pas d'erreur au démarrage.

### 3. Traduction naturelle, pas mot-à-mot

Les textes sont réécrits pour sonner anglais, pas traduits littéralement
depuis le français. Exception explicite : les pages légales, traduites
fidèlement.

## Grille tarifaire

Le ratio annuel actuel (9,59 × le mensuel, soit environ 20 % de remise)
est conservé.

| Palier interne | Nom affiché | Mensuel | Annuel | Crédits/mois | Résolution |
|---|---|---|---|---|---|
| `decouverte` | Starter | $9.99 | $95.90 | 2 000 | 1K |
| `essentiel` | Essential | $19.99 | $191.90 | 5 000 | 2K |
| `ultimate` | Ultimate | $39.99 | $383.90 | 12 000 | 4K |

Les crédits mensuels et les résolutions sont inchangés. Le champ
`priceEur` devient `priceUsd`, et l'affichage passe de `19,90 €` à
`$19.99`.

Les 6 nouveaux prix USD doivent être créés dans Stripe et leurs
identifiants renseignés dans les variables d'environnement Vercel
existantes (`STRIPE_PRICE_*`).

## Routes

Renommage des dossiers de `app/`, avec **redirection 301** de chaque
ancienne URL vers la nouvelle dans `next.config`, afin de ne pas casser les
liens déjà indexés ou partagés.

| Ancienne route | Nouvelle route |
|---|---|
| `/tarifs` | `/pricing` |
| `/compte` | `/account` |
| `/connexion` | `/sign-in` |
| `/inscription` | `/sign-up` |
| `/galerie` | `/gallery` |
| `/a-propos` | `/about` |
| `/cgv` | `/terms` |
| `/confidentialite` | `/privacy` |
| `/mentions-legales` | `/legal` |

`/` et `/landing` sont inchangées. Tous les `href` et `router.push`
internes doivent être mis à jour : c'est le principal risque de lien mort
du chantier.

## Contenu

- **« Snap Rouge » devient « Red Snap »** partout : nom de la
  fonctionnalité, bouton « Unlock Red Snap », ligne de la grille tarifaire,
  témoignages. La restriction existante reste inchangée : la fonctionnalité
  demeure réservée aux paliers Essential et Ultimate, et le palier Starter
  affiche le bouton de déblocage vers `/pricing`.
- **Les 30 témoignages sont réécrits** en anglais avec des pseudos
  anglophones crédibles. Ils étaient déjà fictifs côté français ; ils sont
  adaptés, aucun client réel n'est inventé.
- **Les 3 pages légales** (`/terms`, `/privacy`, `/legal`) sont traduites
  fidèlement, références au droit français conservées puisque l'entité qui
  vend reste française. Ces textes doivent être relus par un juriste avant
  toute commercialisation — cette spec ne constitue pas un avis juridique.

## SEO et metadata

- `lang="en"` dans `app/layout.tsx`
- `openGraph.locale` de `fr_FR` à `en_US`
- Titres et descriptions réécrits pour des requêtes anglophones
- Sitemap régénéré sur les nouvelles routes
- Les URL canoniques restent sur `fakeit-delta.vercel.app` : on conserve le
  même projet Vercel, le site anglais remplace le site français

## Données existantes

La base Supabase est conservée intacte : comptes, crédits, galerie publique
et images déjà générées. Aucune suppression, aucune migration.

## Vérification

Ce projet n'a **pas de framework de test** par choix, et ce chantier n'en
introduit pas.

1. `npx tsc --noEmit -p tsconfig.json` sans erreur
2. Les 10 tests Vitest existants sur `lib/share-utils.ts` passent
3. Passage manuel des 11 pages dans le navigateur
4. Aucun texte français résiduel : `grep` sur les caractères accentués dans
   `app/`, `components/` et `lib/`, hors commentaires de code
5. Aucun lien interne ne pointe vers une ancienne route

### Ce que la vérification automatique ne couvre pas

Un achat réel en USD de bout en bout. Le projet n'a par ailleurs jamais vu
de génération réelle validée, ni de configuration Stripe en mode live. La
création de 6 nouveaux prix USD rend ces deux vérifications manuelles plus
urgentes, pas moins : un `sk_live` côté Vercel avec des `STRIPE_PRICE_*` de
test signifie un paiement encaissé sans attribution de crédits.

## Risques

| Risque | Conséquence | Atténuation |
|---|---|---|
| Un `href` interne oublié après renommage | Lien mort en production | Contrôle explicite en étape 5 de vérification, plus les redirections 301 comme filet |
| Price IDs EUR non résolus par le webhook | Abonné existant débité sans crédits | `LEGACY_PRICE_IDS` (décision 2) |
| `STRIPE_PRICE_*` de test avec une clé live | Paiement sans crédits | Vérification manuelle des 6 variables Vercel avant mise en production |
| E-mails Supabase restés en français | Rupture d'expérience à l'inscription | Signalé comme action manuelle hors code |

## Étape suivante

Rédaction du plan d'implémentation, exécuté ensuite en développement piloté
par sous-agents, conformément au processus habituel du projet.
