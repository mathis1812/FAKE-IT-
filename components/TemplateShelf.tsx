import Image from "next/image";
import Link from "next/link";
import { TEMPLATE_CATEGORIES } from "@/lib/templates";

/**
 * Étagère de gabarits affichée sous le studio : une rangée par catégorie,
 * défilable horizontalement avec accrochage.
 *
 * Chaque vignette est un lien vers la page du gabarit, qui porte son propre
 * parcours de génération. Elle ne pré-remplit rien dans le studio : le
 * prompt d'un gabarit n'est pas destiné à être lu ni modifié.
 *
 * Nombre de vignettes montrées par rangée : toutes. Le lien « See all »
 * mène à la catégorie complète, utile dès qu'elle dépasse ce que la rangée
 * laisse voir.
 */
export default function TemplateShelf() {
  if (TEMPLATE_CATEGORIES.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="sr-only">Templates</h2>

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
                href={`/templates/${template.slug}`}
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
