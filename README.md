# Bluminoo Studio

Application web qui transforme une photo (visage, poignet ou scène) en une version
ultra-réaliste avec un élément de luxe intégré (montre, voiture, décor haut de gamme),
en préservant la personne, la pose, la lumière et le cadrage d'origine — en **image**
ou en **vidéo**.

Propulsée par **kie.ai** (Nano Banana Pro / Gemini 3 Pro Image et Kling 3.0 Pro), Next.js 14
(App Router), TypeScript et Tailwind CSS. Fond animé **DotField** (React Bits).

> Le projet Vercel et le dépôt s'appellent toujours `fakeit` : seule l'interface
> a été rebaptisée.

## Fonctionnalités

### Image (Nano Banana Pro via kie.ai)
- Upload par glisser-déposer ou clic, avec aperçu immédiat de l'original
- 3 presets : **Montre**, **Voiture**, **Lieu**
- Champ de prompt personnalisé (remplace le preset s'il est rempli)
- Compression/redimensionnement automatique côté client (> 2 Mo → max 1536 px, JPEG 0.9)
- Upload sécurisé via `/api/kie/upload`, génération via le modèle `nano-banana-pro`
- Comparaison Avant / Après, téléchargement (`bluminoo-result.png`) et régénération

### Vidéo — Remplacer un Objet (kie.ai)
- Upload image source (requis) + image objet de remplacement (optionnel)
- Prompt libre décrivant le remplacement
- Génération d'une courte vidéo (~5 s) via Kling 3.0 Pro image-to-video
- Upload sécurisé via `/api/kie/upload` — `KIE_API_KEY` jamais exposée au client

## 1. Obtenir les clés API

- kie.ai : [kie.ai/api-key](https://kie.ai/api-key)

## 2. Lancer en local

```bash
npm install
```

Créez un fichier `.env.local` à la racine (basé sur `.env.example`) :

```bash
KIE_API_KEY=votre_cle_kie
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
KIE_API_KEY = votre_cle_kie
```

Redéployez pour que les variables soient prises en compte.

> La route vidéo utilise `maxDuration = 300`. Sur Vercel, un plan permettant des
> fonctions longues (Pro / Fluid) est recommandé — sinon la génération peut timeout.

## Coût

- Image Nano Banana Pro (kie.ai, résolution 1K) : environ **~0,12 $ / image**
- Vidéo Kling 3.0 Pro (kie.ai, mode pro sans audio) : environ **~0,45 $
  pour 5 s**

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run start` — serveur de production
- `npm run lint` — ESLint

## Sécurité

- `KIE_API_KEY` : utilisée côté serveur uniquement
  (`app/api/generate`, `app/api/generate-video`, `app/api/kie/upload`) —
  jamais exposée au client
