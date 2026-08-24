"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import { SparkleFrame, RevealBurst } from "@/components/MagicSparkles";
import { playRevealChime, unlockAudioContext } from "@/lib/reveal-chime";
import { createClient } from "@/lib/supabase/client";
import {
  prepareShareFile,
  sendAsRedSnap as sendAsRedSnapFn,
  SNAP_UPLOAD_LENS_URL,
} from "@/lib/share-utils";

type Mode = "image" | "video";

// Le rôle de la note change selon qu'une photo de lieu est fournie ou non :
// simple précision qui affine le prompt généré par l'analyse vision, ou
// seule description de la scène. Le placeholder suit ce basculement, sans
// quoi il annoncerait « optionnelle » un champ devenu obligatoire.
const IMAGE_NOTE_PLACEHOLDER_WITH_PLACE =
  "Optional note (e.g. sitting at the table by the window, evening vibe)…";
const IMAGE_NOTE_PLACEHOLDER_WITHOUT_PLACE =
  "Describe the scene you want (e.g. on the terrace of a Parisian café, late afternoon light)…";

const MAX_PLACE_IMAGES = 3;

/**
 * Durée du chargement simulé du paywall. Calée sur l'ordre de grandeur d'une
 * vraie génération pour que le parcours reste crédible, sans faire attendre
 * un visiteur qui ne verra de toute façon qu'un aperçu verrouillé.
 */
const PAYWALL_PREVIEW_DELAY_MS = 6_000;

/** Visuel d'exemple affiché flouté derrière le paywall. */
const PAYWALL_PREVIEW_IMAGE = "/landing/rooftop.jpg";

const VIDEO_PROMPT_PLACEHOLDER =
  "E.g. Replace the watch on the wrist with a steel Rolex Submariner, natural movements, keep the face, pose, and background…";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_FILE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_SOURCE_BYTES = 50 * 1024 * 1024;
// Contraintes imposées par le modèle Kling O1 sur fal.ai.
const MIN_VIDEO_WIDTH = 720;
const MAX_VIDEO_WIDTH = 2160;
const MIN_VIDEO_DURATION_S = 3;
const MAX_VIDEO_DURATION_S = 10;
const COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1536;
const JPEG_QUALITY = 0.9;
// SNAP_SHARE_MAX_DIMENSION, SNAP_SHARE_JPEG_QUALITY, SNAP_UPLOAD_LENS_URL and
// prepareShareFile are now imported from @/lib/share-utils.

// Légende lifestyle glissée dans le partage (best-effort selon l'app)
const STORY_CAPTION = "❆ The lifestyle I dream of — made with Bluminoo";

type PreparedImage = {
  previewUrl: string;
  base64: string;
  mimeType: string;
};

type VideoUpload = {
  file: File;
  previewUrl: string;
  name: string;
  /** Renseigné uniquement pour la vidéo source (lu à la validation). */
  width?: number;
  height?: number;
};

function stripDataUrlPrefix(dataUrl: string): {
  base64: string;
  mimeType: string;
} {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (match) {
    return { mimeType: match[1] || "image/jpeg", base64: match[2] };
  }
  return { mimeType: "image/jpeg", base64: dataUrl };
}

function readFileAsDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read the file."));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unreadable image."));
      image.src = objectUrl;
    });

    const { width, height } = img;
    const longSide = Math.max(width, height);
    const scale = longSide > MAX_DIMENSION ? MAX_DIMENSION / longSide : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Compression failed (canvas unavailable).");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
    return { previewUrl: dataUrl, base64, mimeType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// prepareShareFile is imported from @/lib/share-utils above.

async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > COMPRESS_THRESHOLD_BYTES) {
    return compressImage(file);
  }
  const dataUrl = await readFileAsDataUrl(file);
  const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
  return { previewUrl: dataUrl, base64, mimeType };
}

async function validateVideoFile(
  file: File,
): Promise<{ error: string | null; width?: number; height?: number }> {
  if (!["video/mp4", "video/quicktime"].includes(file.type)) {
    return {
      error:
        "Unsupported file. Please select an MP4 or MOV video.",
    };
  }
  if (file.size > MAX_VIDEO_SOURCE_BYTES) {
    return { error: "File too large (max 50MB)." };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const meta = await new Promise<{
      width: number;
      height: number;
      duration: number;
    }>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () =>
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        });
      video.onerror = () => reject(new Error("Unreadable video."));
      video.src = objectUrl;
    });

    if (meta.width < MIN_VIDEO_WIDTH) {
      return {
        error: `Video resolution too low: ${meta.width}px wide, but at least ${MIN_VIDEO_WIDTH} is required. Re-export it in a higher quality (720p minimum).`,
      };
    }
    if (meta.width > MAX_VIDEO_WIDTH) {
      return {
        error: `Video too large: ${meta.width}px wide, but the maximum is ${MAX_VIDEO_WIDTH}.`,
      };
    }
    if (
      meta.duration < MIN_VIDEO_DURATION_S ||
      meta.duration > MAX_VIDEO_DURATION_S
    ) {
      return {
        error: `Unsupported duration: ${Math.round(meta.duration)}s, but it must be between ${MIN_VIDEO_DURATION_S} and ${MAX_VIDEO_DURATION_S}s.`,
      };
    }
    return { error: null, width: meta.width, height: meta.height };
  } catch {
    return { error: "Unreadable video. Try another MP4 or MOV file." };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Upload direct navigateur → Supabase Storage, sans passer par notre route
 * API (qui serait limitée par la taille de requête des fonctions
 * serverless Vercel, ~4,5 Mo — trop petit pour une vidéo source).
 */
async function uploadVideoDirect(file: File, userId: string): Promise<string> {
  const supabase = createClient();
  const extension = file.name.split(".").pop() || "mp4";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("video-uploads")
    .upload(path, file, { contentType: file.type });
  if (error) {
    throw new Error(`Video upload failed: ${error.message}`);
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("video-uploads").getPublicUrl(path);
  return publicUrl;
}

function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Unsupported file. Please select an image.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "File too large (max 10MB).";
  }
  return null;
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/kie/upload", {
    method: "POST",
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.fileUrl) {
    throw new Error(data?.error || "Image upload failed.");
  }
  return data.fileUrl as string;
}

function DropZone({
  label,
  badge,
  hint,
  subtext,
  upload,
  onPick,
  disabled,
  accept = "image/*",
}: {
  label: string;
  badge?: string;
  hint: string;
  subtext: string;
  upload: VideoUpload | null;
  onPick: (file: File) => void;
  disabled?: boolean;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </p>
        {badge && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-soft">
            {badge}
          </span>
        )}
      </div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = e.dataTransfer.files?.[0];
          if (file) onPick(file);
        }}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`aspect-square cursor-pointer overflow-hidden rounded-2xl border border-dashed text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
          dragging
            ? "border-primary/70 bg-primary/5"
            : "border-white/10 bg-white/[0.02] hover:border-white/20"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onPick(file);
          }}
        />
        {upload ? (
          <div className="relative h-full">
            {upload.file.type.startsWith("video/") ? (
              <video
                src={upload.previewUrl}
                controls
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={upload.previewUrl}
                alt={label}
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
              <p className="truncate text-[11px] text-neutral-300">
                {upload.name}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 16V8m0 0l-3 3m3-3l3 3M4 16.5V17a3 3 0 003 3h10a3 3 0 003-3v-.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-200">
              {hint}
            </p>
            <p className="text-xs text-neutral-600">{subtext}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const GENERATION_LOADING_MESSAGES = [
  "Analyzing the light…",
  "Adjusting the reflections…",
  "Adding the luxury touches…",
  "Finalizing the render…",
];

/**
 * Progression purement perçue, sans lien avec l'état réel côté Gemini
 * (image) ou fal.ai (vidéo) : grimpe vite au début puis ralentit et
 * plafonne à 92%, pour ne jamais laisser croire que c'est fini avant que
 * ça le soit vraiment.
 */
function useElapsedProgress(active: boolean) {
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
    Math.round(100 * (1 - Math.exp(-elapsedSeconds / 70))),
  );

  return { elapsedSeconds, progressPercent };
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("image");

  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [fileName, setFileName] = useState("");
  const [placeImages, setPlaceImages] = useState<PreparedImage[]>([]);
  const [userNote, setUserNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [sharing, setSharing] = useState(false);
  const [canShareToSnap, setCanShareToSnap] = useState(false);
  const [canShareToStory, setCanShareToStory] = useState(false);
  const [showRedSnapGuide, setShowRedSnapGuide] = useState(false);
  const [sendingRedSnap, setSendingRedSnap] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isMobileUserAgent = /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent,
    );
    const canShare = isMobileUserAgent && typeof navigator.share === "function";
    setCanShareToSnap(canShare);
    setCanShareToStory(canShare);
  }, []);

  const [videoSource, setVideoSource] = useState<VideoUpload | null>(null);
  const [videoObject, setVideoObject] = useState<VideoUpload | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  /**
   * Paywall : un visiteur non connecté, ou connecté sans abonnement, parcourt
   * tout le flux (photo, description, bouton Générer, chargement) mais
   * n'obtient qu'un aperçu verrouillé. Aucun appel à l'IA n'est déclenché —
   * ni Gemini, ni l'analyse vision — donc aucune génération n'est facturée
   * pour un visiteur qui n'a pas payé, et rien de générable ne transite vers
   * le navigateur.
   */
  const [paywalled, setPaywalled] = useState(false);
  /** Même verrou, côté onglet Vidéo (état séparé : les deux panneaux ont
   *  leur propre parcours et peuvent être verrouillés indépendamment). */
  const [videoPaywalled, setVideoPaywalled] = useState(false);

  /** Seul un compte connecté ET porteur d'un palier peut générer. */
  const isSubscribed = isLoggedIn && !!planId;
  /**
   * Le Snap Rouge est un avantage des paliers Essentiel et Ultimate, annoncé
   * comme tel sur /pricing. Un abonné Découverte génère normalement mais n'y
   * a pas accès : si cette condition saute, la grille tarifaire ment.
   */
  const hasRedSnap = planId === "essentiel" || planId === "ultimate";

  const { elapsedSeconds: imageElapsed, progressPercent: imageProgress } =
    useElapsedProgress(loading);
  const { elapsedSeconds: videoElapsed, progressPercent: videoProgress } =
    useElapsedProgress(videoLoading);

  const refreshCredits = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
    if (!user) {
      setCredits(null);
      return;
    }
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

  // Chime cristallin au moment de la révélation du résultat (image et vidéo).
  useEffect(() => {
    if (result) playRevealChime();
  }, [result]);

  useEffect(() => {
    if (videoUrl) playRevealChime();
  }, [videoUrl]);

  // Un effet par upload : l'URL est libérée quand l'upload change ou que la
  // page est démontée. L'ancienne version dépendait d'un tableau de deps vide
  // et capturait donc toujours null, sans jamais rien libérer.
  useEffect(() => {
    const url = videoSource?.previewUrl;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [videoSource]);

  useEffect(() => {
    const url = videoObject?.previewUrl;
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [videoObject]);

  useEffect(() => {
    if (!loading && !videoLoading) {
      setLoadingMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingMessageIndex(
        (i) => (i + 1) % GENERATION_LOADING_MESSAGES.length,
      );
    }, 1800);
    return () => clearInterval(interval);
  }, [loading, videoLoading]);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setResult("");
    // Nouvelle photo = nouveau parcours : on relève le verrou pour que
    // l'aperçu bloqué d'une tentative précédente ne reste pas affiché.
    setPaywalled(false);
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const img = await prepareImage(file);
      setPrepared(img);
      setFileName(file.name);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to prepare the image.",
      );
    }
  }, []);

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

  const handlePlaceFiles = useCallback(async (files: File[]) => {
    setError("");
    for (const file of files) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    try {
      const prepared = await Promise.all(files.map((f) => prepareImage(f)));
      setPlaceImages((current) =>
        [...current, ...prepared].slice(0, MAX_PLACE_IMAGES),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to prepare the image.",
      );
    }
  }, []);

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
    // Les photos du lieu sont facultatives : sans elles, la note sert de
    // description. Il en faut donc au moins une des deux, sinon le modèle
    // n'a aucune indication sur la scène à produire.
    if (placeImages.length === 0 && !userNote.trim()) {
      setError(
        "Add a photo of the location, or describe the scene you want in the note.",
      );
      return;
    }
    setLoading(true);
    setError("");
    setResult("");

    // Paywall : on rejoue le chargement pour que le parcours reste lisible,
    // puis on s'arrête sur l'aperçu verrouillé. Le `return` est placé ici,
    // avant tout upload et tout appel fournisseur : rien n'est envoyé, rien
    // n'est facturé.
    if (!isSubscribed) {
      setPaywalled(false);
      await new Promise((r) => setTimeout(r, PAYWALL_PREVIEW_DELAY_MS));
      setLoading(false);
      setPaywalled(true);
      return;
    }

    try {
      const blob = await (await fetch(prepared.previewUrl)).blob();
      if (blob.size > MAX_VIDEO_FILE_BYTES) {
        setError(
          "Image too large after compression (max 4MB). Try a simpler photo.",
        );
        return;
      }
      const file = new File([blob], fileName || "image.jpg", {
        type: prepared.mimeType,
      });
      const sourceImageUrl = await uploadImage(file);

      const placeImageUrls: string[] = [];
      for (let i = 0; i < placeImages.length; i++) {
        const placeBlob = await (
          await fetch(placeImages[i].previewUrl)
        ).blob();
        if (placeBlob.size > MAX_VIDEO_FILE_BYTES) {
          setError(
            "Location photo too large after compression (max 4MB).",
          );
          return;
        }
        const placeFile = new File([placeBlob], `lieu-${i + 1}.jpg`, {
          type: placeImages[i].mimeType,
        });
        placeImageUrls.push(await uploadImage(placeFile));
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          placeImageUrls.length > 0
            ? {
                sourceImageUrl,
                placeImageUrls,
                userNote: userNote.trim() || undefined,
                label: "Image generation",
              }
            : {
                // Sans photo de lieu, la note devient la description : le
                // serveur bascule alors sur son flux « prompt libre ».
                sourceImageUrl,
                prompt: userNote.trim(),
                label: "Image generation",
              },
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(
          (data && data.error) ||
            `Something went wrong (${res.status}). Please try again.`,
        );
        return;
      }
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.imageUrl) {
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
  }, [prepared, userNote, fileName, placeImages, refreshCredits, isSubscribed]);

  /**
   * Sur mobile, un lien `download` ouvre l'image dans un onglet au lieu de
   * l'enregistrer : seule la feuille de partage native propose « Enregistrer
   * dans Photos ». On passe donc par navigator.share quand il accepte les
   * fichiers — comme le fait le partage Snap — et on garde le lien
   * classique en repli sur desktop.
   *
   * Contrairement au partage Snap, on n'utilise PAS `prepareShareFile` :
   * celui-ci réduit à 1600 px et convertit en JPEG pour Snapchat, alors
   * qu'un téléchargement doit rendre le fichier en pleine qualité.
   */
  const download = useCallback(async () => {
    if (!result) return;

    const fallbackToAnchor = () => {
      const a = document.createElement("a");
      a.href = result;
      a.download = "bluminoo-result.png";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    try {
      const res = await fetch(result);
      const blob = await res.blob();
      const file = new File([blob], "bluminoo-result.png", {
        type: blob.type || "image/png",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      // L'utilisateur a simplement fermé la feuille de partage : ne pas
      // enchaîner sur un téléchargement qu'il n'a pas demandé.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    fallbackToAnchor();
  }, [result]);

  const sendAsRedSnap = useCallback(async () => {
    await sendAsRedSnapFn(result, (patch) => {
      if (patch.sendingRedSnap !== undefined) setSendingRedSnap(patch.sendingRedSnap);
      if (patch.error !== undefined) setError(patch.error);
    });
  }, [result]);

  const reset = useCallback(() => {
    setPrepared(null);
    setFileName("");
    setPlaceImages([]);
    setResult("");
    setError("");
    setUserNote("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const pickVideoUpload = useCallback(
    async (file: File, kind: "source" | "object") => {
      setVideoError("");
      setVideoUrl("");
      // Nouveau fichier = nouveau parcours : on relève le verrou pour que
      // l'aperçu bloqué d'une tentative précédente ne reste pas affiché.
      setVideoPaywalled(false);
      const videoCheck =
        kind === "source"
          ? await validateVideoFile(file)
          : { error: validateImageFile(file) };
      if (videoCheck.error) {
        setVideoError(videoCheck.error);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const upload: VideoUpload = {
        file,
        previewUrl,
        name: file.name,
        width: "width" in videoCheck ? videoCheck.width : undefined,
        height: "height" in videoCheck ? videoCheck.height : undefined,
      };
      if (kind === "source") setVideoSource(upload);
      else setVideoObject(upload);
    },
    [],
  );

  const generateVideo = useCallback(async () => {
    // Amorce l'AudioContext dans le geste utilisateur pour iOS Safari.
    unlockAudioContext();
    if (!videoSource) {
      setVideoError("Please upload a source video.");
      return;
    }
    if (!videoObject) {
      setVideoError("Please upload a photo of the replacement object.");
      return;
    }
    const prompt = videoPrompt.trim();
    if (!prompt) {
      setVideoError(
        "Please enter a prompt describing the object replacement.",
      );
      return;
    }
    setVideoLoading(true);

    // Même paywall que pour l'image. Le `return` précède `uploadVideoDirect` :
    // un visiteur non abonné ne peut donc pas déposer de fichier dans le
    // bucket Storage, ce qui ferme aussi la voie d'hébergement gratuit.
    if (!isSubscribed) {
      setVideoError("");
      setVideoPaywalled(false);
      await new Promise((r) => setTimeout(r, PAYWALL_PREVIEW_DELAY_MS));
      setVideoLoading(false);
      setVideoPaywalled(true);
      return;
    }
    setVideoError("");
    setVideoUrl("");
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setVideoError("Log in to generate a video.");
        return;
      }
      const sourceVideoUrl = await uploadVideoDirect(videoSource.file, user.id);
      const preparedObject = await prepareImage(videoObject.file);
      const objectBlob = await (await fetch(preparedObject.previewUrl)).blob();
      if (objectBlob.size > MAX_VIDEO_FILE_BYTES) {
        setVideoError(
          "Object photo too large after compression (max 4MB). Try a simpler photo.",
        );
        return;
      }
      const objectFile = new File([objectBlob], "reference.jpg", {
        type: preparedObject.mimeType,
      });
      const objectImageUrl = await uploadImage(objectFile);
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceVideoUrl,
          objectImageUrl,
          prompt,
          label: "Object replacement",
          sourceVideoWidth: videoSource.width,
          sourceVideoHeight: videoSource.height,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setVideoError(
          (data && data.error) ||
            `Something went wrong (${res.status}). Please try again.`,
        );
        return;
      }
      if (data.error) {
        setVideoError(data.error);
        return;
      }
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl);
        void refreshCredits();
      } else {
        setVideoError("Unexpected response from the server. Please try again.");
      }
    } catch (err) {
      setVideoError(
        err instanceof Error
          ? err.message
          : "Network error during video generation. Check your connection.",
      );
    } finally {
      setVideoLoading(false);
    }
  }, [videoSource, videoObject, videoPrompt, refreshCredits, isSubscribed]);

  const downloadVideo = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "bluminoo-result.mp4";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [videoUrl]);

  const shareVideoToStory = useCallback(async () => {
    if (!videoUrl) return;
    if (!navigator.share) {
      setVideoError(
        "Direct sharing is available from a compatible phone. Download the video if needed.",
      );
      return;
    }

    setSharing(true);
    setVideoError("");
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error("The video couldn't be prepared for sharing.");
      }
      const blob = await response.blob();
      const file = new File([blob], "bluminoo-story.mp4", {
        type: "video/mp4",
      });

      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error(
          "Video file sharing isn't supported by this browser.",
        );
      }

      await navigator.share({ files: [file], text: STORY_CAPTION });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setVideoError(
        err instanceof Error
          ? err.message
          : "Video sharing isn't possible right now.",
      );
    } finally {
      setSharing(false);
    }
  }, [videoUrl]);

  const resetVideo = useCallback(() => {
    setVideoSource(null);
    setVideoObject(null);
    setVideoPrompt("");
    setVideoUrl("");
    setVideoError("");
  }, []);

  return (
    <>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {(["image", "video"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition duration-200 ${
                mode === m
                  ? "bg-primary text-ink"
                  : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {m === "image" ? "Image" : "Video"}
            </button>
          ))}
        </div>
      </div>

      {mode === "image" ? (
        <div className="animate-fade-up mx-auto max-w-xl">
          <Panel className="p-5 sm:p-6">
            <div className="mb-5 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
                Image generation
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold leading-tight tracking-tight text-white">
                The lifestyle you dream of. Until you actually have it.
              </h2>
              <p className="mt-2 text-xs text-neutral-500">
                Ultra-realistic, so the people around you buy it.
              </p>
            </div>

            <div className="mx-auto mb-4 h-80 w-80 max-w-full overflow-hidden rounded-2xl border border-dashed border-white/10">
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose a photo to transform"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => {
                  if (!loading) inputRef.current?.click();
                }}
                onKeyDown={(e) => {
                  if (loading) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                className={`h-full w-full cursor-pointer overflow-hidden rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  isDragging
                    ? "bg-primary/[0.08]"
                    : "bg-white/[0.02] hover:bg-white/[0.035]"
                } ${loading ? "cursor-not-allowed" : ""}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onInputChange}
                />
                {loading ? (
                  <div className="relative flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                    <SparkleFrame />
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    <p className="text-xs text-neutral-400">
                      {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
                    </p>
                    <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                        style={{ width: `${imageProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] tabular-nums text-neutral-600">
                      {imageElapsed}s
                    </p>
                  </div>
                ) : paywalled ? (
                  <div className="animate-magic-reveal relative h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={PAYWALL_PREVIEW_IMAGE}
                      alt="Example Bluminoo render, deliberately blurred"
                      className="h-full w-full scale-110 object-cover blur-2xl"
                      aria-hidden
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary-soft">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <rect
                            x="4"
                            y="10"
                            width="16"
                            height="10"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.7"
                          />
                          <path
                            d="M8 10V7a4 4 0 018 0v3"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                      <p className="font-display text-lg font-semibold text-white">
                        Generation is for subscribers only
                      </p>
                      <p className="max-w-xs text-xs leading-relaxed text-neutral-300">
                        Pick a plan to run your scene and get your image in
                        full quality.
                      </p>
                      <Link
                        href={isLoggedIn ? "/pricing" : "/sign-up"}
                        className="mt-1 inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft"
                      >
                        {isLoggedIn ? "See plans" : "Create my account"}
                      </Link>
                    </div>
                  </div>
                ) : result ? (
                  <div key={result} className="animate-magic-reveal relative h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result}
                      alt="Generated result"
                      className="h-full w-full object-cover"
                    />
                    <RevealBurst />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                      <p className="truncate text-xs text-neutral-300">
                        Result · tap to change photo
                      </p>
                    </div>
                  </div>
                ) : prepared ? (
                  <div className="relative h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={prepared.previewUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                      <p className="truncate text-xs text-neutral-300">
                        {fileName || "Selected image"} · tap to change
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                    <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-[0.1em] text-neutral-200">
                      Your photo
                    </p>
                    <p className="text-xs text-neutral-600">
                      Tap to upload · max 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>

            <input
              ref={secondaryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void handlePlaceFiles(files);
              }}
            />
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-soft">
                  1 to 3 photos
                </span>
              </div>
              {placeImages.length > 0 && (
                <div className="mb-2 grid grid-cols-3 gap-2">
                  {placeImages.map((img, i) => (
                    <div
                      key={img.previewUrl}
                      className="relative aspect-square overflow-hidden rounded-xl border border-white/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={`Location ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Remove location photo ${i + 1}`}
                        onClick={() =>
                          setPlaceImages((current) =>
                            current.filter((_, j) => j !== i),
                          )
                        }
                        className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-black/70 text-xs text-neutral-300 transition hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {placeImages.length < MAX_PLACE_IMAGES && (
                <button
                  type="button"
                  onClick={() => secondaryInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-white/20 hover:text-neutral-100"
                >
                  <span className="text-base leading-none">+</span>
                  <span>
                    {placeImages.length === 0
                      ? "Add a location photo (optional)"
                      : "Add another angle of the location"}
                  </span>
                </button>
              )}
            </div>

            <textarea
              id="user-note"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              rows={2}
              placeholder={
                placeImages.length > 0
                  ? IMAGE_NOTE_PLACEHOLDER_WITH_PLACE
                  : IMAGE_NOTE_PLACEHOLDER_WITHOUT_PLACE
              }
              className="mb-4 w-full resize-y rounded-2xl border border-white/10 bg-black/40 p-3.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-700 focus:border-primary/50"
            />

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {result ? (
                <>
                  <button
                    type="button"
                    onClick={download}
                    className="flex-1 cursor-pointer rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-ink transition duration-200 hover:bg-primary-soft"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={loading}
                    className="cursor-pointer rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-medium text-neutral-300 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? "…" : "Regenerate"}
                  </button>

                  {canShareToSnap && !hasRedSnap && (
                    <div className="w-full space-y-2 sm:w-auto">
                      {/* Palier Découverte : à l'emplacement exact du bouton
                          Snap Rouge, une invitation à le débloquer plutôt
                          qu'un vide. Ce bloc n'est atteignable que par un
                          abonné (le paywall arrête les autres avant). */}
                      <Link
                        href="/pricing"
                        className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-red-600/40 bg-gradient-to-b from-neutral-950 to-black px-5 py-3.5 text-sm font-black uppercase tracking-wide text-red-400/80 transition duration-200 hover:border-red-600 hover:text-red-400 sm:w-auto"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                          className="shrink-0"
                        >
                          <rect
                            x="4"
                            y="10"
                            width="16"
                            height="10"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <path
                            d="M8 10V7a4 4 0 018 0v3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        Unlock Red Snap
                      </Link>
                      <p className="text-center text-[11px] text-neutral-500 sm:text-left">
                        Undetectable delivery, no watermark &mdash; included
                        from the Essential plan onward.
                      </p>
                    </div>
                  )}

                  {canShareToSnap && hasRedSnap && (
                    <div className="w-full space-y-2 sm:w-auto">
                      <button
                        type="button"
                        onClick={() => void sendAsRedSnap()}
                        disabled={sendingRedSnap}
                        className="group relative flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-red-600 bg-gradient-to-b from-neutral-950 to-black px-5 py-3.5 text-sm font-black uppercase tracking-wide text-red-500 shadow-[0_0_20px_-4px_rgba(220,38,38,0.6)] transition duration-200 hover:shadow-[0_0_28px_-2px_rgba(220,38,38,0.85)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-600"
                        />
                        {sendingRedSnap ? "Preparing…" : "Send as Red Snap"}
                      </button>
                      <p className="text-center text-[11px] text-neutral-400 sm:text-left">
                        Just 1 manual tap left (out of 9 steps) &mdash; the
                        rest is automatic.
                      </p>
                    </div>
                  )}

                  {hasRedSnap && (
                  <button
                    type="button"
                    onClick={() => setShowRedSnapGuide((v) => !v)}
                    className="w-full cursor-pointer text-left text-xs font-semibold text-red-400 underline decoration-red-400/40 underline-offset-4 transition hover:text-red-300 sm:w-auto"
                  >
                    {showRedSnapGuide
                      ? "Hide the walkthrough"
                      : "How does Red Snap work? →"}
                  </button>
                  )}

                  {hasRedSnap && showRedSnapGuide && (
                    <div className="w-full rounded-2xl border border-red-500/20 bg-gradient-to-b from-red-500/5 to-transparent p-4">
                      <p className="mb-4 text-center text-lg font-black uppercase tracking-wide text-red-500">
                        Red Snap
                      </p>
                      <p className="mb-4 text-center text-xs text-neutral-400">
                        5 steps to send your Bluminoo photo as a real,
                        undetectable live Snap.
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {[
                          {
                            n: 1,
                            title: "Save",
                            desc: "Choose \"Save Image\" from the menu that opens.",
                            auto: false,
                          },
                          {
                            n: 2,
                            title: "Filter opens",
                            desc: "Snapchat opens straight to the right \"Camera Roll\" filter.",
                            auto: true,
                          },
                          {
                            n: 3,
                            title: "Pick the photo",
                            desc: "Select the Bluminoo photo from your camera roll.",
                            auto: false,
                          },
                          {
                            n: 4,
                            title: "Capture",
                            desc: "Tap the shutter to \"take a photo\" of it.",
                            auto: false,
                          },
                          {
                            n: 5,
                            title: "Send",
                            desc: "Tap \"Send To\" and pick your recipients.",
                            auto: false,
                          },
                        ].map((step) => (
                          <div
                            key={step.n}
                            className="relative flex flex-col rounded-xl border border-red-500/15 bg-black/40 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
                                {step.n}
                              </span>
                              <span
                                className={
                                  step.auto
                                    ? "rounded-full bg-red-600/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-400"
                                    : "rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-400"
                                }
                              >
                                {step.auto ? "Auto" : "Manual"}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-neutral-100">
                              {step.title}
                            </p>
                            <p className="mt-1 text-[11px] leading-snug text-neutral-400">
                              {step.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-center text-[11px] text-neutral-500">
                        The &ldquo;Manual&rdquo; steps happen inside Snapchat
                        itself &mdash; no website (not even competitors&rsquo;)
                        can replace them, since Apple and Snapchat block that
                        for user safety.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading || !prepared}
                  className="flex-1 cursor-pointer rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-ink transition duration-200 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Generating… (~15-30s)" : "Generate"}
                </button>
              )}
              {prepared && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={loading}
                  className="cursor-pointer rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-medium text-neutral-400 transition hover:border-white/20 hover:text-neutral-200 disabled:opacity-40"
                >
                  Reset
                </button>
              )}
            </div>
          </Panel>
        </div>
      ) : (
        <div className="animate-fade-up mx-auto max-w-4xl">
          <Panel className="mb-6 p-5 sm:p-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
              Replace an object
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold text-white">
              A short video, a moment that impresses
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              ~5s of video · ~90s generation · Kling O1 via fal.ai
            </p>
          </Panel>

          <Panel className="mb-6 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
              <p className="shrink-0 text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
                Example result
              </p>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
            </div>
            <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src="/exemple-resultat.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-3 text-center text-xs text-neutral-600">
              AI-powered object replacement
            </p>
            <div className="mt-4 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
                </svg>
                Your credits
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-ink">
                  {isLoggedIn ? (credits ?? "…") : "0"}
                </span>
              </div>
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <DropZone
                  label="Source video"
                  badge="Required"
                  hint="Click to upload"
                  subtext="MP4/MOV · 3-10s · 720p min · max 50MB"
                  upload={videoSource}
                  onPick={(file) => void pickVideoUpload(file, "source")}
                  disabled={videoLoading}
                  accept="video/mp4,video/quicktime"
                />
              </div>
              <div className="hidden shrink-0 items-center justify-center sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-ink">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M5 12h14m0 0-5-5m5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <DropZone
                  label="Object"
                  badge="Required"
                  hint="Image of the object"
                  subtext="JPG, PNG, WebP"
                  upload={videoObject}
                  onPick={(file) => void pickVideoUpload(file, "object")}
                  disabled={videoLoading}
                />
              </div>
            </div>

            <section className="mt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-white/10 bg-black/40 px-3.5 py-3 focus-within:border-primary/50">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="shrink-0 text-neutral-600"
                  >
                    <path
                      d="M4 6h16M4 12h10M4 18h7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <input
                    id="video-prompt"
                    type="text"
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder={VIDEO_PROMPT_PLACEHOLDER}
                    disabled={videoLoading}
                    className="w-full bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-700 disabled:opacity-50"
                  />
                </div>
                <button
                  type="button"
                  onClick={generateVideo}
                  disabled={
                    videoLoading ||
                    !videoSource ||
                    !videoObject ||
                    !videoPrompt.trim()
                  }
                  className="shrink-0 cursor-pointer rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-ink transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {videoLoading
                    ? "Generating video… (~90s+)"
                    : "Replace the object"}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="flex items-start gap-1.5 text-xs text-neutral-500">
                  <span className="text-primary">✦</span>
                  <span>
                    Tip: the reference photo is automatically worked into the
                    scene described in the prompt. Film with your Camera app,
                    then pick the video from your gallery &mdash; recording
                    directly in the browser reduces quality a lot.
                  </span>
                </p>
                {(videoSource || videoObject || videoPrompt) && (
                  <button
                    type="button"
                    onClick={resetVideo}
                    disabled={videoLoading}
                    className="shrink-0 cursor-pointer text-xs font-medium text-neutral-500 underline underline-offset-2 transition hover:text-neutral-300 disabled:opacity-40"
                  >
                    Reset
                  </button>
                )}
              </div>
            </section>

            {videoError && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                {videoError}
              </div>
            )}

            {videoLoading && (
              <div className="relative mt-8 flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl">
                <SparkleFrame />
                <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <p className="text-sm text-neutral-400">
                  {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
                </p>
                <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                    style={{ width: `${videoProgress}%` }}
                  />
                </div>
                <p className="text-[10px] tabular-nums text-neutral-600">
                  {videoElapsed}s
                </p>
              </div>
            )}

            {videoPaywalled && (
              <section className="animate-magic-reveal mt-8">
                <div className="relative overflow-hidden rounded-2xl border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={PAYWALL_PREVIEW_IMAGE}
                    alt="Example Bluminoo render, deliberately blurred"
                    className="h-64 w-full scale-110 object-cover blur-2xl sm:h-80"
                    aria-hidden
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary-soft">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <rect
                          x="4"
                          y="10"
                          width="16"
                          height="10"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.7"
                        />
                        <path
                          d="M8 10V7a4 4 0 018 0v3"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <p className="font-display text-lg font-semibold text-white">
                      Video generation is for subscribers only
                    </p>
                    <p className="max-w-xs text-xs leading-relaxed text-neutral-300">
                      Pick a plan to run your video and get it in full
                      quality.
                    </p>
                    <Link
                      href={isLoggedIn ? "/pricing" : "/sign-up"}
                      className="mt-1 inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft"
                    >
                      {isLoggedIn ? "See plans" : "Create my account"}
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {videoUrl && (
              <section key={videoUrl} className="mt-8 animate-magic-reveal">
                <div className="relative">
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    className="w-full rounded-2xl border border-white/10"
                  />
                  <RevealBurst />
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={downloadVideo}
                    className="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-primary-soft"
                  >
                    Download
                  </button>
                  {canShareToStory && (
                    <button
                      type="button"
                      onClick={() => void shareVideoToStory()}
                      disabled={sharing}
                      className="cursor-pointer rounded-xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sharing ? "Preparing…" : "Post to Story ↗"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={generateVideo}
                    disabled={videoLoading}
                    className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-white/20 disabled:opacity-40"
                  >
                    {videoLoading ? "…" : "Regenerate"}
                  </button>
                </div>
              </section>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
