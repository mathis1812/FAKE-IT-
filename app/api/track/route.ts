import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const ALLOWED_EVENT_TYPES = ["page_view", "cta_click"] as const;
type EventType = (typeof ALLOWED_EVENT_TYPES)[number];

const ALLOWED_CTA_IDS = ["hero_primary", "final_cta"] as const;
type CtaId = (typeof ALLOWED_CTA_IDS)[number];

type TrackBody = {
  event?: string;
  ctaId?: string;
  path?: string;
  sessionId?: string;
};

/**
 * Enregistre les visites et clics CTA de /landing dans `landing_events`
 * (voir supabase/migrations/0007_landing_events.sql). Alimenté par
 * lib/analytics.ts, appelé via navigator.sendBeacon depuis le client.
 */
export async function POST(req: NextRequest) {
  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return NextResponse.json(
      { error: "Requête invalide : corps JSON illisible." },
      { status: 400 },
    );
  }

  const { event, ctaId, path, sessionId } = body;

  if (!event || !ALLOWED_EVENT_TYPES.includes(event as EventType)) {
    return NextResponse.json(
      { error: "Type d'événement invalide." },
      { status: 400 },
    );
  }

  if (ctaId && !ALLOWED_CTA_IDS.includes(ctaId as CtaId)) {
    return NextResponse.json(
      { error: "Identifiant de CTA invalide." },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("landing_events").insert({
    event_type: event,
    cta_id: ctaId ?? null,
    path: typeof path === "string" && path ? path.slice(0, 200) : "/landing",
    session_id: typeof sessionId === "string" ? sessionId.slice(0, 100) : null,
    referrer: req.headers.get("referer")?.slice(0, 500) ?? null,
  });

  if (error) {
    return NextResponse.json(
      { error: "Impossible d'enregistrer l'événement." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
