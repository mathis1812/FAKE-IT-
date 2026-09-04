import { NextRequest, NextResponse } from "next/server";
import {
  UPLOAD_RETENTION_DAYS,
  sweepExpiredUploads,
} from "@/lib/upload-cleanup";

export const runtime = "nodejs";
// Le balayage parcourt un dossier par compte. Il reste très en deçà de cette
// limite aujourd'hui, mais elle évite une coupure sans message clair le jour
// où le bucket aura grossi.
export const maxDuration = 300;

/**
 * Balayage quotidien des photos sources expirées, déclenché par le cron Vercel
 * déclaré dans `vercel.json`.
 *
 * Vercel ajoute automatiquement l'en-tête `Authorization: Bearer $CRON_SECRET`
 * à ses appels de cron dès que cette variable existe sur le projet. On la
 * vérifie ici : sans ce contrôle, l'URL serait publique et n'importe qui
 * pourrait déclencher des suppressions.
 *
 * L'absence de `CRON_SECRET` renvoie 500 plutôt que d'ouvrir la route : une
 * variable oubliée doit se voir, pas se contourner en silence.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("CRON_SECRET is not set; refusing to run the upload sweep.");
    return NextResponse.json(
      { error: "Server misconfigured: missing CRON_SECRET." },
      { status: 500 },
    );
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await sweepExpiredUploads();
    console.log(
      `Upload sweep: ${result.deleted} deleted of ${result.scanned} scanned, ${result.failedFolders} folder(s) failed.`,
    );
    return NextResponse.json({
      ok: true,
      retentionDays: UPLOAD_RETENTION_DAYS,
      ...result,
    });
  } catch (err) {
    console.error("Upload sweep failed:", err);
    return NextResponse.json({ error: "Upload sweep failed." }, { status: 500 });
  }
}
