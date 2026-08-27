"use client";

import Image from "next/image";
import { TEMPLATE_CATEGORIES, type Template } from "@/lib/templates";

/**
 * Étagère de gabarits affichée sous le studio : une rangée par catégorie,
 * défilable horizontalement avec accrochage.
 *
 * Choisir un gabarit ne lance rien : cela pré-remplit la description, que
 * l'utilisateur peut relire et modifier avant de générer. Générer sur simple
 * clic dépenserait ses crédits sans qu'il ait vu ce qui allait être demandé.
 */
export default function TemplateShelf({
  onPick,
}: {
  onPick: (template: Template) => void;
}) {
  if (TEMPLATE_CATEGORIES.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="sr-only">Templates</h2>

      {TEMPLATE_CATEGORIES.map((category) => (
        <div key={category.id} className="mb-8">
          <div className="flex items-center justify-between gap-4 px-2.5">
            <h3 className="text-[16px] text-white">{category.title}</h3>
            <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-[#8e8e8e]">
              {category.templates.length}
            </span>
          </div>

          {/* Barre de défilement masquée : la rangée s'utilise au doigt ou à
              la molette, sans ascenseur visible sous les vignettes. */}
          <div className="mt-3 flex snap-x snap-mandatory scroll-pl-2.5 gap-3 overflow-x-auto px-2.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {category.templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onPick(template)}
                className="shrink-0 snap-start transition focus:outline-none focus-visible:outline-none active:opacity-80"
              >
                <div className="relative aspect-[9/11] w-[min(347px,62vw)] overflow-hidden rounded-2xl bg-[#1c1c1c]">
                  <Image
                    src={template.image}
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
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
