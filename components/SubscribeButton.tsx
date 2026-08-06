"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanId } from "@/lib/stripe";

export default function SubscribeButton({
  plan,
  isLoggedIn,
}: {
  plan: PlanId;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!isLoggedIn) {
      router.push("/connexion");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
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
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-ink transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirection…" : "S'abonner"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
