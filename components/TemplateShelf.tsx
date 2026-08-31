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
  /**
   * Relevé le 31/08 sur l'étagère du modèle : la catégorie vedette n'y a pas
   * de rangée — son DOM ne contient aucun lien `swap-vehicule#<modèle>`.
   * Elle était rendue deux fois ici, en carte pleine largeur puis aussitôt
   * en rangée juste dessous avec les mêmes vignettes.
   */
  const rows = TEMPLATE_CATEGORIES.filter((c) => c.slug !== featured?.slug);

  return (
    <section className="mt-10">
      <h2 className="sr-only">Templates</h2>

      {featured && (
        <Link
          href={`/templates/category/${featured.slug}`}
          aria-label={`${featured.title} — see all templates`}
          // aspect-video et non 4/3 : la vedette du modèle est un bandeau
          // 16/9, nettement moins haut que ce qui était posé ici.
          className="relative mx-2.5 mb-5 block aspect-video overflow-hidden rounded-2xl bg-[#1c1c1c] transition active:opacity-90"
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
            className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent"
          />
          <span className="absolute bottom-3 left-3.5 text-[18px] font-semibold tracking-tight text-white">
            {featured.title}
          </span>
          <span className="absolute right-2.5 top-2.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur-md">
            Try it
          </span>
        </Link>
      )}

      {rows.map((category) => (
        <div key={category.slug} className="mb-6">
          <div className="flex items-baseline justify-between gap-4 px-2.5">
            {/* Gris et non blanc, et plus gros : c'est un intitulé de rayon
                sur le modèle, pas un titre de section. */}
            <h3 className="text-[1.15rem] font-semibold tracking-tight text-[#8e8e8e]">
              {category.title}
            </h3>
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
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
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
                // La largeur vit sur l'élément flex, pas sur la boîte
                // interne : un pourcentage posé sur celle-ci se résoudrait
                // contre un parent de largeur automatique, donc contre rien.
                className="w-[calc(37.594%_-_8.2406px)] min-w-[110px] shrink-0 snap-start transition focus:outline-none focus-visible:outline-none active:opacity-80"
              >
                {/* Largeur reprise telle quelle du modèle (portée par le
                    lien ci-dessus) : elle laisse entrevoir une troisième
                    vignette (≈2,7 visibles), ce qui signale que la rangée
                    défile. À 62vw, on n'en voyait qu'une et demie et la
                    rangée passait pour une impasse. */}
                <div className="relative aspect-[9/11] overflow-hidden rounded-2xl bg-[#1c1c1c]">
                  <Image
                    src={template.cardImage}
                    alt=""
                    fill
                    sizes="(max-width: 560px) 38vw, 210px"
                    className="object-cover"
                  />
                  {/* Dégradé sous le libellé : sans lui, un texte blanc sur
                      une vignette claire devient illisible. */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 to-transparent"
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
