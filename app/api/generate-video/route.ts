import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL_ID = "fal-ai/kling-video/o3/standard/image-to-video";

type GenerateVideoBody = {
  sourceImageUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
};

type FalVideoResult = {
  data?: { video?: { url?: string } };
  video?: { url?: string };
};

function extractVideoUrl(result: FalVideoResult): string | null {
  return result?.data?.video?.url ?? result?.video?.url ?? null;
}

export async function POST(req: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      {
        error:
          "Clé FAL manquante. Définissez FAL_KEY dans vos variables d'environnement.",
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

  const { sourceImageUrl, objectImageUrl, prompt } = body;

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

  let finalPrompt = prompt.trim();
  if (objectImageUrl && typeof objectImageUrl === "string") {
    finalPrompt +=
      ` Use the luxury replacement object from this reference image as visual guidance: ${objectImageUrl}. ` +
      "Integrate it photorealistically while preserving the subject, pose, lighting and background.";
  }

  try {
    fal.config({ credentials: falKey });

    const result = (await fal.subscribe(MODEL_ID, {
      input: {
        image_url: sourceImageUrl,
        prompt: finalPrompt,
        duration: "5",
        generate_audio: false,
      },
      logs: true,
    })) as FalVideoResult;

    const videoUrl = extractVideoUrl(result);
    if (!videoUrl) {
      return NextResponse.json(
        {
          error:
            "Le service vidéo n'a pas renvoyé d'URL. Réessayez dans quelques instants.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ videoUrl });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur inconnue lors de la génération vidéo.";
    return NextResponse.json(
      {
        error: `Erreur du service vidéo fal.ai. ${message}`,
      },
      { status: 502 },
    );
  }
}
