# Bluminoo Studio

Application web qui transforme une photo (visage, poignet ou scène) en une version
ultra-réaliste avec un élément de luxe intégré (montre, voiture, décor haut de gamme),
en préservant la personne, la pose, la lumière et le cadrage d'origine — en **image**
ou en **vidéo**.

Propulsée par **Google Gemini 2.5 Flash Image**, **fal.ai Kling O3**, Next.js 14
(App Router), TypeScript et Tailwind CSS. Fond animé **DotField** (React Bits).

> Le projet Vercel et le dépôt s'appellent toujours `fakeit` : seule l'interface
> a été rebaptisée.

## Fonctionnalités

### Image (Gemini)
- Upload par glisser-déposer ou clic, avec aperçu immédiat de l'original
- 3 presets : **Montre**, **Voiture**, **Lieu**
- Champ de prompt personnalisé (remplace le preset s'il est rempli)
- Compression/redimensionnement automatique côté client (> 2 Mo → max 1536 px, JPEG 0.9)
- Comparaison Avant / Après, téléchargement (`bluminoo-result.png`) et régénération

### Vidéo — Remplacer un Objet (fal.ai)
- Upload image source (requis) + image objet de remplacement (optionnel)
- Prompt libre décrivant le remplacement
- Génération d'une courte vidéo (~5 s) via Kling O3 image-to-video
- Upload sécurisé via proxy fal (`/api/fal/proxy`) — `FAL_KEY` jamais exposée au client

## 1. Obtenir les clés API

- Gemini : [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- fal.ai : [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)

## 2. Lancer en local

```bash
npm install
```

Créez un fichier `.env.local` à la racine (basé sur `.env.example`) :

```bash
GEMINI_API_KEY=votre_cle_gemini
FAL_KEY=votre_cle_fal
```

Puis démarrez le serveur de dev :

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## 3. Déployer sur Vercel

Le projet Vercel existe déjà (`fakeit`, team `mathisvrg's projects`) et sert
https://fakeit-delta.vercel.app. Ses identifiants sont codés en dur dans
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

Déjà configurées côté Vercel (**Project → Settings → Environment Variables**) :

```
GEMINI_API_KEY = votre_cle_gemini
FAL_KEY = votre_cle_fal
```

Redéployez pour que les variables soient prises en compte.

> La route vidéo utilise `maxDuration = 300`. Sur Vercel, un plan permettant des
> fonctions longues (Pro / Fluid) est recommandé — sinon la génération peut timeout.

## Coût

- Image Gemini Flash : environ **~0,04 $ / image**
- Vidéo Kling O3 (fal) : environ **~0,084 $ / sec** (~0,42 $ pour 5 s)

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run start` — serveur de production
- `npm run lint` — ESLint

## Sécurité

- `GEMINI_API_KEY` : utilisée uniquement côté serveur (`app/api/generate`)
- `FAL_KEY` : utilisée côté serveur (`app/api/generate-video` + proxy
  `app/api/fal/proxy`) — le client appelle fal via `proxyUrl: "/api/fal/proxy"`
