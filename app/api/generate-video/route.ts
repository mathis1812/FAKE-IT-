import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  VIDEO_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { saveVideoGalleryEntry } from "@/lib/gallery-server";
import { createKieTask, pollKieTask } from "@/lib/kie-jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL_ID = "kling-3.0/video";
const OBJECT_ELEMENT_NAME = "element_1";
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 280_000;

type GenerateVideoBody = {
  sourceImageUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
};

type KieKlingElement = {
  name: string;
  description: string;
  element_input_urls: string[];
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

  const { sourceImageUrl, objectImageUrl, prompt, label } = body;

  if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
    return NextResponse.json(
      { error: "Image source manquante. Uploadez une image puis réessayez." },
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

  let finalPrompt = prompt.trim();
  const klingElements: KieKlingElement[] = [];
  if (objectImageUrl && typeof objectImageUrl === "string") {
    klingElements.push({
      name: OBJECT_ELEMENT_NAME,
      description: "Luxury replacement object to integrate into the scene.",
      element_input_urls: [objectImageUrl],
    });
    finalPrompt +=
      ` Integrate the luxury replacement object shown in @${OBJECT_ELEMENT_NAME} photorealistically, ` +
      "while preserving the subject, pose, lighting and background.";
  }

  try {
    const taskId = await createKieTask(apiKey, MODEL_ID, {
      prompt: finalPrompt,
      image_urls: [sourceImageUrl],
      mode: "pro",
      duration: "5",
      sound: false,
      multi_shots: false,
      multi_prompt: [],
      ...(klingElements.length > 0 ? { kling_elements: klingElements } : {}),
    });
    const videoUrl = await pollKieTask(apiKey, taskId, {
      intervalMs: POLL_INTERVAL_MS,
      timeoutMs: POLL_TIMEOUT_MS,
    });
    await saveVideoGalleryEntry(
      user.id,
      videoUrl,
      label?.trim() || "Remplacement d'objet",
    );
    return NextResponse.json({ videoUrl });
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
      { error: `Erreur du service vidéo kie.ai. ${message}` },
      { status: 502 },
    );
  }
}
