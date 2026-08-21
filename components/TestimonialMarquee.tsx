"use client";

import { useState } from "react";
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
  isPaused,
}: {
  items: Testimonial[];
  direction: "left" | "right";
  isPaused: boolean;
}) {
  const animation =
    direction === "left" ? "animate-marquee-left" : "animate-marquee-right";
  const pausedClass = isPaused ? "[animation-play-state:paused]" : "";

  return (
    <div className="group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4rem,black_calc(100%-4rem),transparent)] motion-reduce:overflow-x-auto">
      <div
        className={`flex shrink-0 gap-4 pr-4 ${animation} ${pausedClass} group-hover:[animation-play-state:paused] motion-reduce:animate-none`}
      >
        {items.map((t) => (
          <TestimonialCard key={`a-${t.name}`} testimonial={t} />
        ))}
      </div>
      <div
        aria-hidden
        className={`flex shrink-0 gap-4 pr-4 ${animation} ${pausedClass} group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:hidden`}
      >
        {items.map((t) => (
          <TestimonialCard key={`b-${t.name}`} testimonial={t} />
        ))}
      </div>
    </div>
  );
}

/**
 * Contrôle pause/lecture persistant (WCAG 2.2.2). Le survol desktop
 * (group-hover) reste un confort en plus, mais au tactile seul ce bouton
 * arrête réellement le défilement jusqu'à ce que l'utilisateur le relance.
 */
function PauseButton({
  isPaused,
  onToggle,
}: {
  isPaused: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={
        isPaused
          ? "Reprendre le défilement"
          : "Mettre le défilement en pause"
      }
      className="mx-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-300 transition hover:border-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
    >
      {isPaused ? (
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-3 w-3 fill-current"
        >
          <path d="M4 2.5v11l10-5.5-10-5.5z" />
        </svg>
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-3 w-3 fill-current"
        >
          <path d="M4 2.5h3v11H4v-11zm5 0h3v11H9v-11z" />
        </svg>
      )}
      {isPaused ? "Reprendre" : "Pause"}
    </button>
  );
}

export default function TestimonialMarquee() {
  const [isPaused, setIsPaused] = useState(false);

  if (TESTIMONIALS.length === 0) return null;

  const half = Math.ceil(TESTIMONIALS.length / 2);
  const topRow = TESTIMONIALS.slice(0, half);
  const bottomRow = TESTIMONIALS.slice(half);

  return (
    <section className="relative overflow-hidden py-16">
      <h2 className="sr-only">Ce qu&apos;en disent nos utilisateurs</h2>
      <div className="flex flex-col gap-4">
        <MarqueeRow items={topRow} direction="left" isPaused={isPaused} />
        <MarqueeRow items={bottomRow} direction="right" isPaused={isPaused} />
      </div>
      <div className="mt-6 px-4 motion-reduce:hidden">
        <PauseButton
          isPaused={isPaused}
          onToggle={() => setIsPaused((prev) => !prev)}
        />
      </div>
    </section>
  );
}
