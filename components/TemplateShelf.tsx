import Image from "next/image";
import Link from "next/link";
import { featuredCategory, TEMPLATE_CATEGORIES } from "@/lib/templates";

/**
 * Étagère de gabarits affichée sous le studio : une carte vedette pleine
 * largeur, puis une rangée par catégorie, défilable horizontalement.
 *
 * Les vignettes mènent à la grille de la catégorie, sur l'ancre du gabarit
 * visé — c'est le chemin du modèle, et il garde le client dans le contexte
 * de la catégorie plutôt que de l'y parachuter seul. Elles ne pré-remplissent
 * rien dans le studio : le prompt d'un gabarit n'est pas destiné à être lu.
 */
export default function TemplateShelf() {
  if (TEMPLATE_CATEGORIES.length === 0) return null;

  const featured = featuredCategory();

  return (
    <section className="mt-10">
      <h2 className="sr-only">Templates</h2>

      {featured && (
        <Link
          href={`/templates/category/${featured.slug}`}
          aria-label={`${featured.title} — see all templates`}
          className="relative mx-2.5 mb-8 block aspect-[4/3] overflow-hidden rounded-2xl bg-[#1c1c1c] transition active:opacity-90"
        >
          <Image
            src={featured.featuredImage ?? featured.templates[0]?.cardImage}
            alt=""
            fill
            priority
            sizes="(max-width: 900px) 96vw, 880px"
            className="object-cover"
          />
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent"
          />
          <span className="absolute bottom-3 left-4 text-[17px] font-semibold text-white">
            {featured.title}
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur-sm">
            Try it
          </span>
        </Link>
      )}

      {TEMPLATE_CATEGORIES.map((category) => (
        <div key={category.slug} className="mb-8">
          <div className="flex items-center justify-between gap-4 px-2.5">
            <h3 className="text-[16px] text-white">{category.title}</h3>
            <Link
              href={`/templates/category/${category.slug}`}
              className="flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-[#8e8e8e] transition active:opacity-70"
            >
              See all
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>

          {/* Barre de défilement masquée : la rangée s'utilise au doigt ou à
              la molette, sans ascenseur visible sous les vignettes. */}
          <div className="mt-3 flex snap-x snap-mandatory scroll-pl-2.5 gap-3 overflow-x-auto px-2.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {category.templates.map((template) => (
              <Link
                key={template.slug}
                href={`/templates/category/${category.slug}#${template.slug}`}
                className="shrink-0 snap-start transition focus:outline-none focus-visible:outline-none active:opacity-80"
              >
                <div className="relative aspect-[9/11] w-[min(347px,62vw)] overflow-hidden rounded-2xl bg-[#1c1c1c]">
                  <Image
                    src={template.cardImage}
                    alt=""
                    fill
                    sizes="(max-width: 560px) 62vw, 347px"
                    className="object-cover"
                  />
                  {/* Dégradé sous le libellé : sans lui, un texte blanc sur
                      une vignette claire devient illisible. */}
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
      ))}
    </section>
  );
}
