"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Carrousel du hero : la même scène en trois états, dans l'ordre de la
 * démonstration — la photo d'origine, le rendu généré, puis son animation
 * en vidéo.
 *
 * La transition entre deux vues est volontairement nue pour l'instant :
 * l'animation reste à choisir. Elle s'ajoutera ici, sur ce seul conteneur,
 * sans toucher au reste.
 */

const SLIDE_DURATION_MS = 3_000;

type Slide =
  | { kind: "image"; label: string; src: string; alt: string }
  | { kind: "video"; label: string; src: string };

const SLIDES: Slide[] = [
  {
    kind: "image",
    label: "Before",
    src: "/landing/hero-before.png",
    alt: "The original photo, before any edit.",
  },
  {
    kind: "image",
    label: "After",
    src: "/landing/hero-after.png",
    alt: "The same photo turned into a dramatic scene.",
  },
  { kind: "video", label: "Animation", src: "/landing/hero-animation.mp4" },
];

export default function HeroSlider() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[index];

  return (
    <div className="w-full max-w-[560px] rounded-[28px] border border-line bg-panel p-2.5">
      <div className="relative aspect-video w-full overflow-hidden rounded-[20px] bg-black">
        {slide.kind === "image" ? (
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            sizes="(max-width: 640px) 100vw, 560px"
            className="object-cover"
            priority={index === 0}
          />
        ) : (
          <video
            key={slide.src}
            src={slide.src}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
          />
        )}

        <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur-sm">
          {slide.label}
        </span>
      </div>
    </div>
  );
}
