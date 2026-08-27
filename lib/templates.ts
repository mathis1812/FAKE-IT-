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

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [];

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

