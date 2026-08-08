import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const VIDEO_MIME = new Set(["video/mp4", "video/quicktime"]);
const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

type SignBody = {
  filename?: string;
  contentType?: string;
  byteSize?: number;
  kind?: "video" | "image";
};

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Connectez-vous pour uploader un fichier." },
      { status: 401 },
    );
  }

  let body: SignBody;
  try {
    body = (await req.json()) as SignBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const { filename, contentType, byteSize, kind } = body;

  if (!filename || !contentType || typeof byteSize !== "number" || !kind) {
    return NextResponse.json(
      {
        error:
          "Paramètres manquants. Attendu : filename, contentType, byteSize, kind.",
      },
      { status: 400 },
    );
  }

  if (kind !== "video" && kind !== "image") {
    return NextResponse.json(
      { error: "kind doit être « video » ou « image »." },
      { status: 400 },
    );
  }

  const allowed = kind === "video" ? VIDEO_MIME : IMAGE_MIME;
  if (!allowed.has(contentType)) {
    return NextResponse.json(
      {
        error:
          kind === "video"
            ? "Format vidéo non supporté. Utilisez MP4 ou MOV."
            : "Format image non supporté. Utilisez JPG, PNG ou WebP.",
      },
      { status: 400 },
    );
  }

  const maxBytes = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (byteSize <= 0 || byteSize > maxBytes) {
    return NextResponse.json(
      {
        error:
          kind === "video"
            ? "Vidéo trop volumineuse (max 50 Mo)."
            : "Image trop volumineuse (max 10 Mo).",
      },
      { status: 400 },
    );
  }

  const safeName = sanitizeFilename(filename);
  const path = `uploads/${user.id}/${Date.now()}-${safeName}`;

  let service;
  try {
    service = createServiceClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Stockage indisponible. Vérifiez la configuration Supabase (service role).",
      },
      { status: 500 },
    );
  }

  const { data, error } = await service.storage
    .from("gallery")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Échec createSignedUploadUrl :", error?.message);
    return NextResponse.json(
      { error: "Impossible de préparer l'upload. Réessayez." },
      { status: 502 },
    );
  }

  const {
    data: { publicUrl },
  } = service.storage.from("gallery").getPublicUrl(path);

  return NextResponse.json({
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    publicUrl,
  });
}
