"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { TemplateView, VariantView } from "@/lib/templates";

/**
 * Écran de choix d'un gabarit à variantes, intercalé avant l'import.
 *
 * La variante la plus forte est présélectionnée, comme sur le modèle : c'est
 * celle que le client vient chercher, et il peut toujours redescendre.
 */
export default function TemplateVariantPicker({
  template,
  variants,
  question,
}: {
  template: TemplateView;
  variants: VariantView[];
  question: string;
}) {
  const [selected, setSelected] = useState(
    variants[variants.length - 1]?.slug ?? "",
  );

  const preview =
    variants.find((v) => v.slug === selected)?.exampleImage ??
    template.exampleImage;

  return (
    <div className="flex min-h-[calc(100dvh-68px)] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[420px] overflow-hidden rounded-3xl bg-[#111111]">
        <Image
          src={preview}
          alt={`Example result — ${template.label}`}
          fill
          priority
          sizes="(max-width: 460px) 92vw, 420px"
          className="object-cover"
        />
      </div>

      <h2 className="mt-5 text-[21px] font-semibold text-white">{question}</h2>

      {template.tips.length > 0 && (
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-white/50">
          {template.tips.map((tip, index) => (
            <span key={tip} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden className="text-white/30">
                  •
                </span>
              )}
              {tip}
            </span>
          ))}
        </p>
      )}

      {/* Boutons radio natifs plutôt qu'un groupe piloté au clavier à la
          main : la navigation par flèches et l'annonce du groupe viennent
          gratuitement avec `<input type="radio">`. */}
      <fieldset className="mt-4 space-y-2.5">
        <legend className="sr-only">{question}</legend>
        {variants.map((variant) => {
          const isSelected = variant.slug === selected;
          return (
            <label
              key={variant.slug}
              className={`flex h-[56px] cursor-pointer items-center gap-3 rounded-full border px-5 transition ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-[#2d2d2d] bg-[#161616]"
              }`}
            >
              <input
                type="radio"
                name="variant"
                value={variant.slug}
                checked={isSelected}
                onChange={() => setSelected(variant.slug)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? "border-primary" : "border-[#4f4f4f]"
                }`}
              >
                {isSelected && (
                  <span className="h-[9px] w-[9px] rounded-full bg-primary" />
                )}
              </span>
              <span className="text-[16px] font-medium text-white">
                {variant.label}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-5">
        <Link
          href={`/templates/${template.slug}/${selected}`}
          className="flex h-[60px] w-full items-center justify-center gap-1.5 rounded-full bg-primary text-[17px] font-semibold text-white transition active:opacity-90"
        >
          Continue
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
