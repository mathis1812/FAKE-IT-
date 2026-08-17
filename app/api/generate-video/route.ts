import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  VIDEO_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { saveVideoGalleryEntry } from "@/lib/gallery-server";
import {
  createAlephTask,
  pollAlephTask,
  nearestAspectRatio,
} from "@/lib/aleph-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 280_000;

type GenerateVideoBody = {
  sourceVideoUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
  sourceVideoWidth?: number;
  sourceVideoHeight?: number;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.KIE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Clé API manquante. Définissez KIE_API_KEY dans vos variables d'environnement.",
      },
      { status: 500 },
    );
  }

  let body: GenerateVideoBody;
  try {
    body = (await req.json()) as GenerateVideoBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const {
    sourceVideoUrl,
    objectImageUrl,
    prompt,
    label,
    sourceVideoWidth,
    sourceVideoHeight,
  } = body;

  if (!sourceVideoUrl || typeof sourceVideoUrl !== "string") {
    return NextResponse.json(
      { error: "Vidéo source manquante. Uploadez un fichier puis réessayez." },
      { status: 400 },
    );
  }

  if (!objectImageUrl || typeof objectImageUrl !== "string") {
    return NextResponse.json(
      {
        error:
          "Photo de l'objet de remplacement manquante. Uploadez une image puis réessayez.",
      },
      { status: 400 },
    );
  }

  if (!prompt || !prompt.trim()) {
    return NextResponse.json(
      {
        error:
          "Prompt manquant. Décrivez le remplacement d'objet à réaliser dans la vidéo.",
      },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Connectez-vous pour générer une vidéo." },
      { status: 401 },
    );
  }

  let hasCredits: boolean;
  try {
    hasCredits = await spendCredits(user.id, VIDEO_GENERATION_COST);
  } catch (err) {
    console.error("Échec de la vérification des crédits :", err);
    return NextResponse.json(
      { error: "Erreur interne lors de la vérification des crédits." },
      { status: 500 },
    );
  }
  if (!hasCredits) {
    return NextResponse.json(
      {
        error:
          "Crédits insuffisants. Rendez-vous sur la page Tarifs pour recharger votre compte.",
      },
      { status: 402 },
    );
  }

  const finalPrompt =
    `${prompt.trim()} Integrate the luxury replacement object from the reference image photorealistically, ` +
    "while preserving the original motion, camera angles, lighting and background.";

  try {
    const taskId = await createAlephTask(apiKey, {
      prompt: finalPrompt,
      videoUrl: sourceVideoUrl,
      referenceImage: objectImageUrl,
      aspectRatio: nearestAspectRatio(
        sourceVideoWidth ?? 0,
        sourceVideoHeight ?? 0,
      ),
    });
    const resultUrl = await pollAlephTask(apiKey, taskId, {
      intervalMs: POLL_INTERVAL_MS,
      timeoutMs: POLL_TIMEOUT_MS,
    });
    await saveVideoGalleryEntry(
      user.id,
      resultUrl,
      label?.trim() || "Remplacement d'objet",
    );
    return NextResponse.json({ videoUrl: resultUrl });
  } catch (err) {
    await refundCredits(user.id, VIDEO_GENERATION_COST);
    if (err instanceof Error && err.message === "TIMEOUT") {
      return NextResponse.json(
        {
          error:
            "La génération a dépassé le délai imparti. Réessayez dans quelques instants.",
        },
        { status: 504 },
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : "Erreur inconnue lors de la génération vidéo.";
    return NextResponse.json(
      { error: `Erreur du service vidéo Runway Aleph. ${message}` },
      { status: 502 },
    );
  }
}
