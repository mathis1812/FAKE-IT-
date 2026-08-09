"use client";

import { useState } from "react";

export default function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(
          data.error ?? "Une erreur est survenue, réessaie dans quelques instants.",
        );
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Une erreur est survenue, réessaie dans quelques instants.");
      setLoading(false);
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm font-medium text-[var(--link)] underline underline-offset-2 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirection…" : "Gérer mon abonnement"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
