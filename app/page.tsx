"use client";

import { useCallback, useRef, useState } from "react";

type CategoryId = "montre" | "voiture" | "lieu";

const PRESETS: Record<CategoryId, { label: string; emoji: string; prompt: string }> = {
  montre: {
    label: "Montre",
    emoji: "⌚",
    prompt:
      "Replace only the watch on the subject's wrist with a photorealistic luxury watch (Rolex Submariner style, stainless steel, ceramic bezel). Preserve the exact wrist, hand, skin tone, veins, hair, pose and background. Match the original lighting, shadows and reflections on the metal case realistically. Photorealistic, shot on a smartphone, natural grain. Do not alter anything else in the image.",
  },
  voiture: {
    label: "Voiture",
    emoji: "🏎️",
    prompt:
      "Replace only the vehicle with a photorealistic luxury sports car (Ferrari style) in a plausible color, keeping the exact same position, angle, perspective and scale in the scene. Preserve the background, road, lighting, weather and shadows exactly. Keep the license plate area realistic. Candid smartphone photo look, natural depth of field. Do not change anything else.",
  },
  lieu: {
    label: "Lieu",
    emoji: "🌇",
    prompt:
      "Keep the subject, their exact face, pose, outfit and body unchanged. Replace only the background with a photorealistic upscale setting (luxury rooftop restaurant at golden hour, city skyline, tasteful ambient lighting). Blend the subject naturally into the new environment with matching light direction, color temperature and soft shadows. Candid iPhone photo aesthetic, realistic, not over-processed.",
  },
};

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo
const COMPRESS_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 Mo
const MAX_DIMENSION = 1536;
const JPEG_QUALITY = 0.9;

type PreparedImage = {
  previewUrl: string;
  base64: string;
  mimeType: string;
};

function stripDataUrlPrefix(dataUrl: string): { base64: string; mimeType: string } {
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

export default function Home() {
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [category, setCategory] = useState<CategoryId>("montre");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>(""); // data URL
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setResult("");

    if (!file.type.startsWith("image/")) {
      setError("Fichier non pris en charge. Veuillez sélectionner une image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Fichier trop volumineux (max 10 Mo).");
      return;
    }

    try {
      const img = await prepareImage(file);
      setPrepared(img);
      setFileName(file.name);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Préparation de l'image impossible.",
      );
    }
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
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
        const mime = data.mimeType || "image/png";
        setResult(`data:${mime};base64,${data.imageBase64}`);
      } else {
        setError("Réponse inattendue du serveur. Réessayez.");
      }
    } catch {
      setError("Erreur réseau lors de la génération. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, [prepared, customPrompt, category]);

  const download = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result;
    a.download = "fakeit-result.png";
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

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-200 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          FakeIt
        </h1>
        <p className="mt-3 text-sm text-neutral-400 sm:text-base">
          Uploadez une photo et intégrez un élément de luxe ultra-réaliste, sans
          toucher au reste.
        </p>
      </header>

      {/* Upload zone */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
          isDragging
            ? "border-amber-400 bg-amber-400/5"
            : "border-neutral-700 bg-neutral-900/50 hover:border-neutral-500"
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
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={prepared.previewUrl}
              alt="Aperçu de l'original"
              className="max-h-64 rounded-lg object-contain shadow-lg"
            />
            <p className="text-xs text-neutral-400">
              {fileName || "Image sélectionnée"} — cliquez pour changer
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="text-4xl">📷</span>
            <p className="font-medium">
              Glissez-déposez une photo ou cliquez pour choisir
            </p>
            <p className="text-xs text-neutral-500">
              JPG, PNG, WebP… — max 10 Mo (compressée automatiquement au-delà de 2 Mo)
            </p>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="mt-6">
        <p className="mb-2 text-sm font-medium text-neutral-300">Catégorie</p>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(PRESETS) as CategoryId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                category === id
                  ? "border-amber-400 bg-amber-400/10 text-amber-200"
                  : "border-neutral-700 bg-neutral-900/50 text-neutral-300 hover:border-neutral-500"
              }`}
            >
              <span className="mr-1">{PRESETS[id].emoji}</span>
              {PRESETS[id].label}
            </button>
          ))}
        </div>
      </section>

      {/* Custom prompt */}
      <section className="mt-6">
        <label
          htmlFor="custom-prompt"
          className="mb-2 block text-sm font-medium text-neutral-300"
        >
          Prompt personnalisé{" "}
          <span className="font-normal text-neutral-500">
            (optionnel — remplace le preset choisi)
          </span>
        </label>
        <textarea
          id="custom-prompt"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={3}
          placeholder="Ex : Replace the bag with a photorealistic luxury handbag, keep everything else identical…"
          className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-900/50 p-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-amber-400"
        />
      </section>

      {/* Generate */}
      <section className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={loading || !prepared}
          className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Génération en cours… (~15-30s)" : "Générer"}
        </button>
        {prepared && (
          <button
            type="button"
            onClick={reset}
            disabled={loading}
            className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 disabled:opacity-50"
          >
            Réinitialiser
          </button>
        )}
      </section>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <span className="font-semibold">Erreur : </span>
          {error}
        </div>
      )}

      {/* Result: before / after */}
      {result && prepared && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Avant / Après</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <figure className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
              <figcaption className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Original
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={prepared.previewUrl}
                alt="Original"
                className="w-full rounded-lg object-contain"
              />
            </figure>
            <figure className="rounded-xl border border-amber-400/30 bg-neutral-900/50 p-3">
              <figcaption className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-300">
                Résultat FakeIt
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result}
                alt="Résultat généré"
                className="w-full rounded-lg object-contain"
              />
            </figure>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={download}
              className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-neutral-950 transition hover:bg-amber-300"
            >
              Télécharger
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 disabled:opacity-50"
            >
              {loading ? "Génération en cours…" : "Régénérer"}
            </button>
          </div>
        </section>
      )}

      <footer className="mt-12 text-center text-xs text-neutral-600">
        Propulsé par Google Gemini 2.5 Flash Image. Utilisez de façon responsable.
      </footer>
    </main>
  );
}
