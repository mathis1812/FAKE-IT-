"use client";

import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

/**
 * Bandeau de témoignages défilant en boucle continue, deux rangées de sens
 * opposés.
 *
 * Le défilement sans couture repose sur la duplication : chaque rangée rend
 * la liste deux fois, et l'animation translate de 0 à -100% (soit
 * exactement la largeur d'une copie) avant de repartir. L'œil ne voit
 * jamais le saut. Retirer la duplication casserait l'effet.
 */
/** Étoile pleine 12×12, dans l'accent — identique aux cinq de chaque carte. */
function Star() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#0285fe" aria-hidden>
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.35l-5.81 3.05 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
    </svg>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const initial = testimonial.name.trim().charAt(0).toUpperCase();
  return (
    <figure className="carte-avis mr-3 flex w-[280px] shrink-0 flex-col gap-2 rounded-2xl border border-line px-3.5 py-3 text-left">
      <figcaption className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-white/80">
          {initial}
        </span>
        <span className="min-w-0 truncate text-[14px] font-medium text-white">
          {testimonial.name}
        </span>
        <span className="ml-auto flex items-center">
          <div className="flex shrink-0 gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} />
            ))}
          </div>
          <span className="sr-only">5 out of 5 stars</span>
        </span>
      </figcaption>
      <blockquote className="text-[14px] leading-[1.45] text-white/85">
        {testimonial.quote}
      </blockquote>
    </figure>
  );
}

function MarqueeRow({
  items,
  direction,
}: {
  items: Testimonial[];
  direction: "left" | "right";
}) {
  const animation =
    direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  return (
    <div className="group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4rem,black_calc(100%-4rem),transparent)] motion-reduce:overflow-x-auto">
      <div
        className={`flex shrink-0 ${animation} group-hover:[animation-play-state:paused] motion-reduce:animate-none`}
      >
        {items.map((t) => (
          <TestimonialCard key={`a-${t.name}`} testimonial={t} />
        ))}
      </div>
      <div
        aria-hidden
        className={`flex shrink-0 ${animation} group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:hidden`}
      >
        {items.map((t) => (
          <TestimonialCard key={`b-${t.name}`} testimonial={t} />
        ))}
      </div>
    </div>
  );
}

export default function TestimonialMarquee() {
  if (TESTIMONIALS.length === 0) return null;

  const half = Math.ceil(TESTIMONIALS.length / 2);
  const topRow = TESTIMONIALS.slice(0, half);
  const bottomRow = TESTIMONIALS.slice(half);

  return (
    <section className="relative overflow-hidden py-16">
      <h2 className="sr-only">What our users say</h2>
      <div className="flex flex-col gap-3">
        <MarqueeRow items={topRow} direction="left" />
        <MarqueeRow items={bottomRow} direction="right" />
      </div>
    </section>
  );
}
