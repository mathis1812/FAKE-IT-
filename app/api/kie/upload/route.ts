import { NextRequest, NextResponse } from "next/server";
// L'endpoint vit dans lib/url-allowlist.ts : la liste blanche des hôtes de
// téléchargement en dérive son hostname, les deux ne peuvent pas diverger.
import { KIE_UPLOAD_URL } from "@/lib/url-allowlist";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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

  let incomingForm: FormData;
  try {
    incomingForm = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : formulaire illisible." },
      { status: 400 },
    );
  }

  const file = incomingForm.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Fichier manquant. Envoyez un champ 'file'." },
      { status: 400 },
    );
  }

  const uploadForm = new FormData();
  uploadForm.append("file", file, file.name);
  uploadForm.append("uploadPath", "bluminoo-uploads");

  let res: Response;
  try {
    res = await fetch(KIE_UPLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Impossible de contacter le service d'upload. Vérifiez votre connexion et réessayez.",
      },
      { status: 502 },
    );
  }

  let json: {
    success?: boolean;
    msg?: string;
    data?: { downloadUrl?: string };
  };
  try {
    json = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Réponse illisible du service d'upload." },
      { status: 502 },
    );
  }

  if (!res.ok || !json.success || !json.data?.downloadUrl) {
    return NextResponse.json(
      {
        error: `Échec de l'upload (${res.status}). ${json.msg ?? ""}`.trim(),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ fileUrl: json.data.downloadUrl });
}
