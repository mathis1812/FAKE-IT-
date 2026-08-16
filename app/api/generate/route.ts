import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  IMAGE_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { persistImageBytes } from "@/lib/gallery-server";
import { generateGeminiImage } from "@/lib/gemini-jobs";
import { PLANS, type PlanId } from "@/lib/stripe";

export const runtime = "nodejs";
export const maxDuration = 300;

type GenerateBody = {
  sourceImageUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Clé API manquante. Définissez GEMINI_API_KEY dans vos variables d'environnement.",
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  if (profileError) {
    console.error(
      `Échec de la lecture du palier pour l'utilisateur ${user.id} (repli sur 1K) :`,
      profileError.message,
    );
  }
  const planId = profile?.plan as PlanId | null | undefined;
  const resolution = planId ? PLANS[planId]?.imageResolution ?? "1K" : "1K";

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
    const { bytes, mimeType } = await generateGeminiImage(apiKey, {
      prompt: finalPrompt,
      imageUrls: imageInput,
      resolution,
    });
    const imageUrl = await persistImageBytes(
      user.id,
      bytes,
      mimeType,
      label?.trim() || "Génération image",
    );
    return NextResponse.json({ imageUrl });
  } catch (err) {
    await refundCredits(user.id, IMAGE_GENERATION_COST);
    const message =
      err instanceof Error
        ? err.message
        : "Erreur inconnue lors de la génération de l'image.";
    return NextResponse.json(
      { error: `Erreur du service de génération Gemini. ${message}` },
      { status: 502 },
    );
  }
}
