"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playRevealChime, unlockAudioContext } from "@/lib/reveal-chime";
import {
  DEFAULT_VIDEO_DURATION,
  maxQualityFor,
  type GenerationMode,
  type ImageQuality,
  type VideoDuration,
} from "@/lib/generation-tiers";
import type { PlanId } from "@/lib/stripe";
import {
  prepareAndUpload,
  prepareImage,
  validateImageFile,
  type PreparedImage,
} from "@/lib/studio-image";
import {
  GENERATION_LOADING_MESSAGES,
  IMAGE_EXPECTED_SECONDS,
  useElapsedProgress,
} from "./useElapsedProgress";

/**
 * Durée du chargement simulé du paywall. Calée sur l'ordre de grandeur d'une
 * vraie génération pour que le parcours reste crédible, sans faire attendre
 * un visiteur qui ne verra de toute façon qu'un aperçu verrouillé.
 */
const PAYWALL_PREVIEW_DELAY_MS = 6_000;

/**
 * Le cycle complet d'une génération au studio : la photo choisie, la
 * description, la qualité, l'appel au modèle, et les états d'affichage qui en
 * découlent (vide, photo prête, en cours, verrouillé, rendu).
 *
 * Un seul hook parce que ces états sont indissociables : `handleFile` remet
 * `result`, `error` et `paywalled` à zéro, `generate` les repositionne tous,
 * et `reset` les efface ensemble. Les séparer obligerait chaque appelant à
 * connaître l'ordre de ces remises à zéro — c'est exactement ce qui laisse un
 * rendu fantôme affiché sous une nouvelle photo.
 *
 * `components/TemplateGenerator.tsx` mène un cycle voisin pour les gabarits,
 * volontairement distinct : il n'a ni description libre ni choix de qualité, et
 * envoie un `templateSlug`. Les rapprocher demanderait de paramétrer ce qui
 * part au serveur, pas seulement de partager des états.
 */
export function useStudioGeneration({
  isSubscribed,
  plan,
  refreshCredits,
}: {
  isSubscribed: boolean;
  plan: PlanId | null;
  refreshCredits: () => void | Promise<void>;
}) {
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [userNote, setUserNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Paywall : un visiteur non connecté, ou connecté sans abonnement,
   * parcourt tout le flux mais n'obtient qu'un aperçu verrouillé. Aucun
   * appel au modèle n'est déclenché, donc rien n'est facturé, et rien de
   * générable ne transite vers le navigateur.
   */
  const [paywalled, setPaywalled] = useState(false);

  /**
   * Qualité d'image choisie. Elle démarre à la meilleure ouverte au palier
   * (Pro par défaut en 2K sur le modèle) et se recale dès que le palier est
   * connu — un visiteur non abonné reste sur 1K, seul cran non verrouillé.
   */
  const [quality, setQuality] = useState<ImageQuality>("normal");

  /**
   * Photo ou vidéo. Le mode vit ici et pas dans la barre, parce qu'il change
   * la route appelée, le coût débité et la nature du résultat — pas seulement
   * l'apparence des outils.
   */
  const [mode, setMode] = useState<GenerationMode>("photo");
  const [videoDuration, setVideoDuration] =
    useState<VideoDuration>(DEFAULT_VIDEO_DURATION);
  /**
   * Ce que `result` contient. Une vidéo ne se rend pas dans une `<img>`, et
   * elle n'est pas retouchable : sans ce drapeau, la carte afficherait un
   * cadre vide et proposerait un bouton Edit qui échouerait côté serveur.
   */
  const [resultKind, setResultKind] = useState<GenerationMode>("photo");

  const { elapsedSeconds, progressPercent } = useElapsedProgress(
    loading,
    IMAGE_EXPECTED_SECONDS,
  );

  // Au chargement du palier, cale la qualité sur son maximum — le client
  // veut le meilleur qu'il paie (Pro démarre en 2K sur le modèle). L'effet
  // ne se redéclenche qu'au vrai changement de palier (chaîne stable), donc
  // un choix manuel plus bas n'est pas écrasé à chaque rendu.
  useEffect(() => {
    setQuality(maxQualityFor(plan));
  }, [plan]);

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
      const isVideo = mode === "video";

      const res = await fetch(
        isVideo ? "/api/generate-video" : "/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isVideo
              ? {
                  sourceImageUrl,
                  prompt: userNote.trim(),
                  duration: videoDuration,
                  label: "Video generation",
                }
              : {
                  sourceImageUrl,
                  prompt: userNote.trim(),
                  quality,
                  label: "Image generation",
                },
          ),
        },
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Generation failed. Please try again.");
        return;
      }
      // Les deux routes ne renvoient pas la même clé : `imageUrl` pour
      // l'image, `videoUrl` pour la vidéo. `resultKind` est posé AVANT
      // `result`, sinon la carte rendrait brièvement une vidéo dans une
      // `<img>` au rendu qui suit.
      const url = isVideo ? data?.videoUrl : data?.imageUrl;
      if (url) {
        setResultKind(isVideo ? "video" : "photo");
        setResult(url as string);
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
  }, [
    prepared,
    userNote,
    quality,
    mode,
    videoDuration,
    isSubscribed,
    ensureUploaded,
    refreshCredits,
  ]);

  const reset = useCallback(() => {
    setPrepared(null);
    setResult("");
    setError("");
    setUserNote("");
    setPaywalled(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const canSubmit = !!prepared && !!userNote.trim() && !loading;

  return {
    prepared,
    userNote,
    setUserNote,
    loading,
    error,
    setError,
    result,
    setResult,
    paywalled,
    isDragging,
    setIsDragging,
    quality,
    setQuality,
    mode,
    setMode,
    videoDuration,
    setVideoDuration,
    resultKind,
    loadingMessageIndex,
    elapsedSeconds,
    progressPercent,
    inputRef,
    canSubmit,
    handleFile,
    onInputChange,
    onDrop,
    generate,
    reset,
  };
}
