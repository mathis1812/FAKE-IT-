import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  IMAGE_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { persistImageResult } from "@/lib/gallery-server";
import { createKieTask, pollKieTask } from "@/lib/kie-jobs";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL_ID = "nano-banana-pro";
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 100_000;

type GenerateBody = {
  sourceImageUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
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

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const { sourceImageUrl, objectImageUrl, prompt, label } = body;

  if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
    return NextResponse.json(
      { error: "Image manquante. Uploadez une photo puis réessayez." },
      { status: 400 },
    );
  }

  if (!prompt || !prompt.trim()) {
    return NextResponse.json(
      { error: "Prompt manquant. Décrivez la transformation souhaitée." },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Connectez-vous pour générer une image." },
      { status: 401 },
    );
  }

  let hasCredits: boolean;
  try {
    hasCredits = await spendCredits(user.id, IMAGE_GENERATION_COST);
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

  const imageInput = [sourceImageUrl];
  let finalPrompt = prompt.trim();
  if (objectImageUrl && typeof objectImageUrl === "string") {
    imageInput.push(objectImageUrl);
    finalPrompt +=
      " Integrate the reference object shown in the second image photorealistically, " +
      "while preserving the subject, pose, lighting and background from the first image.";
  }

  try {
    const taskId = await createKieTask(apiKey, MODEL_ID, {
      prompt: finalPrompt,
      image_input: imageInput,
      aspect_ratio: "auto",
      resolution: "1K",
      output_format: "png",
    });
    const resultUrl = await pollKieTask(apiKey, taskId, {
      intervalMs: POLL_INTERVAL_MS,
      timeoutMs: POLL_TIMEOUT_MS,
    });
    const imageUrl = await persistImageResult(
      user.id,
      resultUrl,
      label?.trim() || "Génération image",
    );
    return NextResponse.json({ imageUrl });
  } catch (err) {
    await refundCredits(user.id, IMAGE_GENERATION_COST);
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
        : "Erreur inconnue lors de la génération de l'image.";
    return NextResponse.json(
      { error: `Erreur du service de génération kie.ai. ${message}` },
      { status: 502 },
    );
  }
}
