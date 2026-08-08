import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  VIDEO_GENERATION_COST,
  refundCredits,
  spendCredits,
} from "@/lib/credits";

export const runtime = "nodejs";
export const maxDuration = 300;

const KIE_API_BASE = "https://api.kie.ai/api/v1";
const MODEL_ID = "kling-3.0/video";
const OBJECT_ELEMENT_NAME = "element_1";
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 280_000;

type GenerateVideoBody = {
  sourceImageUrl?: string;
  objectImageUrl?: string;
  prompt?: string;
};

type KieKlingElement = {
  name: string;
  description: string;
  element_input_urls: string[];
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
  sourceImageUrl: string,
  klingElements: KieKlingElement[],
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
        image_urls: [sourceImageUrl],
        mode: "pro",
        duration: "5",
        sound: false,
        multi_shots: false,
        multi_prompt: [],
        ...(klingElements.length > 0 ? { kling_elements: klingElements } : {}),
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

    // "waiting" | "queuing" | "generating" (or any other in-progress state): keep polling.
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("TIMEOUT");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.KIE_API_KEY;
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
    const taskId = await createKieTask(
      apiKey,
      finalPrompt,
      sourceImageUrl,
      klingElements,
    );
    const videoUrl = await pollKieTask(apiKey, taskId);
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
