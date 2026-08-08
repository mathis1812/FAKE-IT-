import { NextRequest, NextResponse } from "next/server";
import {
  VIDEO_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";
import { saveVideoGalleryEntry } from "@/lib/gallery-server";
import { requireUser } from "@/lib/supabase/require-user";
import { isOwnedGalleryPublicUrl } from "@/lib/storage-urls";

export const runtime = "nodejs";
export const maxDuration = 300;

const KIE_API_BASE = "https://api.kie.ai/api/v1";
const MODEL_ID = "wan/2-7-videoedit";
const POLL_INTERVAL_MS = 4_000;
// Marge sous maxDuration=300s : la galerie est fire-and-forget.
const POLL_TIMEOUT_MS = 270_000;

type GenerateVideoBody = {
  sourceVideoUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
  label?: string;
};

type KieCreateTaskResponse = {
  code: number;
  msg?: string;
  data?: { taskId?: string };
};

type KieTaskStatusResponse = {
  code: number;
  msg?: string;
  data?: {
    state?: "waiting" | "queuing" | "generating" | "success" | "fail";
    resultJson?: string;
    failMsg?: string;
  };
};

type KieVideoResult = { resultUrls?: string[] };

async function createKieTask(
  apiKey: string,
  prompt: string,
  sourceVideoUrl: string,
  objectImageUrl?: string,
): Promise<string> {
  const res = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_ID,
      input: {
        prompt,
        video_url: sourceVideoUrl,
        ...(objectImageUrl ? { reference_image: objectImageUrl } : {}),
        resolution: "1080p",
        duration: 0,
        audio_setting: "origin",
        prompt_extend: true,
        watermark: false,
      },
    }),
  });

  const json = (await res.json()) as KieCreateTaskResponse;
  if (!res.ok || json.code !== 200 || !json.data?.taskId) {
    throw new Error(
      json.msg || `Erreur kie.ai (${res.status}) à la création de la tâche.`,
    );
  }
  return json.data.taskId;
}

async function pollKieTask(apiKey: string, taskId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(
      `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    const json = (await res.json()) as KieTaskStatusResponse;

    if (!res.ok || json.code !== 200) {
      throw new Error(
        json.msg || `Erreur kie.ai (${res.status}) en interrogeant la tâche.`,
      );
    }

    if (json.data?.state === "success") {
      const result = JSON.parse(
        json.data.resultJson ?? "{}",
      ) as KieVideoResult;
      const videoUrl = result.resultUrls?.[0];
      if (!videoUrl) {
        throw new Error(
          "La tâche a réussi mais aucune vidéo n'a été renvoyée.",
        );
      }
      return videoUrl;
    }

    if (json.data?.state === "fail") {
      throw new Error(
        json.data.failMsg || "La génération vidéo a échoué côté kie.ai.",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("TIMEOUT");
}

export async function POST(req: NextRequest) {
  let body: GenerateVideoBody;
  try {
    body = (await req.json()) as GenerateVideoBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const { sourceVideoUrl, objectImageUrl, prompt, label } = body;

  if (!sourceVideoUrl || typeof sourceVideoUrl !== "string") {
    return NextResponse.json(
      {
        error:
          "Vidéo source manquante. Uploadez une vidéo puis réessayez.",
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

  const auth = await requireUser("Connectez-vous pour générer une vidéo.");
  if (auth.error) return auth.error;
  const { user } = auth;

  if (!isOwnedGalleryPublicUrl(sourceVideoUrl, user.id)) {
    return NextResponse.json(
      {
        error:
          "Vidéo source invalide. Ré-uploadez le fichier depuis le Studio puis réessayez.",
      },
      { status: 400 },
    );
  }

  if (
    objectImageUrl &&
    typeof objectImageUrl === "string" &&
    !isOwnedGalleryPublicUrl(objectImageUrl, user.id)
  ) {
    return NextResponse.json(
      {
        error:
          "Image objet invalide. Ré-uploadez le fichier depuis le Studio puis réessayez.",
      },
      { status: 400 },
    );
  }

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
  if (objectImageUrl && typeof objectImageUrl === "string") {
    finalPrompt +=
      " Integrate the luxury replacement object shown in the reference image photorealistically, " +
      "while preserving the subject, motion, camera movement, lighting and background.";
  }

  try {
    const taskId = await createKieTask(
      apiKey,
      finalPrompt,
      sourceVideoUrl,
      objectImageUrl && typeof objectImageUrl === "string"
        ? objectImageUrl
        : undefined,
    );
    const videoUrl = await pollKieTask(apiKey, taskId);
    void saveVideoGalleryEntry(
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
