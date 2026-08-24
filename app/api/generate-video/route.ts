import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  VIDEO_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { persistVideoFromUrl } from "@/lib/gallery-server";
import { createFalTask, pollFalTask } from "@/lib/fal-jobs";
import {
  DISALLOWED_ASSET_URL_MESSAGE,
  isAllowedAssetUrl,
} from "@/lib/url-allowlist";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL_ID = "fal-ai/kling-video/o1/video-to-video/edit";
// La photo de l'objet est transmise via `image_urls`, que Kling référence
// par `@Image1` dans le prompt (`@Element1` correspond au champ `elements`,
// que nous n'utilisons pas).
const OBJECT_REFERENCE_TAG = "Image1";
const POLL_INTERVAL_MS = 4_000;
// 230 s au lieu de 280 : le reste du budget `maxDuration` sert à
// télécharger la vidéo chez fal.ai et à la réhéberger dans notre Storage.
// Sans cette marge, une génération lente ferait expirer la fonction avant
// la persistance, et l'utilisateur se retrouverait avec une URL temporaire.
const POLL_TIMEOUT_MS = 230_000;

type GenerateVideoBody = {
  sourceVideoUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.FAL_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Missing API key. Set FAL_KEY in your environment variables.",
      },
      { status: 500 },
    );
  }

  let body: GenerateVideoBody;
  try {
    body = (await req.json()) as GenerateVideoBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request: unreadable JSON body." },
      { status: 400 },
    );
  }

  const { sourceVideoUrl, objectImageUrl, prompt, label } = body;

  if (!sourceVideoUrl || typeof sourceVideoUrl !== "string") {
    return NextResponse.json(
      { error: "Missing source video. Upload a file and try again." },
      { status: 400 },
    );
  }

  if (!objectImageUrl || typeof objectImageUrl !== "string") {
    return NextResponse.json(
      {
        error:
          "Missing replacement object photo. Upload an image and try again.",
      },
      { status: 400 },
    );
  }

  if (!prompt || !prompt.trim()) {
    return NextResponse.json(
      {
        error:
          "Missing prompt. Describe the object replacement to perform in the video.",
      },
      { status: 400 },
    );
  }

  // Anti-SSRF : ces URLs sont transmises telles quelles au fournisseur et
  // peuvent être téléchargées côté serveur. Elles doivent provenir de nos
  // hôtes d'hébergement (Supabase Storage pour la vidéo source, kie.ai pour
  // la photo de l'objet). Contrôle effectué avant tout débit de crédits.
  if (![sourceVideoUrl, objectImageUrl].every(isAllowedAssetUrl)) {
    return NextResponse.json(
      { error: DISALLOWED_ASSET_URL_MESSAGE },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to generate a video." },
      { status: 401 },
    );
  }

  let hasCredits: boolean;
  try {
    hasCredits = await spendCredits(user.id, VIDEO_GENERATION_COST);
  } catch (err) {
    console.error("Failed to check credits:", err);
    return NextResponse.json(
      { error: "Internal error while checking credits." },
      { status: 500 },
    );
  }
  if (!hasCredits) {
    return NextResponse.json(
      {
        error:
          "Insufficient credits. Go to the Pricing page to recharge your account.",
      },
      { status: 402 },
    );
  }

  const finalPrompt =
    `${prompt.trim()} Integrate the luxury replacement object shown in @${OBJECT_REFERENCE_TAG} photorealistically, ` +
    "while preserving the original motion, camera angles, lighting and background.";

  try {
    const task = await createFalTask(apiKey, MODEL_ID, {
      prompt: finalPrompt,
      video_url: sourceVideoUrl,
      image_urls: [objectImageUrl],
    });
    const resultUrl = await pollFalTask(apiKey, task, {
      intervalMs: POLL_INTERVAL_MS,
      timeoutMs: POLL_TIMEOUT_MS,
    });
    const storedUrl = await persistVideoFromUrl(
      user.id,
      resultUrl,
      label?.trim() || "Object replacement",
    );
    return NextResponse.json({ videoUrl: storedUrl });
  } catch (err) {
    await refundCredits(user.id, VIDEO_GENERATION_COST);
    if (err instanceof Error && err.message === "TIMEOUT") {
      return NextResponse.json(
        {
          error:
            "Generation took too long. Try again in a few moments.",
        },
        { status: 504 },
      );
    }
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error while generating the video.";
    return NextResponse.json(
      { error: `fal.ai video service error. ${message}` },
      { status: 502 },
    );
  }
}
