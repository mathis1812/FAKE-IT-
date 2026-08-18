# Bluminoo Studio

Application web SaaS qui transforme une photo (visage, poignet ou scène) en une
version ultra-réaliste avec un élément de luxe intégré (montre, voiture, décor
haut de gamme), en préservant la personne, la pose, la lumière et le cadrage
d'origine — en **image** ou en **vidéo**. Génération verrouillée par compte et
crédits, abonnements Stripe mensuels ou annuels.

Propulsée par **kie.ai** (Nano Banana Pro / Gemini 3 Pro Image pour l'image,
Kling 3.0 Pro pour la vidéo), **Supabase** (auth, base de données, stockage),
**Stripe** (abonnements), Next.js 14 (App Router), TypeScript et Tailwind CSS.
Fond animé **DotField** (React Bits).

> Le projet Vercel et le dépôt s'appellent toujours `bluminoo` : seule
> l'interface a été rebaptisée.

## Fonctionnalités

### Image (Nano Banana Pro via kie.ai)
- Upload par glisser-déposer ou clic, avec aperçu immédiat de l'original
- Prompt libre obligatoire décrivant la transformation souhaitée
- Photo de référence secondaire optionnelle (objet à intégrer), envoyée en
  second élément de `image_input` à nano-banana-pro
- Compression/redimensionnement automatique côté client (> 2 Mo → max 1536 px, JPEG 0.9)
- Upload sécurisé via `/api/kie/upload`, génération via le modèle `nano-banana-pro`
- Comparaison Avant / Après, téléchargement et régénération

### Vidéo — Remplacer un Objet (Kling 3.0 Pro via kie.ai)
- Upload vidéo source (requis) + photo de l'objet de remplacement (requis)
- Prompt libre décrivant le remplacement
- Génération d'une courte vidéo (~5 s) via Kling 3.0 Pro image-to-video
- Upload sécurisé via `/api/kie/upload` — `KIE_API_KEY` jamais exposée au client

### Comptes & crédits (Supabase)
- Inscription / connexion par email + mot de passe
- Chaque génération (image ou vidéo) exige une session valide et débite des
  crédits ; remboursement automatique en cas d'échec
- Coût par génération : **150 crédits / image**, **400 crédits / vidéo**
  (calibré pour ≥ 60-70 % de marge même sur le palier le moins cher au crédit)
- Page **Compte** : email, palier actif, date de renouvellement, solde de
  crédits, gestion de l'abonnement (portail Stripe)

### Abonnements (Stripe)
- 3 paliers, mensuel ou annuel (-20 %, facturé en une fois) :

  | Palier | Mensuel | Annuel | Crédits/mois |
  | --- | --- | --- | --- |
  | Découverte | 9,90 € | 94,90 € | 2 000 |
  | Essentiel | 19,90 € | 190,90 € | 5 000 |
  | Ultimate | 39,90 € | 382,90 € | 12 000 |

- Paiement Stripe Checkout, gestion (changement/résiliation) via le portail
  de facturation Stripe
- Webhook (`/api/stripe/webhook`) : crédite le compte à la souscription et à
  chaque renouvellement, nettoie le profil à la résiliation

### Galerie (persistée par compte)
- Chaque génération réussie est sauvegardée sur le compte de l'utilisateur
  (table `gallery_entries` + bucket Storage `gallery`), pas seulement dans le
  navigateur — accessible depuis n'importe quel appareil après connexion
- Lecture restreinte à ses propres entrées (RLS) ; écriture réservée au
  serveur (`service_role`)

### Pages légales
- Mentions légales, CGV, politique de confidentialité (`/mentions-legales`,
  `/cgv`, `/confidentialite`), liées depuis le pied de page
- ⚠️ L'identité légale de l'éditeur (forme juridique, SIRET, adresse) est en
  attente de mise à jour suite à une réimmatriculation — voir le bandeau
  d'avertissement affiché sur ces pages. **Ne pas passer Stripe en mode live
  avant que ce soit résolu.**

### SEO
- `app/sitemap.ts`, `app/robots.ts`, métadonnées Open Graph / Twitter card
  dans `app/layout.tsx`

## Architecture

```
app/
  page.tsx                 Studio (image + vidéo)
  tarifs/                  Paliers Stripe (mensuel/annuel)
  compte/                  Palier, crédits, gestion abonnement
  galerie/                 Historique des générations (server component)
  connexion/ inscription/  Auth Supabase
  a-propos/                FAQ
  mentions-legales/ cgv/ confidentialite/
  api/
    generate/              Image → kie.ai nano-banana-pro
    generate-video/        Vidéo → kie.ai Kling 3.0 Pro
    kie/upload/            Upload d'image vers kie.ai (proxy)
    stripe/checkout/       Création de session Stripe Checkout
    stripe/portal/         Portail de facturation Stripe
    stripe/webhook/        Événements Stripe (crédits, paliers)
lib/
  credits.ts               spend/refund credits (RPC service_role)
  gallery-server.ts        Persistance des résultats en galerie
  kie-jobs.ts              createTask/recordInfo kie.ai (partagé image+vidéo)
  stripe.ts                Config Stripe, paliers, prix mensuel/annuel
  supabase/                Clients Supabase (browser/server/service)
supabase/migrations/       Schéma Postgres + policies RLS
```

## 1. Obtenir les clés API

- kie.ai : [kie.ai/api-key](https://kie.ai/api-key)
- Supabase : créer un projet sur [supabase.com](https://supabase.com), récupérer
  l'URL, la clé `anon` et la clé `service_role` (**Project Settings → API**)
- Stripe : [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys)
  (clé secrète, mode test pour développer) ; créer 3 produits avec un prix
  mensuel et un prix annuel chacun (**Product catalog**), et un endpoint
  webhook (**Developers → Webhooks**) pointant vers `/api/stripe/webhook`

## 2. Configurer Supabase

Dans le **SQL Editor** du dashboard Supabase, exécuter dans l'ordre les 4
migrations de `supabase/migrations/` :

1. `0001_create_profiles.sql` — table `profiles` + trigger de création à
   l'inscription
2. `0002_add_stripe_fields.sql` — colonnes `stripe_customer_id`,
   `stripe_subscription_id`, `plan`, `current_period_end`
3. `0003_credit_functions.sql` — fonctions `spend_credits`/`refund_credits`
   (verrouillées à `service_role`)
4. `0004_gallery.sql` — table `gallery_entries` + bucket Storage `gallery`

Il n'y a pas de CLI Supabase configurée dans ce projet : ces migrations
s'appliquent à la main, une par une.

## 3. Lancer en local

```bash
npm install
```

Créez un fichier `.env.local` à la racine (basé sur `.env.example`) :

```bash
KIE_API_KEY=votre_cle_kie
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_cle_service_role
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_DECOUVERTE=price_...
STRIPE_PRICE_ESSENTIEL=price_...
STRIPE_PRICE_ULTIMATE=price_...
STRIPE_PRICE_DECOUVERTE_ANNUEL=price_...
STRIPE_PRICE_ESSENTIEL_ANNUEL=price_...
STRIPE_PRICE_ULTIMATE_ANNUEL=price_...
```

Puis démarrez le serveur de dev :

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

> Pour tester les webhooks Stripe en local, utiliser
> `stripe listen --forward-to localhost:3000/api/stripe/webhook`
> (Stripe CLI) — le `STRIPE_WEBHOOK_SECRET` affiché diffère de celui de
> production.

## 4. Déployer sur Vercel

Le projet Vercel existe déjà (`bluminoo`, team `mathisvrg's projects`) et sert
https://bluminoo.vercel.app. Ses identifiants sont codés en dur dans
`scripts/deploy.sh` — il ne manque qu'un token.

### Créer le token

1. Ouvrez [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. **Create Token** → scope `mathisvrg's projects` → copiez la valeur
   (elle n'est affichée qu'une seule fois)

### Où le coller

| Usage | Emplacement | Nom |
| --- | --- | --- |
| Déploiement auto à chaque push sur `main` | GitHub → Settings → Secrets and variables → Actions | `VERCEL_TOKEN` |
| Agents Cursor Cloud | Cursor Dashboard → Cloud Agents → Secrets | `VERCEL_TOKEN` |
| Machine locale | `export VERCEL_TOKEN=…` | `VERCEL_TOKEN` |

### Déployer

```bash
npm run deploy           # production
npm run deploy:preview    # preview
```

Le workflow `.github/workflows/deploy.yml` fait la même chose automatiquement à
chaque push sur `main`. Sans le secret, il émet un avertissement et n'échoue pas.

### Variables d'environnement de l'app

À configurer côté Vercel (**Project → Settings → Environment Variables**),
Production **et** Preview — mêmes noms que `.env.local` ci-dessus.

Redéployez après tout ajout/modification pour que les variables soient prises
en compte.

> La route vidéo utilise `maxDuration = 300` et la route image `maxDuration = 120`.
> Sur Vercel, un plan permettant des fonctions longues (Pro / Fluid) est
> recommandé — sinon la génération peut timeout.

## Coût

- Image Nano Banana Pro (kie.ai, résolution 1K) : environ **~0,12 $ / image**
- Vidéo Kling 3.0 Pro (kie.ai, mode pro sans audio) : environ **~0,45 $
  pour 5 s**
- Facturé à l'utilisateur : 150 crédits/image, 400 crédits/vidéo — voir
  `lib/credits.ts` pour le détail du calcul de marge par palier

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run start` — serveur de production
- `npm run lint` — ESLint
- `npm run deploy` / `npm run deploy:preview` — déploiement Vercel manuel

## Sécurité

- `KIE_API_KEY` : utilisée côté serveur uniquement (`app/api/generate`,
  `app/api/generate-video`, `app/api/kie/upload`) — jamais exposée au client
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` : côté serveur uniquement
  (`app/api/stripe/*`)
- `SUPABASE_SERVICE_ROLE_KEY` : côté serveur uniquement (`lib/supabase/service.ts`,
  `lib/credits.ts`, `lib/gallery-server.ts`) — bypasse la RLS, ne jamais
  l'exposer au client
- Débit/remboursement de crédits et écriture en galerie : fonctions Postgres
  et policies RLS verrouillées à `service_role` (voir
  `supabase/migrations/0003_credit_functions.sql` et `0004_gallery.sql`) —
  un client authentifié ne peut ni modifier son propre solde, ni celui d'un
  autre utilisateur, ni écrire dans le bucket `gallery`
