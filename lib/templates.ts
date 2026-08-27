/**
 * Catalogue de gabarits.
 *
 * Trois niveaux, comme sur le produit de référence : une étagère sur le
 * studio, une page par catégorie, une page par gabarit. Chaque gabarit a son
 * propre parcours de génération — avant/après, import, bouton affichant le
 * coût — et porte un prompt que l'utilisateur ne voit pas : il choisit un
 * univers, dépose sa photo, génère.
 *
 * Tant que `TEMPLATE_CATEGORIES` est vide, l'étagère ne s'affiche pas, le
 * bouton « Templates » reste inactif et les routes de gabarit répondent 404.
 * Même principe que `lib/testimonials.ts` : pas de contenu inventé.
 *
 * Pour ajouter un gabarit, déposer trois visuels dans `public/templates/` —
 * `<slug>-card.jpg` (vignette, ratio 9/11), `<slug>-before.jpg` et
 * `<slug>-after.jpg` (l'exemple avant/après) — puis créer l'entrée.
 */

export type Template = {
  /** Identifiant d'URL : la page vit sur /templates/<slug>. */
  slug: string;
  /** Libellé affiché sur la vignette et en titre de page. */
  label: string;
  /**
   * Description envoyée au modèle. Jamais montrée à l'utilisateur : c'est
   * ce qui distingue un gabarit du studio libre.
   */
  prompt: string;
  /** Vignette de l'étagère et des grilles de catégorie. */
  cardImage: string;
  /** Exemple de rendu, affiché en haut de la page du gabarit. */
  beforeImage: string;
  afterImage: string;
  /**
   * Consignes de cadrage, affichées sous la zone d'import. Deux ou trois
   * suffisent : ce sont les conditions qui font rater un rendu.
   */
  tips: string[];
};

export type TemplateCategory = {
  /** Identifiant d'URL : la page vit sur /templates/category/<slug>. */
  slug: string;
  title: string;
  templates: Template[];
};

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [];

/** Retrouve un gabarit par son identifiant d'URL, toutes catégories confondues. */
export function findTemplate(slug: string): Template | undefined {
  for (const category of TEMPLATE_CATEGORIES) {
    const match = category.templates.find((t) => t.slug === slug);
    if (match) return match;
  }
  return undefined;
}

export function findCategory(slug: string): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((c) => c.slug === slug);
}

/** Tous les gabarits à plat — sert à générer les routes statiques. */
export function allTemplates(): Template[] {
  return TEMPLATE_CATEGORIES.flatMap((c) => c.templates);
}
