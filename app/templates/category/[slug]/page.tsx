import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findCategory, TEMPLATE_CATEGORIES } from "@/lib/templates";

/**
 * Deuxième niveau : tous les gabarits d'une catégorie, en grille. La rangée
 * du studio n'en montre qu'une partie ; « See all » mène ici.
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
    <div className="mx-auto w-full max-w-[900px] px-4 pb-16 pt-6">
      <nav className="mb-4 text-[13px] text-[#8e8e8e]">
        <Link href="/" className="transition active:opacity-70">
          Studio
        </Link>
      </nav>

      <h1 className="mb-5 text-[28px] font-semibold leading-tight tracking-tight text-white">
        {category.title}
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {category.templates.map((template) => (
          <Link
            key={template.slug}
            href={`/templates/${template.slug}`}
            className="transition active:opacity-80"
          >
            <div className="relative aspect-[9/11] w-full overflow-hidden rounded-2xl bg-[#1c1c1c]">
              <Image
                src={template.cardImage}
                alt=""
                fill
                sizes="(max-width: 640px) 46vw, 280px"
                className="object-cover"
              />
              {/* Dégradé sous le libellé : sans lui, un texte blanc sur une
                  vignette claire devient illisible. */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 to-transparent"
              />
              <span className="absolute inset-x-0 bottom-0 px-2 pb-2.5 text-center text-[13px] font-semibold leading-tight text-white">
                {template.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
