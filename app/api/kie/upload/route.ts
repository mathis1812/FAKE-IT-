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
          "Missing API key. Set KIE_API_KEY in your environment variables.",
      },
      { status: 500 },
    );
  }

  let incomingForm: FormData;
  try {
    incomingForm = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request: unreadable form." },
      { status: 400 },
    );
  }

  const file = incomingForm.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file. Send a 'file' field." },
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
          "Unable to contact the upload service. Check your connection and try again.",
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
      { error: "Unreadable response from the upload service." },
      { status: 502 },
    );
  }

  if (!res.ok || !json.success || !json.data?.downloadUrl) {
    return NextResponse.json(
      {
        error: `Upload failed (${res.status}). ${json.msg ?? ""}`.trim(),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ fileUrl: json.data.downloadUrl });
}
