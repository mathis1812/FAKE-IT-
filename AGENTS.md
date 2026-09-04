# AGENTS.md

Contrat de travail pour les agents qui modifient ce dépôt — Claude Code, Replit,
Codex, Cursor. Un seul produit, plusieurs agents : ces règles existent pour
qu'ils ne se défassent pas mutuellement.

## Le produit

**Bluminoo** — SaaS de transformation de photos par IA. Next.js 14 (App
Router), TypeScript, Tailwind, Supabase (auth, base, stockage), Stripe
(abonnements), déployé sur Vercel.

Le produit est **anglophone** : toute chaîne visible par l'utilisateur s'écrit
en anglais. Les commentaires de code et les messages de commit s'écrivent en
français.

## 1. Le tronc

`main` fait autorité et part en production à chaque push. Toute branche part de
`main` et y revient vite — **pas de branche longue** : une branche de feature a
déjà accumulé 112 commits hors production pendant des semaines.

Nommage : `<agent>/<sujet>` — `claude/...`, `replit/...`, `codex/...`.
`git branch -r` est le tableau de coordination : il dit qui travaille où.

Format des commits : `<type>: <description>` (feat, fix, refactor, docs, test,
chore, perf, ci), avec un corps qui explique le **pourquoi**.

## 2. Zones

Deux agents ne travaillent jamais dans la même zone en même temps.

| Zone | Fichiers |
|---|---|
| **Génération** | `lib/gemini-jobs.ts`, `lib/place-prompt.ts`, `lib/template-prompts.ts`, `lib/world-prompts.ts`, `lib/templates.ts`, `app/api/generate*` |
| **Interface** | `app/page.tsx`, `app/landing/`, `components/`, `tailwind.config.ts` |
| **Paiement & comptes** | `app/api/stripe/`, `lib/stripe.ts`, `lib/credits.ts`, `lib/generation-tiers.ts`, `app/account/` |
| **Schéma** | `supabase/migrations/` |

`app/page.tsx` a été modifié 97 fois en 60 jours : c'est le point de collision
le plus probable du dépôt.

## 3. Migrations — lire avant d'écrire

Il n'existe **qu'une seule base Supabase, celle de production**. Ni base de
développement, ni pré-production.

- Un agent peut **écrire** un fichier de migration. Il ne l'**applique** jamais.
- Seul le propriétaire l'exécute, à la main, dans le SQL Editor de Supabase.
- Le numéro se réserve en **poussant le fichier d'abord** : sans ça, deux agents
  créent un `0009` chacun et le conflit passe inaperçu.
- Toute migration doit être ré-exécutable : `on conflict do nothing`,
  `drop policy if exists` avant chaque `create policy`, `update` idempotent.
- Une migration qui **modifie** l'existant casse la production avant que le code
  correspondant n'y soit déployé. La rendre compatible avec le code déjà en
  ligne, ou prévenir le propriétaire pour synchroniser les deux.

## 4. Contrat de sortie

Toute branche doit laisser ces quatre commandes vertes :

```bash
npx tsc --noEmit
npx vitest run
npx next lint
npx next build
```

C'est vérifiable par n'importe quel agent, sans discussion, et ça détecte les
collisions mieux qu'une règle écrite.

Ne pas lancer `next build` pendant qu'un serveur de développement tourne : les
deux écrivent dans `.next` et le serveur retombe en 500 jusqu'à sa suppression.

## 5. Les décisions vivent dans le code

Ce dépôt documente le **pourquoi** dans les commentaires, pas seulement le quoi.
Avant de modifier un réglage, lire le commentaire qui l'entoure : il dit souvent
qu'une piste a déjà été essayée et abandonnée, et pourquoi.

### Impasses déjà explorées — ne pas les refaire

| Piste | Verdict | Où c'est expliqué |
|---|---|---|
| Sortie 4K sur les gabarits | Plus lourd, plus lent, aucun gain visible | `lib/generation-tiers.ts`, `TEMPLATE_QUALITY` |
| Retirer `imageConfig.imageSize` du modèle Pro | Le modèle retombe sur un défaut plus petit, le rendu se dégrade | `lib/gemini-jobs.ts`, champ `resolution` |
| Forcer `imageConfig.aspectRatio` hors des univers | Le modèle d'édition recompose toute la scène | `app/api/generate/route.ts`, `lockAspectRatio` |
| Allonger le prompt de swap véhicule | N'a jamais corrigé les proportions : le défaut venait du modèle | `lib/place-prompt.ts`, `buildVehicleSwapPrompt` |
| Joindre une 2ᵉ image de référence au swap véhicule | Le décor de la référence contamine tout le rendu | commit `730025f`, annulé par `0ff70c1` |
| Écraser la photo d'entrée sous la taille de sortie | Le modèle agrandit et invente le micro-détail | `lib/studio-image.ts`, `ENCODE_STEPS` |

## 6. Secrets

`.env.local` n'est jamais commité, jamais partagé entre agents, jamais affiché —
ni ses valeurs, ni des extraits. Les variables de production vivent sur Vercel.

Aucune clé, aucun jeton, aucune valeur d'environnement dans le code, les
commentaires, les tests ou les messages de commit.

## 7. Tests

Le dépôt utilise Vitest. Les tests vivent dans `__tests__/`.

Tester ce qui **casse en silence** : un réglage qui dégrade un rendu sans lever
d'erreur, un fichier stocké dans un format trop lourd, un paramètre refusé par
une API. Les garde-fous existants documentent, dans leur en-tête, la régression
précise qu'ils empêchent — suivre ce format.
