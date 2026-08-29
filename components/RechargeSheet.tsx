"use client";

import { useEffect } from "react";
import PricingCatalogue from "@/components/PricingCatalogue";

/**
 * Feuille « Recharger », ouverte depuis la pastille de crédits du studio et
 * depuis « Subscription & packs » dans AccountSheet — les deux points
 * d'entrée relevés sur le modèle mènent à la même feuille.
 *
 * Contrairement à AuthSheet, pas d'image d'illustration en tête (le modèle
 * en a une propre à son produit — booster.webp — sans équivalent Bluminoo à
 * ce jour) : juste la poignée et le bouton de fermeture, sur le même fond
 * noir plein écran que MenuSheet et AccountSheet.
 */
export default function RechargeSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-md"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recharge"
        className="animate-sheet-up absolute inset-x-0 bottom-0 top-0 flex flex-col overflow-hidden rounded-t-[47px] bg-black pb-[max(8px,calc(env(safe-area-inset-bottom)-14px))] pt-[calc(env(safe-area-inset-top)+20px)]"
      >
        <span
          aria-hidden
          className="mx-auto h-1.5 w-9 shrink-0 rounded-full bg-white/30"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-6 top-[calc(env(safe-area-inset-top)+16px)] flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/20 text-white backdrop-blur-md transition active:opacity-70"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-[18px] w-[18px]"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
          <PricingCatalogue />
        </div>
      </div>
    </div>
  );
}
