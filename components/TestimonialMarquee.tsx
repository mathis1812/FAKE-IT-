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
function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex w-[300px] shrink-0 flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:w-[360px]">
      <blockquote className="text-sm leading-relaxed text-neutral-300">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-soft">
        — {testimonial.name}
      </figcaption>
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
        className={`flex shrink-0 gap-4 pr-4 ${animation} group-hover:[animation-play-state:paused] group-active:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none`}
      >
        {items.map((t) => (
          <TestimonialCard key={`a-${t.name}`} testimonial={t} />
        ))}
      </div>
      <div
        aria-hidden
        className={`flex shrink-0 gap-4 pr-4 ${animation} group-hover:[animation-play-state:paused] group-active:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:hidden`}
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
      <h2 className="sr-only">Ce qu&apos;en disent nos utilisateurs</h2>
      <div className="flex flex-col gap-4">
        <MarqueeRow items={topRow} direction="left" />
        <MarqueeRow items={bottomRow} direction="right" />
      </div>
    </section>
  );
}
