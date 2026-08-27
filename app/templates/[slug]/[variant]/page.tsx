import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TemplateGenerator from "@/components/TemplateGenerator";
import TemplateHeader from "@/components/TemplateHeader";
import {
  allTemplateVariants,
  findTemplate,
  findVariant,
  toTemplateView,
  toVariantViews,
} from "@/lib/templates";

/**
 * Import d'une variante : dernier niveau du parcours, atteint depuis l'écran
 * de choix. Le prompt appliqué est celui de la variante, pas celui du
 * gabarit.
 */

type Props = { params: { slug: string; variant: string } };

export function generateStaticParams() {
  return allTemplateVariants();
}

export function generateMetadata({ params }: Props): Metadata {
  const template = findTemplate(params.slug);
  const variant = template && findVariant(template, params.variant);
  if (!template || !variant) return {};
  return {
    title: `${template.label} — ${variant.label} — Bluminoo`,
    description: `Turn your photo into a ${template.label.toLowerCase()} scene in seconds.`,
  };
}

export default function TemplateVariantPage({ params }: Props) {
  const template = findTemplate(params.slug);
  const variant = template && findVariant(template, params.variant);
  if (!template || !variant) notFound();

  return (
    <>
      <TemplateHeader
        backHref={`/templates/${template.slug}`}
        title={template.label}
      />
      {/* Vues sans prompt : le prompt de la variante est résolu par
          /api/generate, à partir des seuls identifiants d'URL. */}
      <TemplateGenerator
        template={toTemplateView(template)}
        variant={toVariantViews([variant])[0]}
      />
    </>
  );
}
