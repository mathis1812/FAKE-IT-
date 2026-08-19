"use client";

import { useMemo } from "react";

/**
 * Effets "magiques" de la zone de génération :
 * - <SparkleFrame /> : étincelles violettes qui scintillent autour du cadre
 *   pendant le chargement (polling kie.ai).
 * - <RevealBurst /> : explosion d'étincelles au moment où le résultat apparaît.
 *
 * Palette : primary #a855f7 / soft #d8b4fe — cohérente avec la DA Bluminoo.
 */

function StarIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 0c.6 6.5 5.5 11.4 12 12-6.5.6-11.4 5.5-12 12-.6-6.5-5.5-11.4-12-12C6.5 11.4 11.4 6.5 12 0z" />
    </svg>
  );
}

type FrameSparkle = {
  top: string;
  left: string;
  size: number;
  delay: number;
  duration: number;
  soft: boolean;
};

/** Position (en %) sur le périmètre d'un rectangle pour t ∈ [0, 1). */
function perimeterPosition(t: number): { top: number; left: number } {
  const u = ((t % 1) + 1) % 1;
  if (u < 0.25) return { top: 0, left: (u / 0.25) * 100 };
  if (u < 0.5) return { top: ((u - 0.25) / 0.25) * 100, left: 100 };
  if (u < 0.75) return { top: 100, left: 100 - ((u - 0.5) / 0.25) * 100 };
  return { top: 100 - ((u - 0.75) / 0.25) * 100, left: 0 };
}

export function SparkleFrame({ count = 14 }: { count?: number }) {
  const sparkles = useMemo<FrameSparkle[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const pos = perimeterPosition(i / count + jitter * 0.04);
        return {
          top: `${pos.top}%`,
          left: `${pos.left}%`,
          size: 8 + Math.abs(Math.sin(i * 7.13)) * 8,
          delay: Math.abs(Math.sin(i * 3.7)) * 1.6,
          duration: 1.2 + Math.abs(Math.sin(i * 5.1)) * 1.1,
          soft: i % 3 === 0,
        };
      }),
    [count],
  );

  return (
    <div
      aria-hidden
      className="magic-frame pointer-events-none absolute inset-0 z-10 rounded-2xl"
    >
      {sparkles.map((s, i) => (
        <span
          key={i}
          className={`magic-sparkle absolute ${
            s.soft ? "text-primary-soft" : "text-primary"
          }`}
          style={{
            top: s.top,
            left: s.left,
            marginTop: -s.size / 2,
            marginLeft: -s.size / 2,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        >
          <StarIcon size={s.size} />
        </span>
      ))}
    </div>
  );
}

type BurstParticle = {
  dx: string;
  dy: string;
  size: number;
  delay: number;
  duration: number;
  soft: boolean;
};

export function RevealBurst({ count = 18 }: { count?: number }) {
  const particles = useMemo<BurstParticle[]>(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.abs(Math.sin(i * 9.7)) * 0.5;
        const radius = 70 + Math.abs(Math.sin(i * 4.3)) * 90;
        return {
          dx: `${Math.round(Math.cos(angle) * radius)}px`,
          dy: `${Math.round(Math.sin(angle) * radius)}px`,
          size: 7 + Math.abs(Math.sin(i * 6.2)) * 9,
          delay: Math.abs(Math.sin(i * 2.9)) * 0.18,
          duration: 0.7 + Math.abs(Math.sin(i * 8.4)) * 0.5,
          soft: i % 2 === 0,
        };
      }),
    [count],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-visible"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className={`magic-burst absolute ${
            p.soft ? "text-primary-soft" : "text-primary"
          }`}
          style={
            {
              "--dx": p.dx,
              "--dy": p.dy,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            } as React.CSSProperties
          }
        >
          <StarIcon size={p.size} />
        </span>
      ))}
    </div>
  );
}
