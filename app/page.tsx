"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SparkleFrame, RevealBurst } from "@/components/MagicSparkles";
import { playRevealChime, unlockAudioContext } from "@/lib/reveal-chime";
import ResultActions from "@/components/ResultActions";
import AccountSheet from "@/components/AccountSheet";
import MenuSheet from "@/components/MenuSheet";
import {
  asPlanId,
  hasRedSnap as planHasRedSnap,
  IMAGE_QUALITIES,
  isQualityOpen,
  isVideoOpen,
  maxQualityFor,
  photoCost,
  QUALITY_LABEL,
  type ImageQuality,
} from "@/lib/generation-tiers";
import RechargeSheet from "@/components/RechargeSheet";
import TemplateShelf from "@/components/TemplateShelf";
import { createClient } from "@/lib/supabase/client";
import {
  prepareAndUpload,
  prepareImage,
  validateImageFile,
  type PreparedImage,
} from "@/lib/studio-image";
import { TEMPLATE_CATEGORIES } from "@/lib/templates";

/**
 * Studio — écran central du produit.
 *
 * Une seule photo en entrée, une description libre, un rendu. Les photos de
 * lieu et le mode vidéo ont été retirés le 27/08 : la description devient
 * donc la seule indication de scène, et le champ n'est plus optionnel.
 */

const PROMPT_PLACEHOLDER = "Describe the scene you want…";

/**
 * Durée du chargement simulé du paywall. Calée sur l'ordre de grandeur d'une
 * vraie génération pour que le parcours reste crédible, sans faire attendre
 * un visiteur qui ne verra de toute façon qu'un aperçu verrouillé.
 */
const PAYWALL_PREVIEW_DELAY_MS = 6_000;

/** Visuel d'exemple affiché flouté derrière le paywall. */
const PAYWALL_PREVIEW_IMAGE = "/landing/rooftop.jpg";

/** Durée typique observée d'une génération, pour calibrer la progression. */
const IMAGE_EXPECTED_SECONDS = 30;

const GENERATION_LOADING_MESSAGES = [
  "Analyzing the light…",
  "Adjusting the reflections…",
  "Adding the finishing touches…",
  "Finalizing the render…",
];

/**
 * Progression purement perçue, sans lien avec l'état réel côté Gemini :
 * grimpe vite au début puis ralentit et plafonne à 92%, pour ne jamais
 * laisser croire que c'est fini avant que ça le soit vraiment.
 */
function useElapsedProgress(active: boolean, expectedSeconds: number) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1_000);
    return () => clearInterval(interval);
  }, [active]);

  const progressPercent = Math.min(
    92,
    Math.round(100 * (1 - Math.exp((-2 * elapsedSeconds) / expectedSeconds))),
  );

  return { elapsedSeconds, progressPercent };
}

export default function Home() {
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [userNote, setUserNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  /** Initiale affichée dans la pastille de compte, tirée de l'e-mail. */
  const [accountInitial, setAccountInitial] = useState("?");
  const [userEmail, setUserEmail] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shelfRef = useRef<HTMLDivElement>(null);

  /**
   * Paywall : un visiteur non connecté, ou connecté sans abonnement,
   * parcourt tout le flux mais n'obtient qu'un aperçu verrouillé. Aucun
   * appel au modèle n'est déclenché, donc rien n'est facturé, et rien de
   * générable ne transite vers le navigateur.
   */
  const [paywalled, setPaywalled] = useState(false);

  /** Menu principal, en feuille remontant du bas. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);

  /**
   * Qualité d'image choisie. Elle démarre à la meilleure ouverte au palier
   * (Pro par défaut en 2K sur le modèle) et se recale dès que le palier est
   * connu — un visiteur non abonné reste sur 1K, seul cran non verrouillé.
   */
  const [quality, setQuality] = useState<ImageQuality>("normal");
  /**
   * La barre active fait apparaître les outils (mode + résolution) à la
   * place du bouton Templates : sur le modèle les deux ne coexistent jamais,
   * ce qui évite de faire déborder la rangée sur un écran étroit.
   */
  const [barFocused, setBarFocused] = useState(false);

  /** Seul un compte connecté ET porteur d'un palier peut générer. */
  const isSubscribed = isLoggedIn && !!planId;
  const plan = asPlanId(planId);
  /**
   * Red Snap réservé aux paliers Pro et Max — voir lib/generation-tiers.ts.
   * Un pack de crédits à l'unité n'y donne pas accès : ce n'est pas un palier.
   */
  const hasRedSnap = planHasRedSnap(plan);
  const videoOpen = isVideoOpen(plan);

  const { elapsedSeconds, progressPercent } = useElapsedProgress(
    loading,
    IMAGE_EXPECTED_SECONDS,
  );

  const refreshCredits = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
    if (!user) {
      setCredits(null);
      setAccountInitial("?");
      setUserEmail("");
      return;
    }
    setAccountInitial((user.email?.trim().charAt(0) || "?").toUpperCase());
    setUserEmail(user.email ?? "");
    const { data } = await supabase
      .from("profiles")
      .select("credits, plan")
      .eq("id", user.id)
      .single();
    setCredits(data?.credits ?? 0);
    setPlanId((data?.plan as string | null) ?? null);
  }, []);

  useEffect(() => {
    void refreshCredits();
  }, [refreshCredits]);

  // Au chargement du palier, cale la qualité sur son maximum — le client
  // veut le meilleur qu'il paie (Pro démarre en 2K sur le modèle). L'effet
  // ne se redéclenche qu'au vrai changement de palier (chaîne stable), donc
  // un choix manuel plus bas n'est pas écrasé à chaque rendu.
  useEffect(() => {
    setQuality(maxQualityFor(plan));
  }, [plan]);

  useEffect(() => {
    const isMobileUserAgent = /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent,
    );
    setCanShare(isMobileUserAgent && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex(
        (i) => (i + 1) % GENERATION_LOADING_MESSAGES.length,
      );
    }, 2_600);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (result) playRevealChime();
  }, [result]);

  /**
   * Hébergement lancé dès la sélection, pendant que le client rédige sa
   * description : autant de secondes retirées de l'attente perçue. Un échec
   * est retiré du cache pour qu'un réessai reparte de zéro.
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

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Réinitialiser la valeur permet de re-sélectionner le même fichier :
      // sinon l'input ne change pas et onChange ne se déclenche jamais.
      e.target.value = "";
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const generate = useCallback(async () => {
    // Amorce l'AudioContext dans le geste utilisateur pour iOS Safari.
    unlockAudioContext();
    if (!prepared) {
      setError("Please upload an image first.");
      return;
    }
    // La description est désormais la seule indication de scène : sans
    // elle, le modèle n'a rien sur quoi s'appuyer.
    if (!userNote.trim()) {
      setError("Describe the scene you want.");
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
          prompt: userNote.trim(),
          quality,
          label: "Image generation",
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Generation failed. Please try again.");
        return;
      }
      if (data?.imageUrl) {
        setResult(data.imageUrl);
        void refreshCredits();
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
  }, [prepared, userNote, quality, isSubscribed, ensureUploaded, refreshCredits]);


  const reset = useCallback(() => {
    setPrepared(null);
    setResult("");
    setError("");
    setUserNote("");
    setPaywalled(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const canSubmit = !!prepared && !!userNote.trim() && !loading;
  const hasTemplates = TEMPLATE_CATEGORIES.length > 0;
  /** Outils visibles dès que le champ est actif ou porte du texte. */
  const showTools = barFocused || userNote.trim().length > 0;


  return (
    // pt-16 dégage la hauteur de l'en-tête devenu fixe : sans lui, la carte
    // d'import passerait dessous.
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col pt-16">
      {/* Barre supérieure fixe, posée au-dessus du contenu. Le conteneur ne
          capte pas le pointeur pour ne pas bloquer le défilement sous lui :
          seuls les boutons le réactivent. */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open the menu"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className="pointer-events-auto flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#2d2d2d] bg-[#161616] text-white transition active:opacity-80"
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
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Your account"
            aria-haspopup="dialog"
            aria-expanded={accountOpen}
            className="pointer-events-auto flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#2d2d2d] bg-[#161616] text-[15px] font-semibold text-white transition active:opacity-80"
          >
            {accountInitial}
          </button>
        </div>

        <Link
          href="/landing"
          className="pointer-events-auto absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[1.8rem] font-bold tracking-tight text-white transition active:opacity-70"
        >
          Bluminoo
        </Link>

        {credits !== null && (
          <button
            type="button"
            onClick={() => setRechargeOpen(true)}
            aria-label={`${credits} credits — see the plans`}
            aria-haspopup="dialog"
            className="pointer-events-auto flex h-[42px] w-[92px] shrink-0 items-center justify-center gap-1 rounded-full border border-[#2d2d2d] bg-[#161616] text-white transition active:opacity-80"
          >
            <svg
              width="16"
              height="16"
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
            {/* tabular-nums : sans lui, la pastille se décale à chaque
                changement de crédits, les chiffres n'ayant pas la même
                largeur dans Geist. */}
            <span className="text-[15px] font-semibold tabular-nums">
              {credits.toLocaleString("en-US")}
            </span>
          </button>
        )}
      </header>

      {/* Zone centrale : import, chargement, aperçu verrouillé ou résultat. */}
      <div className="flex flex-1 items-start justify-center">
        <div className="w-full max-w-[532px]">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-[#111111]"
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

            {result ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result}
                  alt="Your generated scene"
                  className="animate-magic-reveal h-full w-full object-cover"
                />
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

          {error && (
            <p
              role="alert"
              className="mt-4 text-center text-[14px] text-red-400"
            >
              {error}
            </p>
          )}

          {result && (
            <ResultActions
              resultUrl={result}
              hasRedSnap={hasRedSnap}
              canShare={canShare}
              onReset={reset}
              onError={setError}
            />
          )}
        </div>
      </div>

      {/* Barre du bas, deux états comme le modèle :
          - replié (champ vide et sans focus) : le bouton Templates est un
            pavé séparé à gauche, le champ est court, sa flèche seule au
            centre-droit ;
          - déplié (focus ou texte) : Templates s'efface, le champ occupe
            toute la largeur et grandit, la rangée d'outils (mode +
            résolution) apparaît en bas à gauche, le coût rejoint la flèche.
          Le textarea est le MÊME élément dans les deux états (seules ses
          classes changent) : le remonter ferait perdre le focus au moment
          où le clic déclenche justement la bascule. */}
      <div className="sticky bottom-0 mt-6 flex items-end gap-2 pb-2">
        {/* Templates : masqué (pas démonté) quand les outils sont là — un
            sibling caché ne remonte pas le textarea. */}
        <button
          type="button"
          onClick={() =>
            shelfRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            })
          }
          disabled={!hasTemplates}
          title={hasTemplates ? undefined : "Templates are coming soon"}
          className={`h-16 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-primary px-5 text-[15px] font-semibold text-white transition active:opacity-70 disabled:opacity-40 ${
            showTools ? "hidden" : "flex"
          }`}
        >
          Templates
        </button>

        <div className="relative flex-1">
          <textarea
            rows={1}
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            onFocus={() => setBarFocused(true)}
            onBlur={() => setBarFocused(false)}
            placeholder={PROMPT_PLACEHOLDER}
            aria-label="Describe the scene you want"
            className={`relative z-10 block w-full resize-none overflow-hidden rounded-3xl bg-white/[0.07] px-5 text-[17px] font-medium leading-6 text-white caret-white outline-none placeholder:text-white/35 ${
              showTools
                ? "min-h-[112px] pb-16 pt-[18px]"
                : "min-h-16 pb-[19px] pr-16 pt-[18px]"
            }`}
          />

          {/* État replié : la flèche seule, centrée à droite, sans coût. */}
          {!showTools && (
            <button
              type="button"
              onClick={generate}
              disabled={!canSubmit}
              aria-label={`Generate for ${photoCost(quality)} credits`}
              className="absolute right-1.5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-[#333333] p-1.5 transition active:opacity-70 disabled:opacity-60"
            >
              <span className="flex h-full w-full items-center justify-center rounded-full bg-white/15 text-white">
                <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5m-7 7 7-7 7 7" />
                </svg>
              </span>
            </button>
          )}

          {/* État déplié : rangée d'outils épinglée en bas. pointer-events-none
              sur le conteneur pour ne pas voler le focus au textarea ;
              onMouseDown preventDefault pour qu'un clic sur un outil ne le
              fasse pas perdre le focus (sinon la rangée se replierait avant
              le clic). Chaque enfant réactive le pointeur. */}
          {showTools && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              className="animate-tools-in pointer-events-none absolute inset-x-[6.5px] bottom-[6.5px] z-20 flex items-center gap-1.5 [&>*]:pointer-events-auto"
            >
              {/* Mode + résolution dans un conteneur défilable : sur un écran
                  large tout tient, sur mobile ils glissent horizontalement
                  (sans ascenseur visible) plutôt que de pousser le bouton
                  d'envoi hors champ. min-w-0 autorise ce conteneur à passer
                  sous la largeur de son contenu, condition du défilement. */}
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* Mode : Photo actif, Vidéo présent mais verrouillé — le
                  moteur image→vidéo n'est pas encore branché. */}
              <div className="flex h-12 shrink-0 items-center rounded-full bg-[#333333] p-1">
                <span className="flex h-10 items-center justify-center rounded-full bg-primary px-4 text-[14px] font-semibold text-white">
                  Photo
                </span>
                <button
                  type="button"
                  disabled
                  title="Video is coming soon"
                  aria-label="Video (coming soon)"
                  className="flex h-10 items-center justify-center gap-1 rounded-full px-3 text-[14px] font-semibold text-white/40"
                >
                  Video
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect width="14" height="10" x="5" y="11" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0" />
                  </svg>
                </button>
              </div>

              {/* Résolution : segmenté inline 1K/2K/4K, comme le modèle. Le
                  cran choisi est plein bleu ; ceux au-dessus du palier sont
                  grisés avec un cadenas et désactivés ; 1K reste ouvert à
                  tous. */}
              <div className="flex h-12 shrink-0 items-center rounded-full bg-[#333333] p-1">
                {IMAGE_QUALITIES.map((q) => {
                  const open = isQualityOpen(q, plan);
                  const active = quality === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      disabled={!open}
                      onClick={() => setQuality(q)}
                      aria-pressed={active}
                      aria-label={`Resolution ${QUALITY_LABEL[q]}${open ? "" : " (locked)"}`}
                      className={`flex h-10 items-center justify-center gap-0.5 rounded-full px-2.5 text-[14px] font-semibold tabular-nums transition-colors ${
                        active
                          ? "bg-primary text-white"
                          : open
                            ? "text-white active:opacity-70"
                            : "text-white/30"
                      }`}
                    >
                      {QUALITY_LABEL[q]}
                      {!open && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect width="18" height="11" x="3" y="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              </div>

              {/* Bouton d'envoi, hors du conteneur défilable : toujours
                  visible, épinglé à droite. Coût (⚡ + nombre) puis le rond de
                  la flèche — deux cercles imbriqués comme sur le modèle. */}
              <button
                type="button"
                onClick={generate}
                disabled={!canSubmit}
                aria-label={`Generate for ${photoCost(quality)} credits`}
                className="flex h-12 shrink-0 items-center gap-1.5 rounded-full bg-[#333333] pl-3.5 pr-1.5 transition active:opacity-70 disabled:opacity-60"
              >
                <span className="flex items-center gap-1 text-[15px] font-bold tabular-nums text-white">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                  </svg>
                  {photoCost(quality)}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white">
                  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5m-7 7 7-7 7 7" />
                  </svg>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={shelfRef}>
        <TemplateShelf />
      </div>

      <MenuSheet
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        credits={credits}
        planId={planId}
      />

      <AccountSheet
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        onOpenRecharge={() => setRechargeOpen(true)}
        email={userEmail}
        planId={planId}
      />

      <RechargeSheet
        isOpen={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
      />
    </div>
  );
}
