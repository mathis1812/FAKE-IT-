import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TemplateGenerator from "@/components/TemplateGenerator";
import TemplateHeader from "@/components/TemplateHeader";
import TemplateVariantPicker from "@/components/TemplateVariantPicker";
import {
  allTemplates,
  categoryOfTemplate,
  findTemplate,
  hasVariants,
  toTemplateView,
  toVariantViews,
} from "@/lib/templates";

/**
 * Page d'un gabarit. Deux formes selon le catalogue : sans variante, on
 * arrive directement sur l'import ; avec variantes, un écran de choix
 * s'intercale et l'import vit sur /templates/<slug>/<variante>.
 *
 * Tant que le catalogue est vide, aucune page n'est rendue et tout slug
 * répond 404.
 */

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return allTemplates().map((template) => ({ slug: template.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const template = findTemplate(params.slug);
  if (!template) return {};
  return {
    title: `${template.label} — Bluminoo`,
    description: `Turn your photo into a ${template.label.toLowerCase()} scene in seconds.`,
  };
}

export default function TemplatePage({ params }: Props) {
  const template = findTemplate(params.slug);
  if (!template) notFound();

  const category = categoryOfTemplate(template.slug);
  // Retour sur l'ancre exacte du gabarit dans la grille : le client
  // retrouve sa place au lieu de repartir du haut.
  const backHref = category
    ? `/templates/category/${category.slug}#${template.slug}`
    : "/templates";

  return (
    <>
      <TemplateHeader backHref={backHref} title={template.label} />
      {/* Vues sans prompt : une prop passée à un composant client est
          sérialisée dans le HTML servi. */}
      {hasVariants(template) ? (
        <TemplateVariantPicker
          template={toTemplateView(template)}
          variants={toVariantViews(template.variants)}
          question={template.variantQuestion}
          defaultVariantSlug={template.defaultVariantSlug}
        />
      ) : (
        <TemplateGenerator template={toTemplateView(template)} />
      )}
    </>
  );
}
