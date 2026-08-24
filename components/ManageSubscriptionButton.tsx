"use client";

import { useState } from "react";
import type { PlanId } from "@/lib/stripe";

export default function ManageSubscriptionButton({
  targetPlan,
}: {
  targetPlan?: PlanId;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setNotice(null);
    setPortalUrl(null);

    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        ...(targetPlan
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetPlan }),
            }
          : {}),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(
          data.error ?? "Something went wrong, please try again in a moment.",
        );
        setLoading(false);
        return;
      }

      // Abonnement en euros (ancienne tarification) : le backend renvoie un
      // message d'explication à afficher avant de rediriger vers le portail.
      // On l'affiche dans la page et on laisse l'utilisateur poursuivre
      // lui-même, plutôt que de rediriger automatiquement en dessous de lui.
      if (data.message) {
        setNotice(data.message);
        setPortalUrl(data.url);
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Something went wrong, please try again in a moment.");
      setLoading(false);
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm font-medium text-primary-soft underline underline-offset-2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? "Redirecting…"
          : targetPlan
            ? "Switch to this plan"
            : "Manage my subscription"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {notice && portalUrl && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-neutral-400">{notice}</p>
          <a
            href={portalUrl}
            className="inline-block rounded-2xl border border-white/10 px-4 py-2 text-xs font-medium text-neutral-300 transition hover:border-white/20 hover:text-white"
          >
            Continue to billing portal
          </a>
        </div>
      )}
    </div>
  );
}
