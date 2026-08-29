"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { TemplateView, VariantView } from "@/lib/templates";

/**
 * Écran de choix d'un gabarit à variantes, intercalé avant l'import.
 *
 * Structure relevée sur le produit de référence le 28/08 en lisant son DOM :
 * l'aperçu est contenu (pas plein cadre) et centré dans l'espace restant,
 * la liste est faite de boutons plats — pas de puce ronde à cocher séparée
 * du texte — et le bouton final porte une flèche longue, pas un chevron.
 *
 * La variante cochée au chargement diffère par gabarit : ni toujours la
 * première, ni toujours la dernière sur le modèle. `defaultVariantSlug` le
 * précise explicitement plutôt que de deviner une règle.
 */
export default function TemplateVariantPicker({
  template,
  variants,
  question,
  defaultVariantSlug,
}: {
  template: TemplateView;
  variants: VariantView[];
  question: string;
  defaultVariantSlug: string;
}) {
  const [selected, setSelected] = useState(defaultVariantSlug);

  const active = variants.find((v) => v.slug === selected);
  const preview = active?.choiceImage ?? active?.exampleImage ?? template.exampleImage;
  const tips = active?.tips ?? template.tips;

  return (
    <div className="flex min-h-dvh flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+76px)]">
      {/* Aperçu contenu, pas plein cadre : sur le modèle, cette image garde
          ses propres proportions au lieu d'être recadrée en objet-cover. */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        <Image
          src={preview}
          alt={`Result — ${template.label}`}
          width={800}
          height={978}
          sizes="(max-width: 460px) 92vw, 420px"
          className="max-h-[60dvh] w-auto rounded-3xl object-contain"
        />
      </div>

      <div className="shrink-0 pt-5">
        <p className="text-[22px] font-semibold leading-tight text-white">
          {question}
        </p>

        {tips.length > 0 && (
          <p className="mb-4 mt-2 text-[14px] font-medium leading-snug text-[#cccccc]">
            {tips.map((tip, index) => (
              <span key={tip}>
                {index > 0 && (
                  <span
                    aria-hidden
                    className="mx-2 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle"
                  />
                )}
                {tip}
              </span>
            ))}
          </p>
        )}

        <div role="radiogroup" aria-label={question} className="flex flex-col gap-2">
          {variants.map((variant) => {
            const isSelected = variant.slug === selected;
            return (
              <button
                key={variant.slug}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(variant.slug)}
                className={`flex h-14 w-full items-center gap-3 rounded-3xl px-[17px] text-left text-[17px] font-medium transition-colors duration-200 active:opacity-70 ${
                  isSelected
                    ? "border-[1.5px] border-primary bg-[#12233a] text-white"
                    : "border-[1.5px] border-white/15 bg-[#161616] text-white"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                    isSelected ? "border-primary" : "border-white/30"
                  }`}
                >
                  {isSelected && (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  )}
                </span>
                {variant.label}
              </button>
            );
          })}
        </div>

        <Link
          href={`/templates/${template.slug}/${selected}`}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-[17px] font-semibold text-white transition active:opacity-90"
        >
          Continue
          <svg
            aria-hidden
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h13" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
