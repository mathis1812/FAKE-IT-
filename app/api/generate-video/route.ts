import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refundCredits, spendCredits } from "@/lib/credits";
import { persistVideoFromUrl } from "@/lib/gallery-server";
import { createFalTask, pollFalTask } from "@/lib/fal-jobs";
import { buildSeedanceInput, SEEDANCE_MODEL_ID } from "@/lib/seedance";
import {
  asPlanId,
  isVideoOpen,
  VIDEO_DURATIONS,
  videoCost,
  type VideoDuration,
} from "@/lib/generation-tiers";
import {
  DISALLOWED_ASSET_URL_MESSAGE,
  isAllowedAssetUrl,
} from "@/lib/url-allowlist";

export const runtime = "nodejs";
export const maxDuration = 300;

const POLL_INTERVAL_MS = 4_000;
// 230 s au lieu de 280 : le reste du budget `maxDuration` sert à
// télécharger la vidéo chez fal.ai et à la réhéberger dans notre Storage.
// Sans cette marge, une génération lente ferait expirer la fonction avant
// la persistance, et l'utilisateur se retrouverait avec une URL temporaire.
const POLL_TIMEOUT_MS = 230_000;

const MAX_PROMPT_LENGTH = 500;

type GenerateVideoBody = {
  sourceImageUrl?: string;
  prompt?: string;
  duration?: number;
  label?: string;
};

/**
 * Photo → vidéo, sur Seedance 2.5 via la queue fal.ai.
 *
 * Remplace la route Kling de remplacement d'objet dans une vidéo existante,
 * qui n'avait aucun appelant depuis la migration et savait pourtant débiter
 * des crédits.
 *
 * L'ordre des contrôles n'est pas indifférent : entrées, liste blanche,
 * palier, et le débit seulement ensuite. Tout ce qui peut refuser la requête
 * le fait avant qu'un seul crédit ne bouge.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.FAL_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing API key. Set FAL_KEY in your environment variables." },
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

  const { sourceImageUrl, prompt, duration, label } = body;

  if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
    return NextResponse.json(
      { error: "Missing source photo. Upload an image and try again." },
      { status: 400 },
    );
  }

  if (!prompt || !prompt.trim()) {
    return NextResponse.json(
      { error: "Describe the motion you want in the video." },
      { status: 400 },
    );
  }

  if (prompt.trim().length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Description too long (max ${MAX_PROMPT_LENGTH} characters).` },
      { status: 400 },
    );
  }

  // La durée est validée contre la liste, jamais reprise telle quelle : elle
  // pilote directement ce que fal.ai nous facture. Une valeur falsifiée à 30
  // coûterait plus de six fois le tarif d'un 4 s, débité au prix d'un 4 s.
  if (!VIDEO_DURATIONS.includes(duration as VideoDuration)) {
    return NextResponse.json(
      {
        error: `Invalid duration. Choose ${VIDEO_DURATIONS.join(", ")} seconds.`,
      },
      { status: 400 },
    );
  }
  const videoDuration = duration as VideoDuration;

  // Anti-SSRF : cette URL est transmise au fournisseur, qui la télécharge.
  // Elle doit provenir de notre Storage. Contrôle effectué avant tout débit.
  if (!isAllowedAssetUrl(sourceImageUrl)) {
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  if (profileError) {
    console.error(
      `Failed to read plan for user ${user.id}:`,
      profileError.message,
    );
  }
  const planId = asPlanId(profile?.plan as string | null | undefined);

  // La vidéo est réservée aux paliers Pro et Max. L'interface masque déjà le
  // mode aux autres ; ce contrôle rattrape une requête falsifiée, sinon un
  // compte sans palier obtiendrait la génération la plus chère du produit.
  if (!isVideoOpen(planId)) {
    return NextResponse.json(
      { error: "Video is available on the Pro and Max plans." },
      { status: 403 },
    );
  }

  const cost = videoCost(videoDuration);

  let hasCredits: boolean;
  try {
    hasCredits = await spendCredits(user.id, cost);
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

  try {
    const task = await createFalTask(
      apiKey,
      SEEDANCE_MODEL_ID,
      buildSeedanceInput({
        imageUrl: sourceImageUrl,
        prompt: prompt.trim(),
        duration: videoDuration,
      }),
    );
    const resultUrl = await pollFalTask(apiKey, task, {
      intervalMs: POLL_INTERVAL_MS,
      timeoutMs: POLL_TIMEOUT_MS,
    });
    const storedUrl = await persistVideoFromUrl(
      user.id,
      resultUrl,
      label?.trim() || "Video generation",
    );
    return NextResponse.json({ videoUrl: storedUrl });
  } catch (err) {
    await refundCredits(user.id, cost);
    if (err instanceof Error && err.message === "TIMEOUT") {
      return NextResponse.json(
        { error: "Generation took too long. Try again in a few moments." },
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
