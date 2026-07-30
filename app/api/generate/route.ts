import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";

const TIMEOUT_MS = 60_000;

type GeminiPart = {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
};

type GenerateBody = {
  imageBase64?: string;
  mimeType?: string;
  prompt?: string;
};

type ExtractedImage = { data: string; mimeType: string };

function extractImage(parts: GeminiPart[] | undefined): ExtractedImage | null {
  if (!parts) return null;
  for (const part of parts) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    if (data) {
      const mimeType =
        part.inlineData?.mimeType ??
        part.inline_data?.mime_type ??
        "image/png";
      return { data, mimeType };
    }
  }
  return null;
}

function extractText(parts: GeminiPart[] | undefined): string {
  if (!parts) return "";
  return parts
    .map((p) => p.text)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .join(" ")
    .trim();
}

async function callGemini(
  apiKey: string,
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
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

  const { imageBase64, mimeType, prompt } = body;

  if (!imageBase64 || !mimeType) {
    return NextResponse.json(
      { error: "Image manquante. Veuillez uploader une photo valide." },
      { status: 400 },
    );
  }

  if (!prompt || !prompt.trim()) {
    return NextResponse.json(
      { error: "Prompt manquant. Choisissez une catégorie ou saisissez un prompt." },
      { status: 400 },
    );
  }

  // Up to 2 attempts total: the model sometimes returns text (refusal/failure)
  // instead of an image, so we retry once.
  let lastText = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await callGemini(apiKey, prompt, imageBase64, mimeType);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return NextResponse.json(
          {
            error:
              "La génération a dépassé le délai de 60 secondes. Réessayez avec une image plus légère.",
          },
          { status: 504 },
        );
      }
      return NextResponse.json(
        {
          error:
            "Impossible de contacter le service de génération. Vérifiez votre connexion et réessayez.",
        },
        { status: 502 },
      );
    }

    if (!res.ok) {
      let detail = "";
      try {
        const errJson = await res.json();
        detail =
          errJson?.error?.message ??
          (typeof errJson === "string" ? errJson : JSON.stringify(errJson));
      } catch {
        detail = await res.text().catch(() => "");
      }
      return NextResponse.json(
        {
          error: `Erreur du service de génération (${res.status}). ${detail || ""}`.trim(),
        },
        { status: 502 },
      );
    }

    let json: {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    try {
      json = await res.json();
    } catch {
      return NextResponse.json(
        { error: "Réponse illisible du service de génération." },
        { status: 502 },
      );
    }

    const parts = json.candidates?.[0]?.content?.parts;
    const image = extractImage(parts);

    if (image) {
      return NextResponse.json({
        imageBase64: image.data,
        mimeType: image.mimeType,
      });
    }

    lastText =
      extractText(parts) ||
      json.promptFeedback?.blockReason ||
      lastText;
  }

  return NextResponse.json(
    {
      error:
        "Le modèle n'a pas renvoyé d'image." +
        (lastText
          ? ` Réponse du modèle : « ${lastText} »`
          : " Réessayez avec une autre image ou un autre prompt."),
    },
    { status: 422 },
  );
}
