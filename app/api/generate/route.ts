import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refundCredits, spendCredits } from "@/lib/credits";
import { persistImageBytes } from "@/lib/gallery-server";
import { assessTemplateResult, generateGeminiImage } from "@/lib/gemini-jobs";
import { buildPlacePrompt, buildScenePrompt } from "@/lib/place-prompt";
import {
  asPlanId,
  isQualityOpen,
  photoCost,
  QUALITY_LABEL,
  TEMPLATE_QUALITY,
  type ImageQuality,
} from "@/lib/generation-tiers";
import {
  resolveTemplatePrompt,
  getQualityCheck,
  STYLE_REFERENCE_INSTRUCTION,
  templateLocksAspectRatio,
  templateUsesStyleReference,
} from "@/lib/template-prompts";
import { findTemplate } from "@/lib/templates";
import {
  DISALLOWED_ASSET_URL_MESSAGE,
  isAllowedAssetUrl,
} from "@/lib/url-allowlist";

export const runtime = "nodejs";
// 300 s : la génération photo avait été passée de 100 s à 280 s le
// 10/08 après des dépassements réels. Ne pas revenir à 120 s.
export const maxDuration = 300;

const MAX_PLACE_IMAGES = 3;

/**
 * Charge l'exemple de rendu d'un gabarit depuis `public/` et le renvoie en
 * data URL, prêt à être joint comme seconde image (référence de style).
 * Lecture disque locale : pas de réseau, donc hors allowlist SSRF (ce n'est
 * pas une URL fournie par l'utilisateur). Renvoie `null` si le fichier
 * manque — on génère alors sans référence plutôt que d'échouer.
 */
async function loadTemplateStyleReference(
  templateSlug: string,
): Promise<string | null> {
  const template = findTemplate(templateSlug);
  if (!template) return null;

  const relativePath = template.exampleImage.replace(/^\//, "");
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", relativePath));
    const ext = path.extname(relativePath).toLowerCase();
    const mimeType =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : "image/jpeg";
    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

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
  /**
   * Flux gabarit : le client n'envoie que des identifiants, le prompt est
   * résolu ici. Une prop passée à un composant client finit sérialisée dans
   * le HTML servi ; envoyer le prompt depuis le navigateur reviendrait à le
   * publier, alors que le produit le garde caché.
   */
  templateSlug?: string;
  variantSlug?: string;
  /** Qualité demandée par le studio libre : "normal" | "high" | "max". */
  quality?: string;
};

export async function POST(req: NextRequest) {
  // Un seul fournisseur sur le chemin de génération depuis le 25/08 :
  // Gemini analyse les photos du lieu et génère l'image en une passe. kie.ai
  // ne sert plus qu'à héberger les uploads, via app/api/kie/upload, qui
  // vérifie sa propre clé.
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

  const {
    sourceImageUrl,
    placeImageUrls,
    userNote,
    objectImageUrl,
    label,
    templateSlug,
    variantSlug,
  } = body;

  // Un gabarit impose son prompt : celui que le client aurait pu joindre est
  // ignoré, jamais fusionné. Un gabarit inconnu, ou une variante manquante,
  // est refusé plutôt que rabattu sur le prompt libre — sinon un mauvais
  // identifiant produirait silencieusement autre chose que ce qui est
  // montré à l'écran.
  let prompt = body.prompt;
  if (typeof templateSlug === "string" && templateSlug.trim()) {
    const resolved = resolveTemplatePrompt(
      templateSlug,
      typeof variantSlug === "string" && variantSlug.trim()
        ? variantSlug
        : undefined,
    );
    if (!resolved) {
      return NextResponse.json(
        { error: "Unknown template. Pick one from the templates list." },
        { status: 400 },
      );
    }
    prompt = resolved;
  }

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
  const planId = asPlanId(profile?.plan as string | null | undefined);

  // Qualité et coût. Un gabarit force le 2K quel que soit le palier (comme le
  // modèle, CRAN_TEMPLATE = "high") : son rendu de référence doit sortir au
  // même niveau pour tous. Le studio libre suit la qualité demandée — mais
  // elle est VALIDÉE ici contre le palier. L'UI verrouille déjà les crans
  // interdits ; ce contrôle rattrape une requête falsifiée, sinon un client
  // obtiendrait le 4K sans le payer en palier.
  const isTemplateRequest =
    typeof templateSlug === "string" && templateSlug.trim().length > 0;
  // Ratio de sortie forcé uniquement pour les univers (re-rendu complet).
  // Sur un swap véhicule / prank, forcer `imageConfig.aspectRatio` fait
  // recomposer toute l'image au modèle d'édition. Cf. templateLocksAspectRatio.
  const lockAspectRatio =
    isTemplateRequest && templateLocksAspectRatio(templateSlug as string);
  let quality: ImageQuality;
  if (isTemplateRequest) {
    quality = TEMPLATE_QUALITY;
  } else {
    const requested = body.quality;
    quality =
      requested === "high" || requested === "max" ? requested : "normal";
    if (!isQualityOpen(quality, planId)) {
      return NextResponse.json(
        { error: "This resolution isn't included in your plan." },
        { status: 403 },
      );
    }
  }
  const resolution = QUALITY_LABEL[quality];
  const cost = photoCost(quality);

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

  // Un gabarit porte un prompt complet, déjà rédigé pour l'opération voulue
  // (ex. remplacer le véhicule visible par un modèle donné). Le repasser
  // dans buildScenePrompt lui ajouterait « garde le même sujet
  // reconnaissable », qui contredirait un remplacement d'identité — cette
  // ligne n'a de sens que pour la description libre du studio, écrite sans
  // ce socle.
  const imageInput = [sourceImageUrl];
  let finalPrompt: string;
  if (isTemplateRequest) {
    finalPrompt = (prompt as string).trim();
    // Univers (Minecraft, LEGO, GTA V) : joindre l'exemple de rendu comme
    // référence de style améliore nettement la fidélité — plus que
    // n'importe quel ajout au prompt. Le studio libre et les pranks
    // n'en ont pas besoin (ils éditent la scène réelle).
    if (templateSlug && templateUsesStyleReference(templateSlug)) {
      const styleRef = await loadTemplateStyleReference(templateSlug);
      if (styleRef) {
        imageInput.push(styleRef);
        finalPrompt += STYLE_REFERENCE_INSTRUCTION;
      }
    }
  } else if (placeUrls.length > 0) {
    imageInput.push(...placeUrls);
    // Gemini reçoit les photos du lieu et fait l'analyse lui-même : le prompt
    // porte la grille de critères (lumière, matières, angle, profondeur de
    // champ) autrefois confiée à un appel vision séparé. Purement local, sans
    // appel réseau : ne peut pas lever, d'où sa place hors du try/catch de
    // remboursement. Ne pas casser cette propriété.
    finalPrompt = buildPlacePrompt(
      typeof userNote === "string" ? userNote : undefined,
    );
  } else if (objectImageUrl && typeof objectImageUrl === "string") {
    // Ancien flux d'ajout d'objet : édition sur place, l'arrière-plan
    // d'origine est conservé. Il ne passe pas par buildScenePrompt, qui
    // demande au contraire de construire un décor — les deux se
    // contrediraient.
    imageInput.push(objectImageUrl);
    finalPrompt =
      (prompt as string).trim() +
      " Integrate the reference object shown in the second image photorealistically, " +
      "while preserving the subject, pose, lighting and background from the first image.";
  } else {
    // Sans photo de lieu, la description libre du client est la seule
    // indication disponible. Elle est encadrée par le même socle de
    // photoréalisme plutôt que d'être envoyée telle quelle.
    finalPrompt = buildScenePrompt(prompt as string);
  }

  let bytes: Buffer;
  let mimeType: string;
  try {
    const generated = await generateGeminiImage(geminiApiKey, {
      prompt: finalPrompt,
      imageUrls: imageInput,
      resolution,
      // Voir lockAspectRatio ci-dessus : verrou de cadrage pour les univers
      // seulement. Swap véhicule / prank = édition libre (comme le studio).
      matchFirstImageAspect: lockAspectRatio,
    });
    bytes = generated.bytes;
    mimeType = generated.mimeType;

    // Contrôle qualité + une seule régénération, pour les gabarits qui en
    // déclarent un (univers). Best-effort : le juge ne peut que déclencher un
    // retry, jamais faire échouer une génération déjà obtenue. Le retry ne
    // re-débite pas de crédits — c'est le même acte de génération, réessayé.
    const qualityCheck = templateSlug ? getQualityCheck(templateSlug) : null;
    if (qualityCheck) {
      const passed = await assessTemplateResult(geminiApiKey, {
        imageBytes: bytes,
        mimeType,
        criteria: qualityCheck.criteria,
      });
      if (!passed) {
        const retried = await generateGeminiImage(geminiApiKey, {
          prompt: `${finalPrompt}\n\n${qualityCheck.retrySuffix}`,
          imageUrls: imageInput,
          resolution,
          matchFirstImageAspect: lockAspectRatio,
        });
        bytes = retried.bytes;
        mimeType = retried.mimeType;
      }
    }
  } catch (err) {
    await refundCredits(user.id, cost);
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
    await refundCredits(user.id, cost);
    return NextResponse.json(
      {
        error:
          "The image was generated successfully but saving failed. Try again in a few moments.",
      },
      { status: 502 },
    );
  }
}
