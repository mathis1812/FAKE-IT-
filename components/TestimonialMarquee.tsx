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
        className={`flex shrink-0 ${animation} ${pausedClass} group-hover:[animation-play-state:paused] motion-reduce:animate-none`}
      >
        {items.map((t) => (
          <TestimonialCard key={`a-${t.name}`} testimonial={t} />
        ))}
      </div>
      <div
        aria-hidden
        className={`flex shrink-0 ${animation} ${pausedClass} group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:hidden`}
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
          ? "Resume scrolling"
          : "Pause scrolling"
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
      {isPaused ? "Resume" : "Pause"}
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
      <h2 className="sr-only">What our users say</h2>
      <div className="flex flex-col gap-3">
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
