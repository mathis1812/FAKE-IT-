"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import { createClient } from "@/lib/supabase/client";

type Mode = "image" | "video";

const IMAGE_NOTE_PLACEHOLDER =
  "Note optionnelle (ex : assis à la table près de la fenêtre, ambiance soirée)…";

const MAX_PLACE_IMAGES = 3;

const VIDEO_PROMPT_PLACEHOLDER =
  "Ex : Remplace la montre au poignet par une Rolex Submariner en acier, mouvements naturels, conserve le visage, la pose et le fond…";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_FILE_BYTES = 4 * 1024 * 1024;
const COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1536;
const JPEG_QUALITY = 0.9;
// Format Story 9:16 pour Instagram et TikTok
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const STORY_JPEG_QUALITY = 0.88;
// Légende lifestyle glissée dans le partage (best-effort selon l'app)
const STORY_CAPTION =
  "❆ Lifestyle ultra-réaliste — généré avec Bluminoo";

type PreparedImage = {
  previewUrl: string;
  base64: string;
  mimeType: string;
};

type VideoUpload = {
  file: File;
  previewUrl: string;
  name: string;
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
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image illisible."));
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
    if (!ctx) throw new Error("Compression impossible (canvas indisponible).");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
    return { previewUrl: dataUrl, base64, mimeType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Convertit le résultat en JPEG 9:16 (1080×1920) centré sur fond noir,
 * prêt à poster directement en Story Instagram ou TikTok sans recadrage.
 */
async function prepareStoryFile(blob: Blob): Promise<File> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image illisible."));
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = STORY_WIDTH;
    canvas.height = STORY_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Préparation Story impossible.");
    ctx.fillStyle = "#0a0810";
    ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

    const scale = Math.min(STORY_WIDTH / img.width, STORY_HEIGHT / img.height);
    const drawW = Math.round(img.width * scale);
    const drawH = Math.round(img.height * scale);
    const drawX = Math.round((STORY_WIDTH - drawW) / 2);
    const drawY = Math.round((STORY_HEIGHT - drawH) / 2);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const shareBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", STORY_JPEG_QUALITY),
    );
    if (!shareBlob) throw new Error("Préparation Story impossible.");

    return new File([shareBlob], "bluminoo-story.jpg", {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > COMPRESS_THRESHOLD_BYTES) {
    return compressImage(file);
  }
  const dataUrl = await readFileAsDataUrl(file);
  const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
  return { previewUrl: dataUrl, base64, mimeType };
}

function validateImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Fichier non pris en charge. Veuillez sélectionner une image.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Fichier trop volumineux (max 10 Mo).";
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
    throw new Error(data?.error || "Échec de l'upload de l'image.");
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
}: {
  label: string;
  badge?: string;
  hint: string;
  subtext: string;
  upload: VideoUpload | null;
  onPick: (file: File) => void;
  disabled?: boolean;
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
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onPick(file);
          }}
        />
        {upload ? (
          <div className="relative h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={upload.previewUrl}
              alt={label}
              className="h-full w-full object-cover"
            />
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
  "Analyse de la lumière…",
  "Ajustement des reflets…",
  "Intégration du luxe…",
  "Finalisation du rendu…",
];

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
  const [canShareToStory, setCanShareToStory] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isMobileUserAgent = /Android|iPhone|iPad|iPod/i.test(
      navigator.userAgent,
    );
    setCanShareToStory(isMobileUserAgent && typeof navigator.share === "function");
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
      .select("credits")
      .eq("id", user.id)
      .single();
    setCredits(data?.credits ?? 0);
  }, []);

  useEffect(() => {
    void refreshCredits();
  }, [refreshCredits]);

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
          : "Préparation de l'image impossible.",
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
          : "Préparation de l'image impossible.",
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
    if (!prepared) {
      setError("Veuillez d'abord uploader une image.");
      return;
    }
    if (placeImages.length === 0) {
      setError("Ajoutez au moins une photo du lieu où vous voulez apparaître.");
      return;
    }
    setLoading(true);
    setError("");
    setResult("");
    try {
      const blob = await (await fetch(prepared.previewUrl)).blob();
      if (blob.size > MAX_VIDEO_FILE_BYTES) {
        setError(
          "Image trop volumineuse après compression (max 4 Mo). Essayez une photo plus simple.",
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
            "Photo du lieu trop volumineuse après compression (max 4 Mo).",
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
        body: JSON.stringify({
          sourceImageUrl,
          placeImageUrls,
          userNote: userNote.trim() || undefined,
          label: "Génération image",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(
          (data && data.error) ||
            `Une erreur est survenue (${res.status}). Réessayez.`,
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
        setError("Réponse inattendue du serveur. Réessayez.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur réseau lors de la génération. Vérifiez votre connexion.",
      );
    } finally {
      setLoading(false);
    }
  }, [prepared, userNote, fileName, placeImages, refreshCredits]);

  const download = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = "bluminoo-result.png";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  const shareToStory = useCallback(async () => {
    if (!result) return;
    if (!navigator.share) {
      setError(
        "Le partage direct est disponible depuis un téléphone compatible. Téléchargez l’image si nécessaire.",
      );
      return;
    }

    setSharing(true);
    setError("");
    try {
      const response = await fetch(result);
      if (!response.ok) {
        throw new Error("Le résultat ne peut pas être préparé pour le partage.");
      }
      const blob = await response.blob();
      const file = await prepareStoryFile(blob);

      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error(
          "Le partage de fichiers n’est pas pris en charge par ce navigateur.",
        );
      }

      // On inclut le texte en best-effort : certaines apps (Android) le récupèrent,
      // d’autres (iOS) l’ignorent pour les partages avec fichier.
      const shareData: ShareData = { files: [file], text: STORY_CAPTION };
      await navigator.share(shareData);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof Error
          ? err.message
          : "Le partage de la photo est impossible pour le moment.",
      );
    } finally {
      setSharing(false);
    }
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
      const validationError = validateImageFile(file);
      if (validationError) {
        setVideoError(validationError);
        return;
      }
      if (file.size > MAX_VIDEO_FILE_BYTES) {
        setVideoError("Fichier trop volumineux pour la vidéo (max 4 Mo).");
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const upload: VideoUpload = { file, previewUrl, name: file.name };
      if (kind === "source") setVideoSource(upload);
      else setVideoObject(upload);
    },
    [],
  );

  const generateVideo = useCallback(async () => {
    if (!videoSource) {
      setVideoError("Veuillez uploader une vidéo source.");
      return;
    }
    if (!videoObject) {
      setVideoError("Veuillez uploader une photo de l'objet de remplacement.");
      return;
    }
    const prompt = videoPrompt.trim();
    if (!prompt) {
      setVideoError(
        "Veuillez saisir un prompt décrivant le remplacement d'objet.",
      );
      return;
    }
    setVideoLoading(true);
    setVideoError("");
    setVideoUrl("");
    try {
      const sourceImageUrl = await uploadImage(videoSource.file);
      const objectImageUrl = await uploadImage(videoObject.file);
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrl,
          objectImageUrl,
          prompt,
          label: "Remplacement d'objet",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setVideoError(
          (data && data.error) ||
            `Une erreur est survenue (${res.status}). Réessayez.`,
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
        setVideoError("Réponse inattendue du serveur. Réessayez.");
      }
    } catch (err) {
      setVideoError(
        err instanceof Error
          ? err.message
          : "Erreur réseau lors de la génération vidéo. Vérifiez votre connexion.",
      );
    } finally {
      setVideoLoading(false);
    }
  }, [videoSource, videoObject, videoPrompt, refreshCredits]);

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
              {m === "image" ? "Image" : "Vidéo"}
            </button>
          ))}
        </div>
      </div>

      {mode === "image" ? (
        <div className="animate-fade-up mx-auto max-w-xl">
          <Panel className="p-5 sm:p-6">
            <div className="mb-5 text-center">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
                Génération image
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold leading-tight tracking-tight text-white">
                Intégrez le luxe. Gardez tout le reste.
              </h2>
            </div>

            <div className="mx-auto mb-4 h-80 w-80 max-w-full overflow-hidden rounded-2xl border border-dashed border-white/10">
              <div
                role="button"
                tabIndex={0}
                aria-label="Choisir une photo à transformer"
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
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                    <p className="text-xs text-neutral-400">
                      {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
                    </p>
                  </div>
                ) : result ? (
                  <div className="animate-reveal relative h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result}
                      alt="Résultat généré"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                      <p className="truncate text-xs text-neutral-300">
                        Résultat · touche pour changer de photo
                      </p>
                    </div>
                  </div>
                ) : prepared ? (
                  <div className="relative h-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={prepared.previewUrl}
                      alt="Aperçu"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                      <p className="truncate text-xs text-neutral-300">
                        {fileName || "Image sélectionnée"} · touche pour
                        changer
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
                      Ta photo
                    </p>
                    <p className="text-xs text-neutral-600">
                      Touche pour importer · max 10 Mo
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
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  Le lieu où tu veux apparaître
                </p>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-soft">
                  1 à 3 photos
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
                        alt={`Lieu ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`Retirer la photo du lieu ${i + 1}`}
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
                      ? "Ajouter la photo du lieu (restaurant, rooftop…)"
                      : "Ajouter un autre angle du lieu"}
                  </span>
                </button>
              )}
              <p className="mt-2 text-[11px] text-neutral-600">
                1 photo suffit — 2 à 3 angles différents du même lieu améliorent
                la fidélité du décor et de la lumière. Le prompt est généré
                automatiquement à partir de tes photos.
              </p>
            </div>

            <textarea
              id="user-note"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              rows={2}
              placeholder={IMAGE_NOTE_PLACEHOLDER}
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
                    Télécharger
                  </button>

                  {canShareToStory && (
                    <button
                      type="button"
                      onClick={() => void shareToStory()}
                      disabled={sharing}
                      className="flex-1 cursor-pointer rounded-2xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] px-5 py-3.5 text-sm font-bold text-white transition duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sharing ? "Préparation…" : "Poster en Story ↗"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={generate}
                    disabled={loading || placeImages.length === 0}
                    className="cursor-pointer rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-medium text-neutral-300 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? "…" : "Régénérer"}
                  </button>

                </>
              ) : (
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading || !prepared || placeImages.length === 0}
                  className="flex-1 cursor-pointer rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-ink transition duration-200 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Génération… (~15-30s)" : "Générer"}
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
              Remplacer un objet
            </p>
            <h2 className="font-display mt-2 text-3xl font-semibold text-white">
              Vidéo courte, intégration réaliste
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              ~5 s de vidéo · génération ~90 s · Kling 3.0 Pro via kie.ai
            </p>
          </Panel>

          <Panel className="mb-6 p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
              <p className="shrink-0 text-[10px] font-medium uppercase tracking-[0.22em] text-neutral-500">
                Exemple de résultat
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
              Remplacement d&apos;objet par IA
            </p>
            <div className="mt-4 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
                </svg>
                Tes crédits
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
                  label="Vidéo source"
                  badge="Requis"
                  hint="Cliquez pour uploader"
                  subtext="Votre photo / scène"
                  upload={videoSource}
                  onPick={(file) => void pickVideoUpload(file, "source")}
                  disabled={videoLoading}
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
                  label="Objet"
                  badge="Requis"
                  hint="Image de l'objet"
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
                    ? "Génération vidéo… (~90s+)"
                    : "Remplacer l'objet"}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="flex items-start gap-1.5 text-xs text-neutral-500">
                  <span className="text-primary">✦</span>
                  <span>
                    Astuce : la photo de référence est automatiquement
                    intégrée à la scène décrite dans le prompt.
                  </span>
                </p>
                {(videoSource || videoObject || videoPrompt) && (
                  <button
                    type="button"
                    onClick={resetVideo}
                    disabled={videoLoading}
                    className="shrink-0 cursor-pointer text-xs font-medium text-neutral-500 underline underline-offset-2 transition hover:text-neutral-300 disabled:opacity-40"
                  >
                    Réinitialiser
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
              <div className="mt-8 flex min-h-[200px] flex-col items-center justify-center gap-4">
                <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                <p className="text-sm text-neutral-400">
                  {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
                </p>
              </div>
            )}

            {videoUrl && (
              <section className="mt-8 animate-reveal">
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-full rounded-2xl border border-white/10"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={downloadVideo}
                    className="cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-primary-soft"
                  >
                    Télécharger
                  </button>
                  <button
                    type="button"
                    onClick={generateVideo}
                    disabled={videoLoading}
                    className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:border-white/20 disabled:opacity-40"
                  >
                    {videoLoading ? "…" : "Régénérer"}
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
