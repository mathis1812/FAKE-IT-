"use client";

import { useEffect } from "react";
import ResultActions from "@/components/ResultActions";

/**
 * Vue plein écran d'un rendu, ouverte en touchant l'image.
 *
 * Deux raisons d'exister, toutes deux invisibles tant qu'on ne regarde pas
 * un vrai rendu à l'écran. La vignette du gabarit est un cadre `aspect-[9/11]`
 * en `object-cover` : un rendu qui sort en ~4:3 y perd ses côtés. Et le
 * dégradé qui fond l'exemple dans le noir de la page en couvrait la moitié
 * basse. Ici l'image est en `object-contain` sur fond noir — entière, jamais
 * rognée, rien par-dessus.
 *
 * Les actions viennent de `ResultActions`, celui-là même que la vignette
 * utilise. Un jeu de boutons propre au visualiseur finirait par diverger du
 * premier — un bouton ajouté d'un côté et pas de l'autre.
 */
export default function ResultViewer({
  resultUrl,
  alt,
  hasRedSnap,
  canShare,
  onReset,
  onError,
  onEdited,
  editLabel,
  onClose,
}: {
  resultUrl: string;
  alt: string;
  hasRedSnap: boolean;
  canShare: boolean;
  onReset: () => void;
  onError: (message: string) => void;
  onEdited?: (imageUrl: string) => void;
  editLabel?: string;
  onClose: () => void;
}) {
  // Échap ferme, comme toute vue modale. Sans ça, au clavier, la seule
  // sortie serait le bouton — et il n'y a rien derrière lui à atteindre.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full size result"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      <div className="flex shrink-0 justify-start px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[22px] leading-none text-white transition active:opacity-70"
        >
          ×
        </button>
      </div>

      {/* min-h-0 : sans lui, l'image d'un flex-1 refuse de se réduire et
          pousse les actions hors de l'écran sur un mobile bas. */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resultUrl}
          alt={alt}
          className="max-h-full max-w-full rounded-2xl object-contain"
        />
      </div>

      <div className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <ResultActions
          resultUrl={resultUrl}
          hasRedSnap={hasRedSnap}
          canShare={canShare}
          onReset={() => {
            onClose();
            onReset();
          }}
          onError={onError}
          onEdited={onEdited}
          editLabel={editLabel}
        />
      </div>
    </div>
  );
}
