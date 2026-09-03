"use client";

import { useMemo, useState } from "react";
import {
  SCENES,
  SCENE_CATEGORY_LABELS,
  type SceneCategory,
} from "@/lib/scenes";

type Filter = "all" | SceneCategory;

/**
 * Sélecteur de scène du studio.
 *
 * Le choix se fait sur la vignette, pas sur le libellé : l'utilisateur juge
 * un rendu, pas un mot. La vignette est donc l'élément dominant de la carte
 * et le texte n'arrive qu'en surimpression.
 *
 * Les vignettes sont servies depuis `public/landing/` — mêmes fichiers que
 * la landing, donc déjà en cache pour un visiteur qui vient de là.
 */
export default function ScenePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const categories = useMemo(() => {
    const present = new Set(SCENES.map((s) => s.category));
    return (Object.keys(SCENE_CATEGORY_LABELS) as SceneCategory[]).filter((c) =>
      present.has(c),
    );
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? SCENES : SCENES.filter((s) => s.category === filter)),
    [filter],
  );

  return (
    <div className="mb-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", ...categories] as Filter[]).map((c) => {
          const active = filter === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              aria-pressed={active}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                active
                  ? "bg-primary text-ink"
                  : "border border-white/10 text-neutral-400 hover:border-white/25 hover:text-neutral-200"
              }`}
            >
              {c === "all" ? "Toutes" : SCENE_CATEGORY_LABELS[c]}
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label="Choix de la scène"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {visible.map((scene) => {
          const selected = scene.id === value;
          return (
            <button
              key={scene.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              // Re-cliquer la scène sélectionnée la désélectionne : c'est la
              // seule façon de repasser en « lieu 100 % perso », sans ajouter
              // une case « aucune scène » qui alourdirait la grille.
              onClick={() => onChange(selected ? "" : scene.id)}
              className={`group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-2xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-not-allowed disabled:opacity-40 ${
                selected
                  ? "border-primary ring-1 ring-primary/50"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scene.thumbnail}
                alt=""
                loading="lazy"
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover transition duration-300 ${
                  selected
                    ? "scale-105 brightness-100"
                    : "brightness-[0.55] group-hover:brightness-75"
                }`}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2.5 pt-8">
                <p className="text-xs font-semibold leading-tight text-white">
                  {scene.label}
                </p>
                <p className="mt-0.5 truncate text-[10px] leading-tight text-neutral-400">
                  {scene.tagline}
                </p>
              </div>

              {selected && (
                <span
                  aria-hidden
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-ink"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
