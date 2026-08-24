import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  IMAGE_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { persistImageBytes } from "@/lib/gallery-server";
import { generateGeminiImage } from "@/lib/gemini-jobs";
import { buildPlacePrompt } from "@/lib/place-prompt";
import { PLANS, type PlanId } from "@/lib/stripe";
import {
  DISALLOWED_ASSET_URL_MESSAGE,
  isAllowedAssetUrl,
} from "@/lib/url-allowlist";

export const runtime = "nodejs";
// 300 s : la génération photo avait été passée de 100 s à 280 s le
// 10/08 après des dépassements réels. Ne pas revenir à 120 s.
export const maxDuration = 300;

const MAX_PLACE_IMAGES = 3;

type GenerateBody = {
  sourceImageUrl?: string;
  /** 1 à 3 photos du lieu réel où intégrer le sujet. */
  placeImageUrls?: string[];
  /** Note libre optionnelle de l'utilisateur, intégrée au prompt généré. */
  userNote?: string;
  /** Ancien flux (objet + prompt libre) — conservé pour compatibilité. */
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
};

export async function POST(req: NextRequest) {
  // Deux fournisseurs distincts : kie.ai analyse les photos du lieu et
  // héberge les uploads, Gemini génère l'image.
  const kieApiKey = process.env.KIE_API_KEY?.trim();
  if (!kieApiKey) {
    return NextResponse.json(
      {
        error:
          "Missing API key. Set KIE_API_KEY in your environment variables.",
      },
      { status: 500 },
    );
  }

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    return NextResponse.json(
      {
        error:
          "Missing API key. Set GEMINI_API_KEY in your environment variables.",
      },
      { status: 500 },
    );
  }

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid request: unreadable JSON body." },
      { status: 400 },
    );
  }

  const { sourceImageUrl, placeImageUrls, userNote, objectImageUrl, prompt, label } =
    body;

  if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
    return NextResponse.json(
      { error: "Missing image. Upload a photo and try again." },
      { status: 400 },
    );
  }

  const placeUrls = Array.isArray(placeImageUrls)
    ? placeImageUrls.filter((u): u is string => typeof u === "string" && !!u.trim())
    : [];

  if (placeUrls.length > MAX_PLACE_IMAGES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PLACE_IMAGES} place photos.` },
      { status: 400 },
    );
  }

  // Anti-SSRF : c'est notre fonction Vercel qui télécharge ces URLs pour les
  // envoyer inline à Gemini. Toutes doivent pointer vers un hôte
  // d'hébergement connu, et le contrôle a lieu ici — avant toute
  // authentification et surtout avant tout débit de crédits.
  const candidateUrls = [sourceImageUrl, ...placeUrls];
  if (objectImageUrl && typeof objectImageUrl === "string") {
    candidateUrls.push(objectImageUrl);
  }
  if (!candidateUrls.every(isAllowedAssetUrl)) {
    return NextResponse.json(
      { error: DISALLOWED_ASSET_URL_MESSAGE },
      { status: 400 },
    );
  }

  // Les photos du lieu sont facultatives. Deux flux possibles : avec photos
  // de lieu, le prompt est généré automatiquement par analyse vision ; sans
  // elles, la description libre de l'utilisateur tient lieu de prompt. Il
  // faut l'un ou l'autre, sinon le modèle n'a aucune indication de scène.
  if (placeUrls.length === 0 && (!prompt || !prompt.trim())) {
    return NextResponse.json(
      {
        error:
          "Add a place photo or describe the desired scene in the note.",
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
      { error: "Sign in to generate an image." },
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
      `Failed to read plan for user ${user.id} (falling back to 1K):`,
      profileError.message,
    );
  }
  const planId = profile?.plan as PlanId | null | undefined;
  const resolution = planId ? PLANS[planId]?.imageResolution ?? "1K" : "1K";

  let hasCredits: boolean;
  try {
    hasCredits = await spendCredits(user.id, IMAGE_GENERATION_COST);
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

  const imageInput = [sourceImageUrl];
  let finalPrompt: string;
  if (placeUrls.length > 0) {
    imageInput.push(...placeUrls);
    // Étape d'analyse : un modèle vision examine les photos du lieu
    // (éclairage, matériaux, ambiance, angle) et produit un prompt structuré.
    // buildPlacePrompt rattrape ses propres erreurs et retombe sur un prompt
    // de secours : il ne peut donc pas lever, ce qui autorise cet appel hors
    // du try/catch de remboursement. Ne pas casser cette propriété.
    finalPrompt = await buildPlacePrompt(
      kieApiKey,
      sourceImageUrl,
      placeUrls,
      typeof userNote === "string" ? userNote : undefined,
    );
  } else {
    finalPrompt = (prompt as string).trim();
    if (objectImageUrl && typeof objectImageUrl === "string") {
      imageInput.push(objectImageUrl);
      finalPrompt +=
        " Integrate the reference object shown in the second image photorealistically, " +
        "while preserving the subject, pose, lighting and background from the first image.";
    }
  }

  let bytes: Buffer;
  let mimeType: string;
  try {
    const generated = await generateGeminiImage(geminiApiKey, {
      prompt: finalPrompt,
      imageUrls: imageInput,
      resolution,
    });
    bytes = generated.bytes;
    mimeType = generated.mimeType;
  } catch (err) {
    await refundCredits(user.id, IMAGE_GENERATION_COST);
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error while generating the image.";
    return NextResponse.json(
      { error: `Gemini generation service error. ${message}` },
      { status: 502 },
    );
  }

  // Étape séparée : Gemini a déjà généré (et facturé) l'image à ce stade.
  // Une panne ici est un problème de stockage Supabase, pas une erreur
  // Gemini — ne pas la faire passer pour telle, et ne pas exposer le détail
  // d'infra brut au client.
  try {
    const imageUrl = await persistImageBytes(
      user.id,
      bytes,
      mimeType,
      label?.trim() || "Image generation",
    );
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Failed to save the generated image:", err);
    await refundCredits(user.id, IMAGE_GENERATION_COST);
    return NextResponse.json(
      {
        error:
          "The image was generated successfully but saving failed. Try again in a few moments.",
      },
      { status: 502 },
    );
  }
}
