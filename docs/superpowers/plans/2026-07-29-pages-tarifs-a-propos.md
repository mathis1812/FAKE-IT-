# Finaliser Tarifs et À propos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les placeholders "bientôt disponible" de `/tarifs` et `/a-propos` par un vrai contenu (grille de tarifs informative, présentation + FAQ + contact).

**Architecture:** Deux composants serveur indépendants, JSX inline (pas de nouveau composant partagé au-delà de `Panel` déjà existant). Aucun state, aucune interactivité.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS.

## Global Constraints

- Aucun chiffre de quota inventé pour le plan Gratuit (l'app n'a aucun système de comptage réel) — texte "illimité pour le moment", jamais un nombre précis de générations.
- Le contenu de la FAQ doit refléter le comportement **actuel réel** de l'app : l'onglet Vidéo prend une **image** source (pas une vidéo) — ne pas mentionner la migration Kling O1 (non livrée).
- Contact : `mailto:mathisvergne27@gmail.com`.
- Réutiliser `Panel` (`@/components/Panel`), l'accent `primary`, `font-display` — aucun nouveau système visuel.
- Pas de framework de tests dans ce projet. Vérification via `npx tsc --noEmit -p tsconfig.json` + vérification manuelle au navigateur.

---

## Fichiers concernés

- Modifier : `app/tarifs/page.tsx` (remplacement complet)
- Modifier : `app/a-propos/page.tsx` (remplacement complet)

---

### Task 1: Page Tarifs

**Files:**
- Modify: `app/tarifs/page.tsx` (fichier entier remplacé)

**Interfaces:** aucune — page statique autonome.

- [ ] **Step 1: Remplacer `app/tarifs/page.tsx`**

```tsx
import Panel from "@/components/Panel";

const FREE_FEATURES = [
  "Génération photo & vidéo illimitée pour le moment",
  "Presets Montre / Voiture / Lieu",
  "Galerie locale (15 dernières générations)",
];

const PRO_FEATURES = [
  "Génération prioritaire",
  "Résolutions supérieures",
  "Historique étendu",
  "Support prioritaire",
];

export default function TarifsPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-4xl py-8">
      <div className="mb-8 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Tarifs
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Des tarifs simples, pensés pour créer sans limite.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Panel className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">
              Gratuit
            </h3>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-soft">
              Plan actuel
            </span>
          </div>
          <ul className="space-y-2.5 text-sm text-neutral-400">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-semibold text-white">
              Pro
            </h3>
            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Bientôt disponible
            </span>
          </div>
          <ul className="mb-6 space-y-2.5 text-sm text-neutral-400">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-neutral-600" />
                {feature}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-neutral-500"
          >
            Bientôt disponible
          </button>
        </Panel>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Vérification manuelle**

Run: `npm run dev` (en arrière-plan si pas déjà lancé). Naviguer vers `/tarifs` : les deux formules s'affichent, "Gratuit" a le badge "Plan actuel", "Pro" a le bouton désactivé "Bientôt disponible". Aucun chiffre de quota n'apparaît.

- [ ] **Step 4: Commit**

```bash
git add app/tarifs/page.tsx
git commit -m "feat: finaliser la page Tarifs (grille informative)"
```

---

### Task 2: Page À propos

**Files:**
- Modify: `app/a-propos/page.tsx` (fichier entier remplacé)

**Interfaces:** aucune — page statique autonome.

- [ ] **Step 1: Remplacer `app/a-propos/page.tsx`**

```tsx
import Panel from "@/components/Panel";

const FAQ_ITEMS = [
  {
    question: "Quels formats de photo sont acceptés ?",
    answer:
      "JPG, PNG et WebP, jusqu'à 10 Mo. Les images plus lourdes que 2 Mo sont automatiquement compressées avant l'envoi.",
  },
  {
    question: "Combien de temps prend une génération ?",
    answer:
      "Environ 15 à 30 secondes pour une image, et 90 secondes ou plus pour une vidéo.",
  },
  {
    question: "Mes photos sont-elles conservées ?",
    answer:
      "Vos rendus réussis sont sauvegardés uniquement dans ce navigateur (Galerie locale, 15 dernières générations) — rien n'est stocké sur un serveur qui nous appartient.",
  },
  {
    question: "Comment fonctionne l'onglet Vidéo ?",
    answer:
      "Uploadez une image source (et en option une photo de l'objet de remplacement), décrivez le changement souhaité, et Bluminoo Studio génère une courte vidéo intégrant la modification.",
  },
];

export default function AProposPage() {
  return (
    <div className="animate-fade-up mx-auto max-w-3xl py-8">
      <Panel className="mb-6 p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          À propos
        </p>
        <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
          Bluminoo Studio
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">
          Bluminoo Studio transforme une photo — visage, poignet ou scène —
          en une version ultra-réaliste avec un élément de luxe intégré
          (montre, voiture, décor haut de gamme), en préservant la
          personne, la pose, la lumière et le cadrage d&apos;origine, en
          image ou en vidéo.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Propulsé par Google Gemini 2.5 Flash Image pour l&apos;image, et
          Kling (via fal.ai) pour la vidéo.
        </p>
      </Panel>

      <Panel className="mb-6 p-6 sm:p-8">
        <h3 className="font-display mb-5 text-2xl font-semibold text-white">
          FAQ
        </h3>
        <div className="space-y-5">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question}>
              <p className="text-sm font-semibold text-neutral-100">
                {item.question}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-6 text-center sm:p-8">
        <h3 className="font-display mb-2 text-xl font-semibold text-white">
          Contact
        </h3>
        <p className="text-sm text-neutral-500">
          Une question, un problème ?{" "}
          <a
            href="mailto:mathisvergne27@gmail.com"
            className="text-primary-soft underline underline-offset-2 hover:text-primary"
          >
            mathisvergne27@gmail.com
          </a>
        </p>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Vérification manuelle**

Naviguer vers `/a-propos` : les trois blocs (Présentation, FAQ, Contact) s'affichent, le lien de contact ouvre bien un `mailto:` vers `mathisvergne27@gmail.com`. Aucune mention d'un upload vidéo en entrée sur l'onglet Vidéo.

- [ ] **Step 4: Commit**

```bash
git add app/a-propos/page.tsx
git commit -m "feat: finaliser la page A propos (présentation, FAQ, contact)"
```
