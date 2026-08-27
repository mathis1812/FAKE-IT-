/**
 * Catalogue de gabarits.
 *
 * Structure relevée sur le produit de référence le 27/08, en parcourant les
 * quatre niveaux en direct :
 *
 *   /                         studio + étagère
 *   /templates                la même page, atteignable par le bouton
 *   /templates/category/<c>   la grille complète d'une catégorie
 *   /templates/<t>            import direct, OU choix de variante
 *   /templates/<t>/<v>        import, quand le gabarit a des variantes
 *
 * Un gabarit porte son prompt et ne le montre jamais : le client choisit un
 * univers, dépose sa photo, génère. Certains gabarits déclinent ce prompt en
 * variantes — « Ça se répare », « Direction la casse » — et gagnent alors un
 * écran de choix avant l'import.
 *
 * Tant que `TEMPLATE_CATEGORIES` est vide, l'étagère ne s'affiche pas, le
 * bouton « Templates » reste inactif et toutes les routes répondent 404.
 * Même principe que `lib/testimonials.ts` : pas de contenu inventé.
 *
 * Pour ajouter un gabarit, déposer deux visuels dans `public/templates/` —
 * `<slug>-card.jpg` (vignette de grille, ratio 9/11) et `<slug>.jpg`
 * (l'exemple de résultat, plein cadre) — puis créer l'entrée. Une variante
 * peut fournir son propre exemple si son rendu diffère nettement.
 */

import { buildVehicleSwapPrompt } from "@/lib/place-prompt";

export type TemplateVariant = {
  /** Identifiant d'URL : la page vit sur /templates/<gabarit>/<variante>. */
  slug: string;
  /**
   * Libellé montré dans la liste de choix. Sur le modèle ce sont des vannes
   * (« L'assurance en sueur »), pas des niveaux techniques : le ton fait
   * partie du produit.
   */
  label: string;
  /** Prompt complet de cette variante. Jamais montré à l'utilisateur. */
  prompt: string;
  /** Exemple propre à la variante, si son rendu diffère nettement. */
  exampleImage?: string;
};

/**
 * Ce qu'un composant client a le droit de recevoir : tout sauf les prompts.
 *
 * Une prop passée à un composant client est sérialisée dans la charge RSC et
 * se retrouve en clair dans le HTML servi. Passer un `Template` entier
 * publiait donc les prompts, que le produit garde cachés. Les écrans ne
 * reçoivent que des identifiants, et `POST /api/generate` résout le prompt
 * côté serveur. Ne pas élargir ce type.
 */
export type TemplateView = TemplateBase;

/** Idem pour une variante : libellé et destination, jamais le prompt. */
export type VariantView = {
  slug: string;
  label: string;
  exampleImage?: string;
};

type TemplateBase = {
  /** Identifiant d'URL : la page vit sur /templates/<slug>. */
  slug: string;
  /** Libellé affiché sur les vignettes et en titre d'écran. */
  label: string;
  /** Vignette des grilles et de l'étagère. */
  cardImage: string;
  /** Exemple de résultat, affiché plein cadre. */
  exampleImage: string;
  /**
   * Deux consignes de cadrage, très courtes : elles s'affichent sur une
   * seule ligne, séparées par un point médian. Ce sont les conditions qui
   * font rater un rendu, pas un mode d'emploi.
   */
  tips: string[];
};

/**
 * Un gabarit porte soit un prompt unique, soit une liste de variantes —
 * jamais les deux, jamais aucun. L'union discriminée rend l'état incohérent
 * impossible à écrire, plutôt que de le rattraper à l'exécution.
 */
export type Template =
  | (TemplateBase & {
      prompt: string;
      variantQuestion?: never;
      variants?: never;
    })
  | (TemplateBase & {
      prompt?: never;
      /** Question posée au-dessus de la liste, ex. « How much damage? ». */
      variantQuestion: string;
      variants: TemplateVariant[];
    });

export type TemplateCategory = {
  /** Identifiant d'URL : la page vit sur /templates/category/<slug>. */
  slug: string;
  title: string;
  /**
   * Catégorie mise en avant : sa carte occupe toute la largeur en haut de
   * l'étagère, avec un badge « Try it ». Une seule à la fois — au-delà, la
   * mise en avant ne met plus rien en avant.
   */
  featured?: boolean;
  /** Visuel de la carte vedette, plus large que les vignettes de grille. */
  featuredImage?: string;
  templates: Template[];
};

/**
 * Catégorie vedette, relevée sur le modèle : 21 modèles, tous sans variante
 * — le client dépose une photo de son véhicule, choisit un modèle, obtient
 * le remplacement. Les slugs suivent ceux du modèle, y compris l'écart
 * apparent slug/libellé sur « temerario » (Huracán Tecnica) : c'est ainsi
 * qu'il est nommé côté source, laissé tel quel plutôt que corrigé sans
 * certitude.
 */
const VEHICLE_MODELS: { slug: string; label: string; target: string }[] = [
  { slug: "aventador-svj", label: "Aventador SVJ", target: "Lamborghini Aventador SVJ" },
  { slug: "gt3-rs", label: "911 GT3 RS", target: "Porsche 911 GT3 RS" },
  { slug: "chiron", label: "Chiron Super Sport", target: "Bugatti Chiron Super Sport" },
  { slug: "revuelto", label: "Revuelto", target: "Lamborghini Revuelto" },
  { slug: "m4", label: "M4 Competition", target: "BMW M4 Competition" },
  { slug: "rs6", label: "RS6 C8", target: "Audi RS6 Avant C8" },
  { slug: "rs3", label: "RS3 8Y", target: "Audi RS3 8Y" },
  { slug: "812-superfast", label: "812 Superfast", target: "Ferrari 812 Superfast" },
  { slug: "amg-gt-black-series", label: "AMG GT Black Series", target: "Mercedes-AMG GT Black Series" },
  { slug: "sf90", label: "SF90 Stradale", target: "Ferrari SF90 Stradale" },
  { slug: "m3", label: "M3 Competition", target: "BMW M3 Competition" },
  { slug: "911-turbo-s", label: "911 Turbo S", target: "Porsche 911 Turbo S" },
  { slug: "huracan-sto", label: "Huracán STO", target: "Lamborghini Huracán STO" },
  { slug: "golf-r", label: "Golf R", target: "Volkswagen Golf R" },
  { slug: "c63-s", label: "C 63 S", target: "Mercedes-AMG C 63 S" },
  { slug: "a45-s", label: "A 45 S", target: "Mercedes-AMG A 45 S" },
  { slug: "temerario", label: "Huracán Tecnica", target: "Lamborghini Huracán Tecnica" },
  { slug: "gtr-nismo", label: "GT-R Nismo", target: "Nissan GT-R Nismo" },
  { slug: "r8", label: "R8 V10", target: "Audi R8 V10" },
  { slug: "m2", label: "M2", target: "BMW M2" },
  { slug: "720s", label: "720S", target: "McLaren 720S" },
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    slug: "swap-vehicule",
    title: "Swap vehicle",
    featured: true,
    featuredImage: "/templates/aventador-svj-card.jpg",
    templates: VEHICLE_MODELS.map(({ slug, label, target }) => ({
      slug,
      label,
      cardImage: `/templates/${slug}-card.jpg`,
      exampleImage: `/templates/${slug}.jpg`,
      tips: ["Full car visible", "Plate area unobstructed"],
      prompt: buildVehicleSwapPrompt(target),
    })),
  },
];

/** Vrai si le gabarit passe par un écran de choix avant l'import. */
export function hasVariants(
  template: Template,
): template is Extract<Template, { variants: TemplateVariant[] }> {
  return Array.isArray(template.variants) && template.variants.length > 0;
}

/** Retrouve un gabarit par son identifiant d'URL, toutes catégories confondues. */
export function findTemplate(slug: string): Template | undefined {
  for (const category of TEMPLATE_CATEGORIES) {
    const match = category.templates.find((t) => t.slug === slug);
    if (match) return match;
  }
  return undefined;
}

export function findVariant(
  template: Template,
  variantSlug: string,
): TemplateVariant | undefined {
  if (!hasVariants(template)) return undefined;
  return template.variants.find((v) => v.slug === variantSlug);
}

export function findCategory(slug: string): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((c) => c.slug === slug);
}

/** Retrouve la catégorie d'un gabarit — sert aux retours et au fil de navigation. */
export function categoryOfTemplate(
  slug: string,
): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((category) =>
    category.templates.some((template) => template.slug === slug),
  );
}

/** La catégorie mise en avant, si elle existe. */
export function featuredCategory(): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((c) => c.featured);
}

/** Tous les gabarits à plat — sert à générer les routes statiques. */
export function allTemplates(): Template[] {
  return TEMPLATE_CATEGORIES.flatMap((c) => c.templates);
}

/** Retire les prompts d'un gabarit avant de le confier à un écran client. */
export function toTemplateView(template: Template): TemplateView {
  const { slug, label, cardImage, exampleImage, tips } = template;
  return { slug, label, cardImage, exampleImage, tips };
}

/** Idem pour une liste de variantes. */
export function toVariantViews(variants: TemplateVariant[]): VariantView[] {
  return variants.map(({ slug, label, exampleImage }) => ({
    slug,
    label,
    exampleImage,
  }));
}

/**
 * Résout le prompt à appliquer, à partir des seuls identifiants d'URL.
 * Appelée côté serveur par la route de génération : c'est elle qui garde les
 * prompts hors du navigateur.
 *
 * Renvoie `null` si le gabarit est inconnu, si une variante est demandée
 * pour un gabarit qui n'en a pas, ou si un gabarit à variantes est demandé
 * sans en préciser une — dans ce dernier cas, il n'existe aucun prompt à
 * appliquer.
 */
export function resolveTemplatePrompt(
  templateSlug: string,
  variantSlug?: string,
): string | null {
  const template = findTemplate(templateSlug);
  if (!template) return null;

  if (hasVariants(template)) {
    if (!variantSlug) return null;
    return findVariant(template, variantSlug)?.prompt ?? null;
  }

  if (variantSlug) return null;
  return template.prompt;
}

/** Tous les couples gabarit/variante à plat, pour les routes statiques. */
export function allTemplateVariants(): { slug: string; variant: string }[] {
  return allTemplates().flatMap((template) =>
    hasVariants(template)
      ? template.variants.map((v) => ({
          slug: template.slug,
          variant: v.slug,
        }))
      : [],
  );
}

