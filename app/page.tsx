"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import { createClient } from "@/lib/supabase/client";

type Mode = "image" | "video";

const IMAGE_PROMPT_PLACEHOLDER =
  "Décrivez précisément votre photo (ex : remplace la montre au poignet par une Rolex Submariner en acier, conserve le visage, la pose et le fond)…";

const VIDEO_PROMPT_PLACEHOLDER =
  "Ex : Remplace la montre au poignet par une Rolex Submariner en acier, mouvements naturels, conserve le visage, la pose et le fond…";

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

async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.size > COMPRESS_THRESHOLD_BYTES) {
    return compressImage(file);
  }
  const dataUrl = await readFileAsDataUrl(file);
  const { base64, mimeType } = stripDataUrlPrefix(dataUrl);
  return { previewUrl: dataUrl, base64, mimeType };
}

/**
 * Contraintes du modèle Kling O1 (fal.ai) sur la vidéo source, vérifiées
 * côté client avant l'upload : sans ça, le refus ne remonte qu'après avoir
 * uploadé plusieurs dizaines de Mo et débité des crédits (remboursés, mais
 * l'attente est inutile).
 */
async function validateVideoFile(file: File): Promise<string | null> {
  if (!["video/mp4", "video/quicktime"].includes(file.type)) {
    return "Fichier non pris en charge. Veuillez sélectionner une vidéo MP4 ou MOV.";
  }
  if (file.size > MAX_VIDEO_SOURCE_BYTES) {
    return "Fichier trop volumineux (max 50 Mo).";
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
      video.onerror = () => reject(new Error("Vidéo illisible."));
      video.src = objectUrl;
    });

    if (meta.width < MIN_VIDEO_WIDTH) {
      return `Vidéo trop basse résolution : ${meta.width} px de large, alors qu'il en faut au moins ${MIN_VIDEO_WIDTH}. Réexportez-la en qualité supérieure (720p minimum).`;
    }
    if (meta.width > MAX_VIDEO_WIDTH) {
      return `Vidéo trop grande : ${meta.width} px de large, alors que le maximum est ${MAX_VIDEO_WIDTH}.`;
    }
    if (
      meta.duration < MIN_VIDEO_DURATION_S ||
      meta.duration > MAX_VIDEO_DURATION_S
    ) {
      return `Durée non prise en charge : ${Math.round(meta.duration)} s, alors qu'il faut entre ${MIN_VIDEO_DURATION_S} et ${MAX_VIDEO_DURATION_S} s.`;
    }
    return null;
  } catch {
    return "Vidéo illisible. Essayez un autre fichier MP4 ou MOV.";
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
    throw new Error(`Échec de l'upload de la vidéo : ${error.message}`);
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("video-uploads").getPublicUrl(path);
  return publicUrl;
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
  "Analyse de la lumière…",
  "Ajustement des reflets…",
  "Intégration du luxe…",
  "Calcul des ombres portées…",
  "Harmonisation des couleurs…",
  "Affinage des textures…",
  "Vérification de la cohérence…",
  "Rendu haute fidélité…",
  "Derniers détails…",
  "Finalisation du rendu…",
];

const LOADING_MESSAGE_INTERVAL_MS = 4_000;

/**
 * Progression purement perçue, sans lien avec l'état réel côté kie.ai :
 * grimpe vite au début puis ralentit et plafonne à 92%, pour ne jamais
 * laisser croire que c'est fini avant que ça le soit vraiment.
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
  const [secondaryImage, setSecondaryImage] = useState<PreparedImage | null>(
    null,
  );
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  const [videoSource, setVideoSource] = useState<VideoUpload | null>(null);
  const [videoObject, setVideoObject] = useState<VideoUpload | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
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
    }, LOADING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loading, videoLoading]);

  const { elapsedSeconds: imageElapsed, progressPercent: imageProgress } =
    useElapsedProgress(loading);
  const { elapsedSeconds: videoElapsed, progressPercent: videoProgress } =
    useElapsedProgress(videoLoading);

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

  const handleSecondaryFile = useCallback(async (file: File) => {
    setError("");
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setSecondaryImage(await prepareImage(file));
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
    const prompt = customPrompt.trim();
    if (!prompt) {
      setError("Décrivez la transformation souhaitée.");
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

      let objectImageUrl: string | undefined;
      if (secondaryImage) {
        const objectBlob = await (await fetch(secondaryImage.previewUrl)).blob();
        if (objectBlob.size > MAX_VIDEO_FILE_BYTES) {
          setError(
            "Photo de référence trop volumineuse après compression (max 4 Mo).",
          );
          return;
        }
        const objectFile = new File([objectBlob], "reference.jpg", {
          type: secondaryImage.mimeType,
        });
        objectImageUrl = await uploadImage(objectFile);
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrl,
          objectImageUrl,
          prompt,
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
        setResultFile(null);
        // Préchargé dès que possible (pas au clic sur "Télécharger") pour que
        // navigator.share() puisse être appelé sans await préalable — sur
        // Android Chrome, un await avant share() casse l'activation
        // utilisateur et fait échouer le partage silencieusement.
        fetch(data.imageUrl)
          .then((r) => r.blob())
          .then((blob) =>
            setResultFile(
              new File([blob], "bluminoo-result.png", {
                type: blob.type || "image/png",
              }),
            ),
          )
          .catch(() => {});
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
  }, [prepared, customPrompt, fileName, secondaryImage, refreshCredits]);

  const download = useCallback(async () => {
    if (!result) return;

    try {
      // resultFile est préchargé dès la fin de la génération : on l'utilise
      // ici tel quel, sans await avant navigator.share(), pour ne pas perdre
      // l'activation utilisateur sur Android Chrome. S'il n'est pas encore
      // prêt (course rare entre fin de fetch et clic), on le récupère ici en
      // dernier recours — le partage peut alors échouer sur Chrome Android,
      // mais on retombe proprement sur le téléchargement classique.
      const file =
        resultFile ??
        new File(
          [await fetch(result).then((r) => r.blob())],
          "bluminoo-result.png",
          { type: "image/png" },
        );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      // L'utilisateur a annulé le partage (AbortError) : ne pas basculer
      // sur le téléchargement fichier, il a fait un choix délibéré.
      if (err instanceof Error && err.name === "AbortError") return;
      // Sinon (API indisponible, fetch échoué…) : on retombe sur le
      // téléchargement classique ci-dessous.
    }

    const a = document.createElement("a");
    a.href = result;
    a.download = "bluminoo-result.png";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result, resultFile]);

  const reset = useCallback(() => {
    setPrepared(null);
    setFileName("");
    setSecondaryImage(null);
    setResult("");
    setResultFile(null);
    setError("");
    setCustomPrompt("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const pickVideoUpload = useCallback(
    async (file: File, kind: "source" | "object") => {
      setVideoError("");
      setVideoUrl("");
      const validationError =
        kind === "source"
          ? await validateVideoFile(file)
          : validateImageFile(file);
      if (validationError) {
        setVideoError(validationError);
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
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setVideoError("Connectez-vous pour générer une vidéo.");
        return;
      }
      const sourceVideoUrl = await uploadVideoDirect(videoSource.file, user.id);
      const preparedObject = await prepareImage(videoObject.file);
      const objectBlob = await (await fetch(preparedObject.previewUrl)).blob();
      if (objectBlob.size > MAX_VIDEO_FILE_BYTES) {
        setVideoError(
          "Photo de l'objet trop volumineuse après compression (max 4 Mo). Essayez une photo plus simple.",
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
        setVideoFile(null);
        fetch(data.videoUrl)
          .then((r) => r.blob())
          .then((blob) =>
            setVideoFile(
              new File([blob], "bluminoo-result.mp4", {
                type: blob.type || "video/mp4",
              }),
            ),
          )
          .catch(() => {});
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

  const downloadVideo = useCallback(async () => {
    if (!videoUrl) return;

    try {
      const file =
        videoFile ??
        new File(
          [await fetch(videoUrl).then((r) => r.blob())],
          "bluminoo-result.mp4",
          { type: "video/mp4" },
        );
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }

    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "bluminoo-result.mp4";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [videoUrl, videoFile]);

  const resetVideo = useCallback(() => {
    setVideoSource(null);
    setVideoObject(null);
    setVideoPrompt("");
    setVideoUrl("");
    setVideoFile(null);
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
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleSecondaryFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => secondaryInputRef.current?.click()}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-white/20 hover:text-neutral-100"
            >
              {secondaryImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={secondaryImage.previewUrl}
                    alt="Référence"
                    className="h-6 w-6 rounded-md object-cover"
                  />
                  <span className="truncate">Photo de référence ajoutée</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Retirer la photo de référence"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSecondaryImage(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setSecondaryImage(null);
                      }
                    }}
                    className="ml-1 cursor-pointer text-neutral-500 hover:text-neutral-200"
                  >
                    ✕
                  </span>
                </>
              ) : (
                <>
                  <span className="text-base leading-none">+</span>
                  <span>
                    Ajouter photo{" "}
                    <span className="text-neutral-600">(optionnel)</span>
                  </span>
                </>
              )}
            </button>

            <textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              placeholder={IMAGE_PROMPT_PLACEHOLDER}
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
                  <button
                    type="button"
                    onClick={generate}
                    disabled={loading || !customPrompt.trim()}
                    className="cursor-pointer rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-medium text-neutral-300 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? "…" : "Régénérer"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading || !prepared || !customPrompt.trim()}
                  className="flex-1 cursor-pointer rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-ink transition duration-200 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Génération…" : "Générer"}
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
                  subtext="MP4/MOV · 3-10 s · 720p min · max 50 Mo"
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
                    intégrée à la scène décrite dans le prompt. Filmez avec
                    votre application Caméra puis choisissez la vidéo dans
                    votre galerie — l&apos;enregistrement direct depuis le
                    navigateur réduit fortement la qualité.
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
