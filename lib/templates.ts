/**
 * Catalogue de gabarits proposés sous le studio.
 *
 * Chaque entrée pré-remplit la description de la scène : choisir un gabarit
 * revient à écrire son `prompt` dans le champ, l'utilisateur restant libre
 * de le modifier avant de lancer la génération.
 *
 * Tant que `TEMPLATE_CATEGORIES` est vide, l'étagère ne s'affiche pas et le
 * bouton « Templates » reste inactif : mieux vaut un bouton visiblement
 * désactivé qu'un bouton qui n'ouvre rien. Même comportement que les
 * témoignages de `lib/testimonials.ts`.
 *
 * Pour ajouter un gabarit : déposer son visuel dans
 * `public/templates/<id>.jpg` (cadrage vertical, ratio 9/11), puis créer
 * l'entrée correspondante ci-dessous.
 */

export type Template = {
  /** Identifiant stable, sert aussi de nom de fichier pour le visuel. */
  id: string;
  /** Libellé affiché en bas de la vignette. */
  label: string;
  /** Description injectée dans le champ de saisie du studio. */
  prompt: string;
  /** Chemin du visuel, relatif à `public/`. */
  image: string;
};

export type TemplateCategory = {
  id: string;
  title: string;
  templates: Template[];
};

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [];
