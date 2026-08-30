import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import TemplateHeader from "@/components/TemplateHeader";
import { findCategory, TEMPLATE_CATEGORIES } from "@/lib/templates";

/**
 * Grille complète d'une catégorie. Deux colonnes, libellé sous la vignette,
 * et une tuile finale « Other » qui renvoie au studio libre : quand le
 * gabarit cherché n'est pas là, le client a quand même une sortie.
 */

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return TEMPLATE_CATEGORIES.map((category) => ({ slug: category.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const category = findCategory(params.slug);
  if (!category) return {};
  return {
    title: `${category.title} — Bluminoo`,
    description: `${category.title} templates: pick a look, upload your photo, generate.`,
  };
}

export default function TemplateCategoryPage({ params }: Props) {
  const category = findCategory(params.slug);
  if (!category) notFound();

  return (
    <>
      <TemplateHeader backHref="/?screen=templates" title={category.title} />

      <div className="animate-fade-up mx-auto w-full max-w-[900px] px-4 pb-16 pt-[calc(env(safe-area-inset-top)+76px)]">
        <div className="grid grid-cols-2 gap-3">
          {category.templates.map((template) => (
            <Link
              key={template.slug}
              // L'ancre permet aux retours des niveaux suivants de ramener
              // le client exactement sur la vignette d'où il vient.
              id={template.slug}
              href={`/templates/${template.slug}`}
              className="scroll-mt-20 transition active:opacity-80"
            >
              <div className="relative aspect-[9/11] w-full overflow-hidden rounded-2xl bg-[#1c1c1c]">
                <Image
                  src={template.cardImage}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 46vw, 300px"
                  className="object-cover"
                />
              </div>
              <p className="mt-2 text-center text-[14px] font-medium text-white">
                {template.label}
              </p>
            </Link>
          ))}

          <Link
            href="/"
            className="flex aspect-[9/11] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[#2d2d2d] bg-[#161616] text-white transition active:opacity-80"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="text-[14px] font-medium">Other</span>
          </Link>
        </div>
      </div>
    </>
  );
}
