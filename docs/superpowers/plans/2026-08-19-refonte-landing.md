# Refonte de la landing page — plan d'implémentation

> **Pour les agents :** SOUS-SKILL REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour implémenter ce plan tâche par tâche.
> Les étapes utilisent la syntaxe case à cocher (`- [ ]`) pour le suivi.

**Spec de référence :** `docs/superpowers/specs/2026-08-19-refonte-landing-design.md`

**Objectif :** remplacer la landing page `/landing` par une page calquée sur
la structure de crediacreation.com (l'autre site du même utilisateur), aux
couleurs Bluminoo, avec un bandeau de témoignages défilant.

**Architecture :** trois fichiers. `lib/testimonials.ts` reçoit les 29 avis
réels. `components/TestimonialMarquee.tsx` est créé — composant client isolé
portant toute l'animation. `app/landing/page.tsx` est réécrit autour de ces
deux briques, en réutilisant le tracking analytics existant.

**Stack :** Next.js 14 App Router, TypeScript, React, Tailwind CSS.

## Contraintes globales

- **Ne jamais pousser sans `git fetch` préalable.** Le dépôt a reçu des
  commits Replit en cours de travail à trois reprises le 19/08. Vérifier la
  divergence avec `origin/main` avant tout push, et fusionner si besoin.
- **Identité git :** ce poste n'a pas de config git globale. Chaque commit
  utilise les drapeaux ponctuels
  `git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit ...`
- **Porte de vérification, dans cet ordre :** `npx tsc --noEmit -p tsconfig.json`,
  puis `npx next build`, puis `npm test`. `tsc` seul ne suffit pas — il a
  déjà laissé passer une erreur ESLint qui cassait le build sur ce projet.
- **N'introduire aucun nouveau test.** Les 10 tests de
  `__tests__/share-button.test.tsx` doivent rester verts.
- **Ne pas réinstancier `StudioBackdrop`** : il est déjà monté globalement
  dans `app/layout.tsx` ligne 56 et s'affiche déjà derrière `/landing`. Le
  hero doit simplement ne pas le masquer avec un fond opaque.
- **Ne jamais inventer de témoignage.** `lib/testimonials.ts` porte cet
  avertissement en tête ; il reste valable. Les 29 entrées de ce plan sont
  de vrais retours clients de l'utilisateur.
- **Ne pas ajouter de compteur d'activité** (« X personnes ont généré… ») :
  omis volontairement, l'utilisateur l'a explicitement écarté.
- **Le tracking analytics ne doit pas être perdu.** Les quatre identifiants
  `LandingCtaId` existants doivent rester câblés.

---

### Task 1 : Remplir `lib/testimonials.ts` avec les 29 avis réels

**Fichiers :**
- Modifier : `lib/testimonials.ts` (seule la constante `TESTIMONIALS` change)

**Interfaces :**
- Consomme : rien.
- Produit : `TESTIMONIALS: Testimonial[]` non vide, avec
  `Testimonial = { name: string; role?: string; quote: string; rating?: number }`
  — consommé par la Task 2 et la Task 3.

- [ ] **Étape 1 : Remplacer le tableau vide par les 29 entrées**

Le type `Testimonial` et le commentaire d'avertissement en tête du fichier
sont **conservés tels quels**. Seule la ligne
`export const TESTIMONIALS: Testimonial[] = [];` est remplacée par :

```typescript
export const TESTIMONIALS: Testimonial[] = [
  { name: "ARTHUR_M78", quote: "Cette IA met une tempête aux autres je vous recommande!" },
  { name: "SARAH_SHY", quote: "Super réaliste, j'étais un peu sceptique au début mais c'est absolument parfait." },
  { name: "NEXTAZ_GOAT", quote: "Merci beaucoup vous avez fait un super travail. Et cest un des meilleurs sites que j'ai eu" },
  { name: "MARC_ANT75", quote: "Site très sérieux qui ne cesse de s'améliorer de jour en jour, merci de votre travail et investissement!" },
  { name: "LUC_SKY01", quote: "Clair net et précis continuer d'améliorer les points et réduire un peu les prix" },
  { name: "VIDEO_MAKER", quote: "Très bien mais continuer de travailler dessus et si possible mettre une fonctionnalité vidéo" },
  { name: "JOURDAN", quote: "C'était juste pour vous faire part de mon avis vis à vis du site, je le trouve franchement magnifique, et les images sont réalistes !" },
  { name: "RWAN", quote: "J'ai discuté avec le service client et tout c'est super bien passé le problème a était résolu rapidement" },
  { name: "AYMAN", quote: "Merci de vos efforts pour rendre l'ia vraiment amusante on a bien rigoler entre colleges mais il manque une catégorie supérieur illimité" },
  { name: "METII", quote: "force a vous les gars vous avez dead ça" },
  { name: "TOOKIE", quote: "Cette IA a énormément de potentiel et mérite les 5 étoiles" },
  { name: "ALESS", quote: "c'est super continuez comme ça et continuez d'améliorer l'IA" },
  { name: "WASSIM", quote: "je trouve le site super manque juste un peu pour arriver à un développement parfait" },
  { name: "RESULY", quote: "Magnifique franchement j'ai tout compris et prix raisonnable" },
  { name: "T57", quote: "site très bien et complet" },
  { name: "ADAMBEK", quote: "C'est super cool juste les crédits s'utilisent trop vite comme le prix" },
  { name: "ERWEAN87", quote: "J'avais peur que ce soit une arnaque mais sah banger foncez les mecs" },
  { name: "ENDWINGIRARD", quote: "j'hésitais carrément au début mais ça valait vrm le coup les frères" },
  { name: "FLAVI", quote: "franchement vous faites un boulot incroyable continuer comme ça c'est grave à vous qu'on aura accès à des trucs de fou furieux" },
  { name: "THOMASGUI", quote: "Très bien, IA au top" },
  { name: "G_PLAYER_X", quote: "Enfin un outil qui respecte les textures et la lumière naturelle." },
  { name: "LORYS_VIBE", quote: "Bluffé par la précision du Snap Rouge. C'est propre et rapide." },
  { name: "ZEN_USER_99", quote: "Continuer ce que vous faites, vous faites un travail extraordinaire. En plus vous êtes réactif quand il y a un problème. Merci!" },
  { name: "TOM_RIDER", quote: "vous êtes top les mec continuez sur ce chemin je l'espère pour vous, vous pourriez allez loin" },
  { name: "GIRAFE93FANTE", quote: "si seulement j'avais eu ça plus tôt mon pote croit à tout grâce au truc snap rouge 🤣" },
  { name: "ENTIFACHO", quote: "merci d'avoir mis la tech snap rouge intégrée dans l'abonnement essentiel vous gérer 🙏" },
  { name: "PEPITRDOR999", quote: "je regrette tellement pas mon achat j'ai évité de manger un kebab et je me retrouve avce ce banger 😭🙏" },
  { name: "MASKEYTV", quote: "pour un début je vous donne la note de 4.5 car rien n'y personne n'est parfait mais c'est extrêmement quali" },
  { name: "PAYXLANPY", quote: "Bravo pour votre travail de nombreuse personne adore le site, c'est du très bon boulot !" },
];
```

- [ ] **Étape 2 : Vérifier la compilation**

```bash
npx tsc --noEmit -p tsconfig.json
```

Attendu : aucune erreur. Les apostrophes typographiques présentes dans
certaines citations d'origine ont été normalisées en apostrophes droites
dans le bloc ci-dessus, pour éviter tout problème d'échappement.

- [ ] **Étape 3 : Commiter**

```bash
git add lib/testimonials.ts
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: ajouter les 29 témoignages clients réels"
```

---

### Task 2 : Créer le bandeau défilant `TestimonialMarquee`

**Fichiers :**
- Créer : `components/TestimonialMarquee.tsx`
- Modifier : `tailwind.config.ts` (ajout de deux keyframes et deux animations)

**Interfaces :**
- Consomme : `TESTIMONIALS` et le type `Testimonial` de `@/lib/testimonials`
  (Task 1).
- Produit : `export default function TestimonialMarquee()` — composant client
  sans props, consommé par la Task 3. S'auto-masque (renvoie `null`) si
  `TESTIMONIALS` est vide.

- [ ] **Étape 1 : Ajouter les keyframes à `tailwind.config.ts`**

Dans `theme.extend.keyframes`, ajouter ces deux entrées **à côté** des
keyframes existantes (`fade-up`, `reveal`, `magic-reveal`) sans en supprimer
aucune :

```typescript
        "marquee-left": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "marquee-right": {
          from: { transform: "translateX(-50%)" },
          to: { transform: "translateX(0)" },
        },
```

Et dans `theme.extend.animation`, à côté des animations existantes :

```typescript
        "marquee-left": "marquee-left 40s linear infinite",
        "marquee-right": "marquee-right 40s linear infinite",
```

- [ ] **Étape 2 : Créer `components/TestimonialMarquee.tsx`**

```tsx
"use client";

import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

/**
 * Bandeau de témoignages défilant en boucle continue, deux rangées de sens
 * opposés.
 *
 * Le défilement sans couture repose sur la duplication : chaque rangée rend
 * la liste deux fois, et l'animation translate de 0 à -50% (soit exactement
 * la longueur d'une copie) avant de repartir. L'œil ne voit jamais le saut.
 * Retirer la duplication casserait l'effet.
 */
function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex w-[300px] shrink-0 flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:w-[360px]">
      <blockquote className="text-sm leading-relaxed text-neutral-300">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-soft">
        — {testimonial.name}
      </figcaption>
    </figure>
  );
}

function MarqueeRow({
  items,
  direction,
}: {
  items: Testimonial[];
  direction: "left" | "right";
}) {
  const animation =
    direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  return (
    <div className="group flex overflow-hidden">
      <div
        className={`flex shrink-0 gap-4 pr-4 ${animation} group-hover:[animation-play-state:paused] motion-reduce:animate-none`}
      >
        {items.map((t) => (
          <TestimonialCard key={`a-${t.name}`} testimonial={t} />
        ))}
      </div>
      <div
        aria-hidden
        className={`flex shrink-0 gap-4 pr-4 ${animation} group-hover:[animation-play-state:paused] motion-reduce:animate-none`}
      >
        {items.map((t) => (
          <TestimonialCard key={`b-${t.name}`} testimonial={t} />
        ))}
      </div>
    </div>
  );
}

export default function TestimonialMarquee() {
  if (TESTIMONIALS.length === 0) return null;

  const half = Math.ceil(TESTIMONIALS.length / 2);
  const topRow = TESTIMONIALS.slice(0, half);
  const bottomRow = TESTIMONIALS.slice(half);

  return (
    <section className="relative overflow-hidden py-16">
      <h2 className="sr-only">Ce qu&apos;en disent nos utilisateurs</h2>
      <div className="flex flex-col gap-4">
        <MarqueeRow items={topRow} direction="left" />
        <MarqueeRow items={bottomRow} direction="right" />
      </div>
      {/* Masques dégradés : les cartes entrent et sortent en fondu au lieu
          d'être coupées net sur les bords. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink to-transparent sm:w-32" />
    </section>
  );
}
```

- [ ] **Étape 3 : Vérifier la compilation**

```bash
npx tsc --noEmit -p tsconfig.json
```

Attendu : aucune erreur. Le composant n'est pas encore importé — TypeScript
ne s'en plaint pas.

- [ ] **Étape 4 : Commiter**

```bash
git add components/TestimonialMarquee.tsx tailwind.config.ts
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: ajouter le bandeau de témoignages défilant"
```

---

### Task 3 : Réécrire `app/landing/page.tsx`

**Fichiers :**
- Modifier : `app/landing/page.tsx` (réécriture complète, 354 lignes remplacées)

**Interfaces :**
- Consomme : `TestimonialMarquee` (Task 2, export par défaut, sans props) ;
  `trackLandingPageView()` et `trackLandingCtaClick(ctaId: LandingCtaId)` de
  `@/lib/analytics`.
- Produit : la page `/landing`.

**Contrat de tracking à respecter impérativement.** Les quatre identifiants
du type `LandingCtaId` sont `"hero_primary"`, `"difference_link"`,
`"difference_cta"`, `"final_cta"`. Chacun doit rester câblé sur un CTA :

| Identifiant | CTA de la nouvelle page |
|---|---|
| `hero_primary` | Bouton « Commencer maintenant » du hero |
| `difference_link` | Lien « Voir plus d'exemples » (section Avant/Après) |
| `difference_cta` | Bouton « Démarrer avec Bluminoo » (section La différence) |
| `final_cta` | Bouton du bloc CTA final |

Ne **pas** réutiliser un identifiant existant pour un bouton différent : les
statistiques mélangeraient deux boutons. Si un CTA supplémentaire est
ajouté, ajouter son identifiant au type `LandingCtaId` dans
`lib/analytics.ts`.

- [ ] **Étape 1 : Réécrire le fichier**

Remplacer intégralement le contenu de `app/landing/page.tsx` par :

```tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import TestimonialMarquee from "@/components/TestimonialMarquee";
import { trackLandingCtaClick, trackLandingPageView } from "@/lib/analytics";

const FEATURES = [
  {
    title: "Ultra-réaliste",
    text: "Lumière, textures, visage et cadrage d'origine sont préservés. Le résultat passe pour une vraie photo.",
  },
  {
    title: "Dans un lieu réel",
    text: "Ajoute 1 à 3 photos d'un endroit et retrouve-toi dedans. Le décor, l'ambiance et la lumière sont analysés automatiquement.",
  },
  {
    title: "Photo ou vidéo",
    text: "Crée une image lifestyle, ou donne vie à ta scène en vidéo courte prête à poster en story.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Comment fonctionne la génération d'images ?",
    answer:
      "Tu envoies ta photo, tu ajoutes 1 à 3 photos du lieu où tu veux apparaître (ou tu décris simplement la scène), et l'IA t'intègre dedans de façon photoréaliste en préservant ton visage, ta pose et la lumière d'origine.",
  },
  {
    question: "Les photos m'appartiennent-elles ?",
    answer:
      "Oui. Tes rendus sont sauvegardés dans ta Galerie, associée à ton compte, et accessibles depuis n'importe quel appareil après connexion.",
  },
  {
    question: "Qu'est-ce que le système de Snap Rouge ?",
    answer:
      "Une méthode de partage qui envoie ta photo comme un vrai snap pris sur le moment, sans le filigrane « Média chargé » qui trahit les images importées depuis la galerie.",
  },
  {
    question: "Puis-je annuler mon abonnement ?",
    answer:
      "Oui, à tout moment depuis ton espace compte, via le portail de gestion sécurisé. Ton palier reste actif jusqu'à la fin de la période déjà payée.",
  },
  {
    question: "Les paiements sont-ils sécurisés ?",
    answer:
      "Les paiements sont traités par Stripe. Aucune donnée bancaire ne transite ni n'est stockée sur nos serveurs.",
  },
  {
    question: "Mes photos générées sont-elles confidentielles ?",
    answer:
      "Ta Galerie est privée et rattachée à ton seul compte. La politique de confidentialité détaille les sous-traitants utilisés pour le traitement des photos.",
  },
];

export default function LandingPage() {
  useEffect(() => {
    trackLandingPageView();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* HERO — pas de fond opaque : StudioBackdrop (monté dans
          app/layout.tsx) doit rester visible derrière. */}
      <section className="relative flex min-h-[80vh] flex-col items-center justify-center py-20 text-center">
        <span className="rounded-full border border-white/10 bg-black/40 px-5 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-soft">
          Nouvelle version disponible
        </span>

        <h1 className="font-display mt-8 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.03em] text-white sm:text-7xl md:text-8xl">
          Fake it &apos;til you make it
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
          L&apos;IA parfaite pour impressionner ton entourage avec une photo
          en un seul clic.
        </p>

        <Link
          href="/inscription"
          onClick={() => trackLandingCtaClick("hero_primary")}
          className="mt-10 inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-sm font-semibold text-ink transition hover:bg-primary-soft"
        >
          Commencer maintenant
        </Link>
      </section>

      <TestimonialMarquee />

      {/* SOLUTION EXCLUSIVE — le Snap Rouge, mis en avant seul. */}
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/10 px-6 py-14 text-center sm:px-12">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Solution exclusive
        </p>
        <h2 className="font-display mt-4 text-3xl font-semibold text-white sm:text-4xl">
          Envoie tes photos en snap rouge indétectable
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-300">
          Plus de filigrane « Média chargé » qui trahit une image importée.
          Ta photo part comme un vrai snap pris sur le moment.
        </p>
      </section>

      {/* AVANT / APRÈS */}
      <section className="py-20 sm:py-28">
        <div className="text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
            Ultra-réaliste
          </p>
          <h2 className="font-display mt-3 text-4xl font-semibold text-white sm:text-5xl">
            La différence Bluminoo
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-3xl border border-white/10">
            <img
              src="/landing/restaurant.jpg"
              alt="Photo d'un restaurant utilisée comme lieu de référence"
              className="h-72 w-full object-cover"
            />
            <figcaption className="border-t border-white/10 bg-white/[0.02] px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                Avant
              </span>
              <p className="mt-1 text-sm text-neutral-300">
                La photo du lieu, prise ou trouvée par tes soins.
              </p>
            </figcaption>
          </figure>

          <figure className="overflow-hidden rounded-3xl border border-primary/30">
            <img
              src="/landing/rooftop.jpg"
              alt="Rendu Bluminoo : sujet intégré dans le lieu"
              className="h-72 w-full object-cover"
            />
            <figcaption className="border-t border-primary/20 bg-primary/[0.06] px-5 py-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-soft">
                Après
              </span>
              <p className="mt-1 text-sm text-neutral-200">
                Te voilà sur place : lumière, décor et perspective recalculés.
              </p>
            </figcaption>
          </figure>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/galerie"
            onClick={() => trackLandingCtaClick("difference_link")}
            className="text-sm font-medium text-primary-soft underline-offset-4 transition hover:text-primary hover:underline"
          >
            Voir plus d&apos;exemples
          </Link>
        </div>
      </section>

      {/* LA DIFFÉRENCE — arguments produit */}
      <section className="pb-20 sm:pb-28">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-white/[0.02] p-6"
            >
              <h3 className="font-display text-xl font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {feature.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/inscription"
            onClick={() => trackLandingCtaClick("difference_cta")}
            className="inline-flex items-center justify-center rounded-2xl border border-primary/40 px-8 py-4 text-sm font-semibold text-primary-soft transition hover:border-primary hover:text-primary"
          >
            Démarrer avec Bluminoo
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-20 sm:pb-28">
        <div className="text-center">
          <h2 className="font-display text-4xl font-semibold text-white sm:text-5xl">
            Questions fréquentes
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            Tout ce que tu dois savoir sur Bluminoo Studio.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:content-none">
                {item.question}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-primary/10 px-6 py-16 text-center sm:px-12 sm:py-24">
        <h2 className="font-display text-4xl font-semibold text-white sm:text-6xl">
          Prêt à impressionner ?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-300">
          Crée ta première scène en quelques secondes.
        </p>
        <Link
          href="/inscription"
          onClick={() => trackLandingCtaClick("final_cta")}
          className="mt-10 inline-flex items-center justify-center rounded-2xl bg-primary px-8 py-4 text-sm font-semibold text-ink transition hover:bg-primary-soft"
        >
          Commencer maintenant
        </Link>
      </section>
    </div>
  );
}
```

- [ ] **Étape 2 : Vérifier que les 4 identifiants de tracking sont câblés**

```bash
grep -n "trackLandingCtaClick\|trackLandingPageView" app/landing/page.tsx
```

Attendu : 6 occurrences — l'import, `trackLandingPageView` dans le
`useEffect`, puis `hero_primary`, `difference_link`, `difference_cta` et
`final_cta` exactement une fois chacun.

- [ ] **Étape 3 : Vérifier la porte complète**

```bash
npx tsc --noEmit -p tsconfig.json
npx next build
npm test
```

Attendu : aucune erreur, et les 10 tests de partage passent.

- [ ] **Étape 4 : Commiter**

```bash
git add app/landing/page.tsx
git -c user.name="Mathis" -c user.email="mathis1812@users.noreply.github.com" commit -m "feat: refondre la landing page (structure Credia, DA Bluminoo)"
```

---

### Task 4 : Vérification du rendu et déploiement

- [ ] **Étape 1 : Lancer le serveur de dev**

Utiliser l'outil de preview du harnais, pas `npm run dev` en tâche de fond.
Si `.claude/launch.json` n'existe pas, le créer avec une configuration
nommée `bluminoo-local`, commande `npm`, arguments
`["run", "dev", "--prefix", "C:/Users/julie/projects/fakeit", "--", "-p", "3010"]`,
port `3010`.

- [ ] **Étape 2 : Vérifier le rendu de `/landing` par le DOM**

Le pane visuel du navigateur n'est pas disponible dans cette session :
aucune capture d'écran n'est possible. Vérifier par lecture du DOM que :

- les deux rangées du bandeau existent et contiennent chacune la liste
  dupliquée (compter les cartes : 2 × le nombre d'avis de la rangée)
- les classes `animate-marquee-left` et `animate-marquee-right` sont bien
  appliquées
- les six questions de la FAQ sont présentes
- aucun compteur d'activité n'apparaît

- [ ] **Étape 3 : Arrêter le serveur et nettoyer**

Arrêter le serveur de dev, et supprimer `.claude/launch.json` s'il a été
créé à l'étape 1.

- [ ] **Étape 4 : Vérifier la divergence avant de pousser**

```bash
git fetch origin
git log --oneline main..origin/main
```

Si des commits apparaissent, vérifier l'absence de conflit réel avec
`git merge-tree --write-tree --name-only main origin/main` (une sortie sans
liste de fichiers = auto-fusion propre), fusionner, puis **repasser la porte
de vérification complète** avant de pousser.

- [ ] **Étape 5 : Pousser et surveiller le déploiement**

```bash
git push origin main
gh run list --limit 1 --json databaseId -q '.[0].databaseId'
```

Puis surveiller la conclusion du run avec `gh run watch <id> --exit-status`
et vérifier que `/landing` répond en production.

- [ ] **Étape 6 : Rendre la main**

Signaler à l'utilisateur que le rendu visuel final — en particulier sur
mobile, et l'effet de défilement en mouvement — n'a pas pu être vérifié
autrement que par le DOM, et qu'il doit le valider lui-même.
