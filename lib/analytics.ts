"use client";

const TRACK_ENDPOINT = "/api/track";
const SESSION_STORAGE_KEY = "bluminoo_landing_session_id";

export type LandingCtaId = "hero_primary" | "final_cta";

/**
 * Identifiant de session éphémère (sessionStorage, pas de cookie tiers ni de
 * PII) pour pouvoir relier une visite /landing à ses propres clics dans la
 * même session, sans rien partager entre visiteurs.
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

function send(event: "page_view" | "cta_click", ctaId?: LandingCtaId) {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    event,
    ctaId,
    path: window.location.pathname,
    sessionId: getSessionId(),
  });

  // sendBeacon survit à la navigation déclenchée par le clic CTA (un fetch
  // classique peut être annulé par le changement de page) ; fallback fetch
  // keepalive si sendBeacon est indisponible.
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon(TRACK_ENDPOINT, blob)) return;
  }

  fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Best-effort : un échec de tracking ne doit jamais bloquer l'usage.
  });
}

export function trackLandingPageView() {
  send("page_view");
}

export function trackLandingCtaClick(ctaId: LandingCtaId) {
  send("cta_click", ctaId);
}
