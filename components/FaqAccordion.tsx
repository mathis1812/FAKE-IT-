"use client";

import { useState } from "react";

export type FaqItem = {
  question: string;
  answer: string;
};

/**
 * Accordéon de la FAQ.
 *
 * L'ouverture repose sur une grille dont la rangée passe de 0fr à 1fr :
 * contrairement à une animation de hauteur, elle s'adapte à la longueur
 * réelle de la réponse sans qu'aucune valeur ne soit à mesurer en amont.
 * Le contenu est enveloppé dans un conteneur en overflow-hidden, sans quoi
 * il déborderait pendant la transition.
 *
 * Un seul panneau ouvert à la fois, comme sur le modèle.
 */
export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mt-10">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.question}
            className="border-b border-dashed border-white/15 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${index}`}
              className="flex w-full items-baseline justify-between gap-4 py-5 text-left text-[17px] font-medium leading-[1.4] text-white active:opacity-70"
            >
              {item.question}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-5 w-5 shrink-0 translate-y-1 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <div
              id={`faq-panel-${index}`}
              className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <p className="pb-5 text-[16px] leading-[1.5] text-white/60">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
