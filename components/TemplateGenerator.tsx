"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RevealBurst, SparkleFrame } from "@/components/MagicSparkles";
import ResultActions from "@/components/ResultActions";
import { IMAGE_GENERATION_COST } from "@/lib/generation-cost";
import { playRevealChime, unlockAudioContext } from "@/lib/reveal-chime";
import { createClient } from "@/lib/supabase/client";
import {
  prepareAndUpload,
  prepareImage,
  validateImageFile,
  type PreparedImage,
} from "@/lib/studio-image";
import type { TemplateView, VariantView } from "@/lib/templates";

/**
 * Écran d'import d'un gabarit, dernier niveau du parcours.
 *
 * Structure relevée sur le produit de référence le 27/08 en lisant son DOM :
 * l'image tient au ratio 9/11 en haut de l'écran, rien n'est écrit dessus.
 * Titre, consignes, tuile d'import et bouton vivent dans un bloc séparé plus
 * bas, sur le fond noir de la page. Il n'y a pas de champ de description : le
 * prompt appartient au gabarit — ou à la variante choisie à l'écran
 * précédent — et n'est jamais montré. Ne pas l'exposer, même en placeholder
 * ou en attribut.
 */

/** Durée typique observée d'une génération, pour calibrer la progression. */
const IMAGE_EXPECTED_SECONDS = 30;

/**
 * Durée du chargement simulé du paywall, calée sur `app/page.tsx` : un
 * visiteur non abonné parcourt tout le flux mais n'obtient qu'un aperçu
 * verrouillé, sans qu'aucun appel fournisseur ait lieu.
 */
const PAYWALL_PREVIEW_DELAY_MS = 6_000;

const GENERATION_LOADING_MESSAGES = [
  "Analyzing the light…",
  "Adjusting the reflections…",
  "Adding the finishing touches…",
  "Finalizing the render…",
];

/**
 * Rythme du fondu avant/après en boucle : le résultat reste visible le plus
 * longtemps (c'est lui qui vend le gabarit), la photo d'origine n'apparaît
 * que brièvement pour donner le contexte.
 *
 * Le modèle anime cette transition via un dégradé de pixels sur canvas,
 * relevé mais non repris ici — un fondu croisé simple en approche l'effet
 * sans reconstituer un algorithme tiré d'un bundle minifié.
 */
const REVEAL_HOLD_AFTER_MS = 2_600;
const REVEAL_HOLD_BEFORE_MS = 1_400;
const REVEAL_FADE_MS = 700;

/** Boucle un fondu 0↔1 entre les deux temps ci-dessus ; désactivée si `active` est faux. */
function useBeforeAfterLoop(active: boolean): number {
  const [showBefore, setShowBefore] = useState(false);

  useEffect(() => {
    if (!active) {
      setShowBefore(false);
      return;
    }
    const timer = setTimeout(
      () => setShowBefore((v) => !v),
      showBefore ? REVEAL_HOLD_BEFORE_MS : REVEAL_HOLD_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [active, showBefore]);

  return showBefore ? 1 : 0;
}

export default function TemplateGenerator({
  template,
  variant,
}: {
  template: TemplateView;
  variant?: VariantView;
}) {
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [paywalled, setPaywalled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Seul un compte connecté ET porteur d'un palier peut générer. */
  const isSubscribed = isLoggedIn && !!planId;
  const hasRedSnap = planId === "essentiel" || planId === "ultimate";

  const exampleImage = variant?.exampleImage ?? template.exampleImage;
  const beforeImage = variant?.beforeImage ?? template.beforeImage;
  const tips = variant?.tips ?? template.tips;
  const showIdle = !result && !loading && !paywalled;
  const beforeOpacity = useBeforeAfterLoop(showIdle && !!beforeImage);

  const refreshSession = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
    if (!user) {
      setPlanId(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    setPlanId((data?.plan as string | null) ?? null);
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const isMobileUserAgent = /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent,
    );
    setCanShare(isMobileUserAgent && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!loading) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
      setLoadingMessageIndex(
        (i) => (i + 1) % GENERATION_LOADING_MESSAGES.length,
      );
    }, 1_000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (result) playRevealChime();
  }, [result]);

  const progressPercent = Math.min(
    92,
    Math.round(
      100 * (1 - Math.exp((-2 * elapsedSeconds) / IMAGE_EXPECTED_SECONDS)),
    ),
  );

  /**
   * Hébergement lancé dès la sélection, pendant que le client lit les
   * consignes : autant de secondes retirées de l'attente perçue. Un échec est
   * retiré du cache pour qu'un réessai reparte de zéro.
   */
  const uploadCacheRef = useRef(new Map<string, Promise<string>>());

  const ensureUploaded = useCallback((image: PreparedImage) => {
    const cached = uploadCacheRef.current.get(image.previewUrl);
    if (cached) return cached;
    const pending = prepareAndUpload(image);
    pending.catch(() => uploadCacheRef.current.delete(image.previewUrl));
    uploadCacheRef.current.set(image.previewUrl, pending);
    return pending;
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setResult("");
      setPaywalled(false);
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      try {
        const img = await prepareImage(file);
        setPrepared(img);
        // Uniquement pour un abonné : le paywall garantit qu'aucune photo
        // d'un visiteur non abonné ne quitte son navigateur. Ne pas lever
        // cette condition.
        if (isSubscribed) void ensureUploaded(img);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to prepare the image.",
        );
      }
    },
    [isSubscribed, ensureUploaded],
  );

  const reset = useCallback(() => {
    setPrepared(null);
    setResult("");
    setError("");
    setPaywalled(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const generate = useCallback(async () => {
    // Amorce l'AudioContext dans le geste utilisateur pour iOS Safari.
    unlockAudioContext();
    if (!prepared) {
      setError("Please upload a photo first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");

    // Le retour est placé ici, avant tout upload et tout appel fournisseur :
    // rien n'est envoyé, rien n'est facturé.
    if (!isSubscribed) {
      setPaywalled(false);
      await new Promise((r) => setTimeout(r, PAYWALL_PREVIEW_DELAY_MS));
      setLoading(false);
      setPaywalled(true);
      return;
    }

    try {
      const sourceImageUrl = await ensureUploaded(prepared);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrl,
          // Identifiants seulement : le prompt est résolu côté serveur, il
          // ne transite jamais par le navigateur.
          templateSlug: template.slug,
          variantSlug: variant?.slug,
          label: variant
            ? `${template.label} — ${variant.label}`
            : template.label,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Generation failed. Please try again.");
        return;
      }
      if (data?.imageUrl) {
        setResult(data.imageUrl);
      } else {
        setError("Unexpected response from the server. Please try again.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Network error during generation. Check your connection.",
      );
    } finally {
      setLoading(false);
    }
  }, [prepared, isSubscribed, ensureUploaded, template.slug, template.label, variant]);

  return (
    // min-h plutôt que h-fixe avec overflow masqué : sur un petit écran ou un
    // gabarit aux consignes longues, un contenu qui dépasse doit rester
    // atteignable en défilant, jamais coupé sous le bouton Generate.
    <div className="flex min-h-[calc(100dvh-68px)] flex-col px-4">
      {/* Image au ratio 9/11, arrondie en haut seulement — c'est ainsi que le
          modèle la cadre, sans rien écrit dessus. `-mx-4` neutralise le
          `px-4` du conteneur pour qu'elle borde l'écran de part en part. */}
      <div className="relative -mx-4 shrink-0">
        <div className="relative aspect-[9/11] overflow-hidden rounded-t-3xl bg-black">
          {result ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result}
                alt={`Your ${template.label} result`}
                className="animate-magic-reveal absolute inset-0 h-full w-full object-cover"
              />
              <RevealBurst />
            </>
          ) : (
            <>
              <Image
                src={exampleImage}
                alt={`Result — ${template.label}`}
                fill
                priority
                sizes="100vw"
                className={`object-cover ${paywalled ? "scale-105 blur-xl" : ""}`}
              />
              {beforeImage && (
                <Image
                  src={beforeImage}
                  alt=""
                  aria-hidden
                  fill
                  sizes="100vw"
                  className="pointer-events-none absolute inset-0 object-cover transition-opacity ease-in-out"
                  style={{
                    opacity: beforeOpacity,
                    transitionDuration: `${REVEAL_FADE_MS}ms`,
                  }}
                />
              )}
            </>
          )}

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
              <SparkleFrame />
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <p className="text-[15px] text-white/70">
                {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
              </p>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[12px] tabular-nums text-white/40">
                {elapsedSeconds}s
              </p>
            </div>
          )}

          {paywalled && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 px-8 text-center">
              <p className="text-[19px] font-semibold text-white">
                Your scene is ready
              </p>
              <p className="text-[15px] leading-[1.5] text-white/70">
                Subscribe to unlock it and generate as many as you like.
              </p>
              <Link
                href="/pricing"
                className="mt-1 flex h-12 items-center justify-center rounded-3xl bg-primary px-6 text-[16px] font-semibold text-white transition active:opacity-90"
              >
                See the plans
              </Link>
            </div>
          )}
        </div>

        {/* Fond de l'image dans le noir de la page, plutôt qu'une coupure
            nette : reprend le dégradé exact du modèle. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-2 h-[43%]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.30) 42%, rgba(0,0,0,0.75) 63%, #000 80%, #000 100%)",
          }}
        />
      </div>

      {/* Zone noire entre l'image et le bloc du bas : sur le modèle ce bloc
          est position:fixed, indépendant de la hauteur de l'image. Le flex-1
          obtient le même rendu sans figer la position au viewport. */}
      <div
        className="min-h-0 flex-1"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <p role="alert" className="pb-2 text-center text-[14px] text-red-400">
          {error}
        </p>
      )}

      <div className="shrink-0 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        {result ? (
          <ResultActions
            resultUrl={result}
            hasRedSnap={hasRedSnap}
            canShare={canShare}
            onReset={reset}
            onError={setError}
          />
        ) : (
          <>
            <p className="text-[22px] font-semibold leading-tight text-white">
              Import a photo
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

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Réinitialiser la valeur permet de re-sélectionner le même
                // fichier : sinon onChange ne se déclenche jamais.
                e.target.value = "";
                if (file) void handleFile(file);
              }}
            />

            <div className="flex justify-start">
              {prepared ? (
                <div className="relative aspect-[9/11] w-[24%] overflow-hidden rounded-2xl bg-[#111111]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prepared.previewUrl}
                    alt="The photo you uploaded"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={reset}
                    aria-label="Remove the photo"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition active:opacity-70"
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="h-3 w-3"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  aria-label="Choose a photo"
                  className="relative aspect-[9/11] w-[24%] overflow-hidden rounded-2xl bg-[#111111]"
                >
                  <svg
                    aria-hidden
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  >
                    <rect
                      x="0"
                      y="0"
                      width="100%"
                      height="100%"
                      rx="16"
                      ry="16"
                      fill="none"
                      stroke={isDragging ? "#4da8ff" : "#0285fe"}
                      strokeWidth="3"
                      strokeDasharray="8 5"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-primary">
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-7 w-7"
                    >
                      <path d="M16 5h6" />
                      <path d="M19 2v6" />
                      <path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      <circle cx="9" cy="9" r="2" />
                    </svg>
                  </span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={!prepared || loading}
              className="mt-3 flex h-14 w-full items-center justify-center gap-2.5 rounded-3xl bg-primary text-[17px] font-semibold text-white transition active:opacity-90 disabled:opacity-60"
            >
              Generate
              <span className="flex items-center gap-1 text-[17px] font-bold tabular-nums">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                </svg>
                {IMAGE_GENERATION_COST}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
