"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Panel from "@/components/Panel";
import { addGalleryEntry } from "@/lib/gallery";

type Mode = "image" | "video";
type CategoryId = "montre" | "voiture" | "lieu";

const PRESETS: Record<
  CategoryId,
  { label: string; subtitle: string; prompt: string }
> = {
  montre: {
    label: "Montre",
    subtitle: "Rolex-style",
    prompt:
      "Replace only the watch on the subject's wrist with a photorealistic luxury watch (Rolex Submariner style, stainless steel, ceramic bezel). Preserve the exact wrist, hand, skin tone, veins, hair, pose and background. Match the original lighting, shadows and reflections on the metal case realistically. Photorealistic, shot on a smartphone, natural grain. Do not alter anything else in the image.",
  },
  voiture: {
    label: "Voiture",
    subtitle: "Ferrari-style",
    prompt:
      "Replace only the vehicle with a photorealistic luxury sports car (Ferrari style) in a plausible color, keeping the exact same position, angle, perspective and scale in the scene. Preserve the background, road, lighting, weather and shadows exactly. Keep the license plate area realistic. Candid smartphone photo look, natural depth of field. Do not change anything else.",
  },
  lieu: {
    label: "Lieu",
    subtitle: "Rooftop luxe",
    prompt:
      "Keep the subject, their exact face, pose, outfit and body unchanged. Replace only the background with a photorealistic upscale setting (luxury rooftop restaurant at golden hour, city skyline, tasteful ambient lighting). Blend the subject naturally into the new environment with matching light direction, color temperature and soft shadows. Candid iPhone photo aesthetic, realistic, not over-processed.",
  },
};

const VIDEO_PROMPT_PLACEHOLDER =
  "Ex : Remplace la montre au poignet par une Rolex Submariner en acier, mouvements naturels, conserve le visage, la pose et le fond…";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
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

function BeforeAfterSlider({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const [pos, setPos] = useState(50);

  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-black sm:aspect-[3/4] lg:aspect-square">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt="Avant"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={after}
          alt="Après"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-primary/90"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary/40 bg-ink/90 text-[10px] font-semibold tracking-wide text-primary-soft">
          ↔
        </div>
      </div>
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
        Avant
      </div>
      <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-primary/15 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-primary-soft backdrop-blur-sm">
        Après
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Comparer avant et après"
        className="compare-range absolute inset-0 z-10 h-full w-full opacity-0"
      />
    </div>
  );
}

function DropZone({
  label,
  hint,
  upload,
  onPick,
  disabled,
}: {
  label: string;
  hint: string;
  upload: VideoUpload | null;
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>
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
        className={`cursor-pointer rounded-2xl border border-dashed p-5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
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
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={upload.previewUrl}
              alt={label}
              className="max-h-40 rounded-lg object-contain"
            />
            <p className="text-xs text-neutral-500">{upload.name}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <p className="text-sm font-medium text-neutral-200">{hint}</p>
            <p className="text-xs text-neutral-600">JPG, PNG, WebP — max 10 Mo</p>
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
  const [category, setCategory] = useState<CategoryId>("montre");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [videoSource, setVideoSource] = useState<VideoUpload | null>(null);
  const [videoObject, setVideoObject] = useState<VideoUpload | null>(null);
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

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
    const prompt = customPrompt.trim() || PRESETS[category].prompt;
    setLoading(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: prepared.base64,
          mimeType: prepared.mimeType,
          prompt,
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
      if (data.imageBase64) {
        const resultDataUrl = `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`;
        setResult(resultDataUrl);
        addGalleryEntry({
          mode: "image",
          resultUrl: resultDataUrl,
          label: PRESETS[category].label,
        }).catch((err) => {
          console.error(
            "Impossible de sauvegarder la génération dans la galerie locale.",
            err,
          );
        });
      } else {
        setError("Réponse inattendue du serveur. Réessayez.");
      }
    } catch {
      setError(
        "Erreur réseau lors de la génération. Vérifiez votre connexion.",
      );
    } finally {
      setLoading(false);
    }
  }, [prepared, customPrompt, category]);

  const download = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = "bluminoo-result.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  const reset = useCallback(() => {
    setPrepared(null);
    setFileName("");
    setResult("");
    setError("");
    setCustomPrompt("");
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
      const previewUrl = URL.createObjectURL(file);
      const upload: VideoUpload = { file, previewUrl, name: file.name };
      if (kind === "source") setVideoSource(upload);
      else setVideoObject(upload);
    },
    [],
  );

  const generateVideo = useCallback(async () => {
    if (!videoSource) {
      setVideoError("Veuillez uploader une image source.");
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
      const objectImageUrl = videoObject
        ? await uploadImage(videoObject.file)
        : undefined;
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageUrl, objectImageUrl, prompt }),
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
        addGalleryEntry({
          mode: "video",
          resultUrl: data.videoUrl,
          label: "Remplacement d'objet",
        }).catch((err) => {
          console.error(
            "Impossible de sauvegarder la génération dans la galerie locale.",
            err,
          );
        });
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
  }, [videoSource, videoObject, videoPrompt]);

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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <aside className="animate-fade-up lg:col-span-5">
            <Panel className="p-5 sm:p-6 lg:sticky lg:top-24">
              <div className="mb-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
                  Génération image
                </p>
                <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
                  Intégrez le luxe. Gardez tout le reste.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                  Une photo. Un preset. Un rendu photoréaliste, sans trahir
                  le cadre d&apos;origine.
                </p>
              </div>

              <div className="mb-6 rounded-2xl border border-dashed border-white/10">
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
                  onClick={() => inputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      inputRef.current?.click();
                    }
                  }}
                  className={`cursor-pointer overflow-hidden rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                    isDragging
                      ? "bg-primary/[0.08]"
                      : "bg-white/[0.02] hover:bg-white/[0.035]"
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onInputChange}
                  />
                  {prepared ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={prepared.previewUrl}
                        alt="Aperçu"
                        className="max-h-52 w-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                        <p className="truncate text-xs text-neutral-300">
                          {fileName || "Image sélectionnée"} · cliquer pour
                          changer
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M12 16V8m0 0l-3 3m3-3l3 3M4 16.5V17a3 3 0 003 3h10a3 3 0 003-3v-.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-neutral-100">
                        Déposez une photo ou cliquez
                      </p>
                      <p className="text-xs text-neutral-600">
                        Max 10 Mo · compression auto au-delà de 2 Mo
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <section className="mb-6">
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                  Preset
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(PRESETS) as CategoryId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCategory(id)}
                      className={`cursor-pointer rounded-xl px-2 py-3 text-left transition duration-200 ${
                        category === id
                          ? "bg-primary text-ink"
                          : "border border-white/10 bg-white/[0.02] text-neutral-300 hover:border-primary/30"
                      }`}
                    >
                      <span className="block text-sm font-semibold leading-none">
                        {PRESETS[id].label}
                      </span>
                      <span
                        className={`mt-1.5 block text-[10px] leading-none ${
                          category === id
                            ? "text-ink/70"
                            : "text-neutral-600"
                        }`}
                      >
                        {PRESETS[id].subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mb-6">
                <label
                  htmlFor="custom-prompt"
                  className="mb-3 block text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500"
                >
                  Prompt libre{" "}
                  <span className="normal-case tracking-normal text-neutral-600">
                    (optionnel)
                  </span>
                </label>
                <textarea
                  id="custom-prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                  placeholder="Remplace le preset si rempli…"
                  className="w-full resize-y rounded-2xl border border-white/10 bg-black/40 p-3.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-700 focus:border-primary/50"
                />
              </section>

              {error && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={generate}
                  disabled={loading || !prepared}
                  className="flex-1 cursor-pointer rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-ink transition duration-200 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? "Génération… (~15-30s)" : "Générer"}
                </button>
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
          </aside>

          <section className="animate-fade-up-delay lg:col-span-7">
            <Panel className="min-h-[420px] p-4 sm:p-6 lg:min-h-[640px]">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Canvas
                  </p>
                  <h3 className="font-display mt-1 text-2xl font-semibold text-white">
                    {result ? "Avant / Après" : "Aperçu"}
                  </h3>
                </div>
                {result && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={download}
                      className="cursor-pointer rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-ink transition duration-200 hover:bg-primary-soft"
                    >
                      Télécharger
                    </button>
                    <button
                      type="button"
                      onClick={generate}
                      disabled={loading}
                      className="cursor-pointer rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-white/20 disabled:opacity-40"
                    >
                      {loading ? "…" : "Régénérer"}
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 lg:min-h-[520px]">
                  <div className="h-14 w-14 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
                  <p className="text-sm text-neutral-400">
                    {GENERATION_LOADING_MESSAGES[loadingMessageIndex]}
                  </p>
                </div>
              ) : result && prepared ? (
                <div className="animate-reveal">
                  <BeforeAfterSlider
                    before={prepared.previewUrl}
                    after={result}
                  />
                  <p className="mt-3 text-center text-xs text-neutral-600">
                    Glissez pour comparer
                  </p>
                </div>
              ) : prepared ? (
                <div className="flex min-h-[360px] items-center justify-center lg:min-h-[520px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={prepared.previewUrl}
                    alt="Original"
                    className="max-h-[520px] w-full rounded-2xl object-contain"
                  />
                </div>
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center lg:min-h-[520px]">
                  <div className="h-px w-16 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  <p className="font-display text-xl font-semibold text-neutral-300">
                    Votre rendu apparaîtra ici
                  </p>
                  <p className="max-w-sm text-sm text-neutral-600">
                    Uploadez une photo, choisissez un preset, générez. Le
                    slider avant/après s&apos;affiche dès que le résultat
                    est prêt.
                  </p>
                </div>
              )}
            </Panel>
          </section>
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
                  0
                </span>
              </div>
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <DropZone
                label="Image source (requis)"
                hint="Votre photo / scène"
                upload={videoSource}
                onPick={(file) => void pickVideoUpload(file, "source")}
                disabled={videoLoading}
              />
              <DropZone
                label="Objet (optionnel)"
                hint="Référence luxe"
                upload={videoObject}
                onPick={(file) => void pickVideoUpload(file, "object")}
                disabled={videoLoading}
              />
            </div>

            <section className="mt-6">
              <label
                htmlFor="video-prompt"
                className="mb-3 block text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500"
              >
                Prompt
              </label>
              <textarea
                id="video-prompt"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                rows={4}
                placeholder={VIDEO_PROMPT_PLACEHOLDER}
                disabled={videoLoading}
                className="w-full resize-y rounded-2xl border border-white/10 bg-black/40 p-3.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-700 focus:border-primary/50 disabled:opacity-50"
              />
            </section>

            <section className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateVideo}
                disabled={
                  videoLoading || !videoSource || !videoPrompt.trim()
                }
                className="cursor-pointer rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-ink transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                {videoLoading
                  ? "Génération vidéo… (~90s+)"
                  : "Générer la vidéo"}
              </button>
              {(videoSource || videoObject || videoPrompt) && (
                <button
                  type="button"
                  onClick={resetVideo}
                  disabled={videoLoading}
                  className="cursor-pointer rounded-2xl border border-white/10 px-4 py-3.5 text-sm font-medium text-neutral-400 transition hover:border-white/20 disabled:opacity-40"
                >
                  Reset
                </button>
              )}
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
