"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { SparkleFrame, RevealBurst } from "@/components/MagicSparkles";
import type { GenerationMode } from "@/lib/generation-tiers";
import type { PreparedImage } from "@/lib/studio-image";
import { GENERATION_LOADING_MESSAGES } from "./useElapsedProgress";

/** Visuel d'exemple affiché flouté derrière le paywall. */
const PAYWALL_PREVIEW_IMAGE = "/landing/rooftop.jpg";

/**
 * La carte du studio : l'unique surface qui montre, tour à tour, la zone
 * d'import, la photo choisie, l'attente, l'aperçu verrouillé et le rendu.
 *
 * Un seul composant pour ces cinq états parce qu'ils partagent le même cadre
 * mesuré et s'excluent mutuellement — les répartir entre plusieurs composants
 * ferait porter à l'appelant l'ordre de priorité (rendu avant paywall avant
 * chargement…), qui n'est pas une décision d'écran.
 *
 * `children` est rendu SOUS la carte, dans la même colonne `max-w-[532px]` :
 * c'est là que vivent le message d'erreur et les actions sur un rendu. Les
 * remonter d'un cran leur ferait perdre cette largeur maximale.
 */
export default function StudioCard({
  prepared,
  result,
  resultKind,
  loading,
  paywalled,
  isDragging,
  setIsDragging,
  onDrop,
  onInputChange,
  inputRef,
  onReset,
  onOpenViewer,
  loadingMessageIndex,
  elapsedSeconds,
  progressPercent,
  children,
}: {
  prepared: PreparedImage | null;
  result: string;
  /** Ce que `result` contient — une vidéo ne se rend pas dans une `<img>`. */
  resultKind: GenerationMode;
  loading: boolean;
  paywalled: boolean;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement>;
  onReset: () => void;
  onOpenViewer: () => void;
  loadingMessageIndex: number;
  elapsedSeconds: number;
  progressPercent: number;
  children?: ReactNode;
}) {
  /**
   * Dimensions de la carte, calculées en JS plutôt qu'en CSS pur. En CSS,
   * `aspect-[3/4]` combiné à une hauteur explicite (h-full) ET une largeur
   * maximale (92%) ne se rééquilibre pas : le navigateur garde la hauteur
   * telle quelle et casse juste le ratio quand la largeur est plafonnée,
   * au lieu de recalculer la hauteur pour le préserver. Vérifié : même le
   * modèle résout ça via une variable CSS calculée en JS
   * (--accueil-carte-boite), pas en CSS déclaratif pur.
   */
  const cardWrapRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(
    null,
  );

  useEffect(() => {
    const wrap = cardWrapRef.current;
    if (!wrap) return;
    const compute = () => {
      const availW = wrap.clientWidth;
      const availH = wrap.clientHeight;
      if (!availW || !availH) return;
      // La plus grande boîte au ratio 3:4 qui tient dans l'espace
      // disponible, plafonnée à 92% de la largeur — mêmes deux contraintes
      // que le modèle, juste résolues côté client au lieu d'une variable
      // CSS.
      const capW = availW * 0.92;
      const w = Math.min(capW, availH * (3 / 4));
      const h = w * (4 / 3);
      setCardSize({ w: Math.round(w), h: Math.round(h) });
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  return (
    // Centre la carte à la fois horizontalement ET verticalement dans
    // l'espace restant — pas d'étirement. min-h-0 est nécessaire pour
    // qu'un enfant flex puisse être plus petit que son contenu naturel et
    // se centrer au lieu de déborder.
    <div
      ref={cardWrapRef}
      className="flex min-h-0 flex-1 items-center justify-center"
    >
      <div className="flex h-full min-h-0 w-full max-w-[532px] flex-col items-center justify-center">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          style={
            cardSize ? { width: cardSize.w, height: cardSize.h } : undefined
          }
          className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-[#111111]"
        >
          {/* Liseré en pointillés tracé en SVG plutôt qu'en bordure CSS :
              c'est ainsi qu'il est fait sur le modèle, et cela permet un
              tiret régulier qui suit exactement l'arrondi. Masqué dès
              qu'une image occupe la carte. */}
          {!prepared && !result && !loading && !paywalled && (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <rect
                x="1"
                y="1"
                width="calc(100% - 2px)"
                height="calc(100% - 2px)"
                rx="23"
                fill="none"
                stroke={isDragging ? "#0285fe" : "#333333"}
                strokeWidth="2"
                strokeDasharray="8 5"
              />
            </svg>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onInputChange}
          />

          {result && resultKind === "video" ? (
            <>
              {/* Pas de plein écran ni de zoom sur une vidéo : elle porte ses
                  propres commandes, et un bouton par-dessus les intercepterait.
                  `object-contain` plutôt que `cover` — une vidéo rognée perd
                  son cadrage, et il n'y a pas de vue entière pour compenser. */}
              <video
                src={result}
                controls
                playsInline
                autoPlay
                loop
                className="h-full w-full bg-black object-contain"
              />
              <RevealBurst />
            </>
          ) : result ? (
            <>
              {/* Cliquable : la vignette rogne le rendu, le plein ecran le
                  montre entier. Cf. ResultViewer. */}
              <button
                type="button"
                onClick={onOpenViewer}
                aria-label="View full size"
                className="h-full w-full cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result}
                  alt="Your generated scene"
                  className="animate-magic-reveal h-full w-full object-cover"
                />
              </button>
              <RevealBurst />
            </>
          ) : paywalled ? (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PAYWALL_PREVIEW_IMAGE}
                alt=""
                aria-hidden
                className="h-full w-full scale-105 object-cover blur-xl"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 px-8 text-center">
                <p className="text-[19px] font-semibold text-white">
                  Your scene is ready
                </p>
                <p className="text-[15px] leading-[1.5] text-white/60">
                  Subscribe to unlock it and generate as many as you like.
                </p>
                <Link
                  href="/pricing"
                  className="mt-1 flex h-12 items-center justify-center rounded-3xl bg-primary px-6 text-[16px] font-semibold text-white transition active:opacity-90"
                >
                  See the plans
                </Link>
              </div>
            </div>
          ) : loading ? (
            <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <SparkleFrame />
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <p className="text-[15px] text-white/60">
                {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
              </p>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[12px] tabular-nums text-white/30">
                {elapsedSeconds}s
              </p>
            </div>
          ) : prepared ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prepared.previewUrl}
                alt="The photo you uploaded"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={onReset}
                aria-label="Remove the photo"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition active:opacity-70"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-3 text-white transition active:opacity-70"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-10 w-10"
              >
                <path d="M21 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h6" />
                <path d="M18 2v6M15 5h6" />
                <circle cx="9" cy="9" r="2" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span className="px-4 text-center text-[18px] font-semibold">
                Import a photo
              </span>
            </button>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
