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
import { buildScenePrompt, getScene } from "@/lib/scenes";
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
  /**
   * Scène choisie dans le catalogue (`lib/scenes.ts`). Chemin principal :
   * le prompt est figé et connu à l'avance, donc aucune analyse vision n'est
   * nécessaire — c'est ce qui retire un aller-retour réseau du parcours.
   */
  sceneId?: string;
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
  // kie.ai n'intervient plus que sur le flux « photos du lieu » (analyse
  // vision) : sa clé est donc vérifiée plus bas, au moment où ce flux est
  // effectivement emprunté. Une génération par scène ne doit pas échouer
  // pour une clé dont elle n'a pas l'usage.
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
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

  const {
    sourceImageUrl,
    sceneId,
    placeImageUrls,
    userNote,
    objectImageUrl,
    prompt,
    label,
  } = body;

  // Résolue avant l'auth et avant tout débit : un identifiant de scène
  // inconnu est une erreur de requête, pas une génération à facturer.
  const scene =
    typeof sceneId === "string" && sceneId.trim()
      ? getScene(sceneId.trim())
      : undefined;
  if (sceneId && !scene) {
    return NextResponse.json(
      { error: "Scène inconnue. Rechargez la page et réessayez." },
      { status: 400 },
    );
  }

  if (!sourceImageUrl || typeof sourceImageUrl !== "string") {
    return NextResponse.json(
      { error: "Image manquante. Uploadez une photo puis réessayez." },
      { status: 400 },
    );
  }

  const placeUrls = Array.isArray(placeImageUrls)
    ? placeImageUrls.filter((u): u is string => typeof u === "string" && !!u.trim())
    : [];

  if (placeUrls.length > MAX_PLACE_IMAGES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_PLACE_IMAGES} photos du lieu.` },
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

  // Trois flux possibles, par ordre de préférence :
  //   1. scène du catalogue — prompt figé, aucune analyse préalable ;
  //   2. photos du lieu     — prompt produit par analyse vision ;
  //   3. description libre  — la note de l'utilisateur tient lieu de prompt.
  // Il en faut au moins un, sinon le modèle n'a aucune indication de scène.
  if (!scene && placeUrls.length === 0 && (!prompt || !prompt.trim())) {
    return NextResponse.json(
      {
        error:
          "Choisissez une scène, ajoutez une photo du lieu, ou décrivez la scène souhaitée.",
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
  const note = typeof userNote === "string" ? userNote : undefined;
  let finalPrompt: string;
  if (scene) {
    // Chemin principal. Le prompt est connu sans appeler personne : on
    // économise l'aller-retour d'analyse vision (jusqu'à 45 s de timeout,
    // en série avant la génération) et le rendu devient reproductible d'un
    // utilisateur à l'autre, donc corrigeable scène par scène.
    //
    // Les éventuelles photos de lieu restent jointes en référence si
    // l'utilisateur en a fourni : le modèle les voit de toute façon, elles
    // précisent la scène sans coûter d'appel supplémentaire.
    imageInput.push(...placeUrls);
    finalPrompt = buildScenePrompt(scene, note);
  } else if (placeUrls.length > 0) {
    const kieApiKey = process.env.KIE_API_KEY?.trim();
    if (!kieApiKey) {
      await refundCredits(user.id, IMAGE_GENERATION_COST);
      return NextResponse.json(
        {
          error:
            "Clé API manquante. Définissez KIE_API_KEY dans vos variables d'environnement.",
        },
        { status: 500 },
      );
    }
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
      note,
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
        : "Erreur inconnue lors de la génération de l'image.";
    return NextResponse.json(
      { error: `Erreur du service de génération Gemini. ${message}` },
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
      // La scène nomme la génération mieux qu'un libellé générique : la
      // galerie devient lisible d'un coup d'œil.
      label?.trim() || scene?.label || "Génération image",
    );
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("Échec de la persistance de l'image générée :", err);
    await refundCredits(user.id, IMAGE_GENERATION_COST);
    return NextResponse.json(
      {
        error:
          "L'image a bien été générée mais son enregistrement a échoué. Réessayez dans quelques instants.",
      },
      { status: 502 },
    );
  }
}
