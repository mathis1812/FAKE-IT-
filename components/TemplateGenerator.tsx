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
import type { Template } from "@/lib/templates";

/**
 * Parcours de génération d'une page de gabarit.
 *
 * Différence unique mais structurante avec le studio : il n'y a pas de champ
 * de description. Le prompt appartient au gabarit et n'est jamais montré —
 * c'est ce que le client achète en choisissant un univers plutôt qu'en
 * rédigeant. Ne pas l'exposer, même en placeholder ou en title.
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

export default function TemplateGenerator({ template }: { template: Template }) {
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
   * consignes de cadrage : autant de secondes retirées de l'attente perçue.
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
        // d'un visiteur non abonné ne quitte son navigateur.
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
          prompt: template.prompt,
          label: `Template — ${template.label}`,
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
  }, [prepared, isSubscribed, ensureUploaded, template.prompt, template.label]);

  return (
    <div className="mx-auto w-full max-w-[532px]">
      {/* Exemple avant/après : montrer le rendu attendu est ce qui remplace
          la description absente. */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { src: template.beforeImage, caption: "Before" },
          { src: template.afterImage, caption: "After" },
        ].map(({ src, caption }) => (
          <div
            key={caption}
            className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[#1c1c1c]"
          >
            <Image
              src={src}
              alt={`${template.label} — ${caption.toLowerCase()}`}
              fill
              sizes="(max-width: 560px) 46vw, 260px"
              className="object-cover"
            />
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-sm">
              {caption}
            </span>
          </div>
        ))}
      </div>

      <div
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
        className="relative mt-4 aspect-[3/4] w-full overflow-hidden rounded-3xl bg-[#111111]"
      >
        {/* Liseré en pointillés tracé en SVG, comme sur le studio : bordure
            CSS et arrondi ne donnent pas le même tiret. */}
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
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Réinitialiser la valeur permet de re-sélectionner le même
            // fichier : sinon onChange ne se déclenche jamais.
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />

        {result ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result}
              alt={`Your ${template.label} scene`}
              className="animate-magic-reveal h-full w-full object-cover"
            />
            <RevealBurst />
          </>
        ) : paywalled ? (
          <div className="relative h-full w-full">
            <Image
              src={template.afterImage}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 560px) 92vw, 532px"
              className="scale-105 object-cover blur-xl"
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
              onClick={reset}
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

      {template.tips.length > 0 && !result && (
        <ul className="mt-4 space-y-1.5 px-1">
          {template.tips.map((tip) => (
            <li
              key={tip}
              className="flex gap-2 text-[14px] leading-[1.5] text-white/50"
            >
              <span aria-hidden className="text-white/25">
                •
              </span>
              {tip}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-4 text-center text-[14px] text-red-400">
          {error}
        </p>
      )}

      {result ? (
        <ResultActions
          resultUrl={result}
          hasRedSnap={hasRedSnap}
          canShare={canShare}
          onReset={reset}
          onError={setError}
        />
      ) : (
        <button
          type="button"
          onClick={generate}
          disabled={!prepared || loading}
          className="mt-5 flex h-[60px] w-full items-center justify-center gap-2 rounded-full bg-primary text-[17px] font-semibold text-white transition active:opacity-90 disabled:opacity-40"
        >
          Generate
          {/* Le coût est annoncé sur le bouton lui-même : le client sait ce
              qu'il dépense au moment où il le dépense. */}
          <span className="flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-1 text-[14px] font-semibold tabular-nums">
            <svg
              width="13"
              height="13"
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
      )}
    </div>
  );
}
