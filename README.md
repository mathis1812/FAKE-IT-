# FakeIt

Application web qui transforme une photo (visage, poignet ou scène) en une version
ultra-réaliste avec un élément de luxe intégré (montre, voiture, décor haut de gamme),
en préservant la personne, la pose, la lumière et le cadrage d'origine.

Propulsée par **Google Gemini 2.5 Flash Image** (« Nano Banana »), Next.js 14 (App
Router), TypeScript et Tailwind CSS.

## Fonctionnalités

- Upload par glisser-déposer ou clic, avec aperçu immédiat de l'original
- 3 presets : **Montre**, **Voiture**, **Lieu**
- Champ de prompt personnalisé (remplace le preset s'il est rempli)
- Compression/redimensionnement automatique côté client (> 2 Mo → max 1536 px, JPEG 0.9)
- Comparaison Avant / Après, téléchargement (`fakeit-result.png`) et régénération
- Gestion d'erreurs claire en français, timeout 60 s, 1 retry si le modèle renvoie du texte

## 1. Obtenir une clé API

Créez une clé sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## 2. Lancer en local

```bash
npm install
```

Créez un fichier `.env.local` à la racine (basé sur `.env.example`) :

```bash
GEMINI_API_KEY=votre_cle_ici
```

Puis démarrez le serveur de dev :

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## 3. Déployer sur Vercel

```bash
npm i -g vercel   # si nécessaire
vercel --prod
```

Ajoutez ensuite la variable d'environnement dans le dashboard Vercel
(**Project → Settings → Environment Variables**) :

```
GEMINI_API_KEY = votre_cle_ici
```

Redéployez pour que la variable soit prise en compte.

## Coût

Comptez environ **~0,04 $ par image** générée avec Gemini 2.5 Flash Image. Vérifiez la
tarification à jour sur la page officielle de Google AI.

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — build de production
- `npm run start` — serveur de production
- `npm run lint` — ESLint

## Sécurité

La clé API n'est utilisée que côté serveur (`app/api/generate/route.ts`) via une variable
d'environnement, jamais exposée au client.
