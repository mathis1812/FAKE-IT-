"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Carrousel de gabarits du panneau clair.
 *
 * Chaque carte montre un gabarit sous ses deux états : la photo d'origine
 * puis le rendu obtenu. Les cartes basculent ensemble, pour que la
 * comparaison reste lisible d'un coup d'œil plutôt que carte par carte.
 *
 * Dimensions relevées sur le modèle : carte de 422px de large en ratio 3/4,
 * cadre extérieur arrondi à 32px avec liseré blanc et ombre portée douce,
 * cadre intérieur arrondi à 24px.
 */

/** Durée d'affichage de chaque état (avant / après) d'une carte. */
const STATE_DURATION_MS = 2_600;
/** Durée d'affichage d'un gabarit avant de passer au suivant. */
const SLIDE_DURATION_MS = STATE_DURATION_MS * 2;

type Template = {
  id: string;
  before: string;
  after: string;
  alt: string;
};

const TEMPLATES: Template[] = [
  {
    id: "maison",
    before: "/landing/templates/maison-before.jpg",
    after: "/landing/templates/maison-after.jpg",
    alt: "A living room, then the same room with a collapsed ceiling.",
  },
  {
    id: "swap",
    before: "/landing/templates/swap-before.jpg",
    after: "/landing/templates/swap-after.jpg",
    alt: "A parked saloon car, then the same shot with a sports car.",
  },
  {
    id: "minecraft",
    before: "/landing/templates/minecraft-before.jpg",
    after: "/landing/templates/minecraft-after.jpg",
    alt: "A hiker on a mountain path, then the same scene as a voxel world.",
  },
  {
    id: "rase",
    before: "/landing/templates/rase-before.jpg",
    after: "/landing/templates/rase-after.jpg",
    alt: "A fluffy kitten, then the same kitten with its coat shaved.",
  },
];

export default function TemplatesCarousel() {
  const [index, setIndex] = useState(0);
  const [showAfter, setShowAfter] = useState(false);

  useEffect(() => {
    const stateTimer = setInterval(() => {
      setShowAfter((current) => !current);
    }, STATE_DURATION_MS);
    return () => clearInterval(stateTimer);
  }, []);

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setIndex((current) => (current + 1) % TEMPLATES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(slideTimer);
  }, []);

  return (
    <div
      className="mt-9"
      style={
        {
          "--carte": "min(422px, 82vw)",
          "--ecart": "16px",
        } as React.CSSProperties
      }
    >
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(calc(${-index} * (var(--carte) + var(--ecart))))`,
          }}
        >
          {TEMPLATES.map((template) => (
            <figure
              key={template.id}
              className="carte-templates mr-[var(--ecart)] w-[var(--carte)] shrink-0 rounded-[32px] border border-white/70 bg-[rgba(15,15,16,0.06)] p-2 shadow-[0_10px_30px_rgba(15,15,16,0.10),inset_0_1px_0_rgba(255,255,255,0.65)]"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-[rgba(15,15,16,0.12)]">
                <Image
                  src={showAfter ? template.after : template.before}
                  alt={template.alt}
                  fill
                  sizes="(max-width: 520px) 82vw, 422px"
                  className="select-none object-cover"
                />
                <span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur-sm">
                  {showAfter ? "After" : "Before"}
                </span>
              </div>
            </figure>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {TEMPLATES.map((template, i) => (
          <button
            key={template.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show template ${i + 1}`}
            aria-current={i === index ? "true" : undefined}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-[#0f0f10]" : "w-2 bg-[rgba(15,15,16,0.22)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
