import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TemplateGenerator from "@/components/TemplateGenerator";
import {
  allTemplates,
  findTemplate,
  TEMPLATE_CATEGORIES,
} from "@/lib/templates";

/**
 * Troisième niveau : la page d'un gabarit, qui porte son propre parcours de
 * génération. Tant que le catalogue est vide, `generateStaticParams` ne rend
 * aucune page et tout slug répond 404.
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

/** Retrouve la catégorie d'un gabarit, pour le fil d'Ariane. */
function categoryOf(slug: string) {
  return TEMPLATE_CATEGORIES.find((category) =>
    category.templates.some((template) => template.slug === slug),
  );
}

export default function TemplatePage({ params }: Props) {
  const template = findTemplate(params.slug);
  if (!template) notFound();

  const category = categoryOf(template.slug);

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-6">
      <nav className="mb-4 flex items-center gap-1.5 text-[13px] text-[#8e8e8e]">
        <Link href="/" className="transition active:opacity-70">
          Studio
        </Link>
        {category && (
          <>
            <span aria-hidden>/</span>
            <Link
              href={`/templates/category/${category.slug}`}
              className="transition active:opacity-70"
            >
              {category.title}
            </Link>
          </>
        )}
      </nav>

      <h1 className="mb-5 text-[28px] font-semibold leading-tight tracking-tight text-white">
        {template.label}
      </h1>

      <TemplateGenerator template={template} />
    </div>
  );
}
