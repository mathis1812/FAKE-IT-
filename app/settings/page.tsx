"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TemplateHeader from "@/components/TemplateHeader";
import { createClient } from "@/lib/supabase/client";

/**
 * Réglages, avec la seule action qu'ils portent sur le modèle : supprimer
 * son compte. Deux temps, relevés en cliquant en direct sur le produit de
 * référence — sans confirmation intermédiaire, un tel bouton n'aurait pas
 * dû exister.
 *
 * 1. Bouton neutre « Delete account » avec l'avertissement court déjà
 *    visible.
 * 2. Une fois cliqué, un second avertissement plus dur remplace le premier,
 *    aux côtés du bouton rouge de confirmation et d'un lien « Cancel ».
 *    C'est seulement à ce second clic que POST /api/account/delete part.
 */
export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? "");
    });
  }, []);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Unable to delete your account. Please try again.");
        return;
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/sign-in");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }, [router]);

  return (
    <>
      <TemplateHeader backHref="/" title="Settings" />

      <div className="flex min-h-dvh flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+76px)]">
        <section className="flex flex-col gap-1 rounded-3xl border-[1.5px] border-white/15 bg-black/30 p-4">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-white/40">
            Account
          </span>
          <span className="text-[17px] font-medium text-white">{email}</span>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border-[1.5px] border-white/15 bg-black/30 p-4">
          {confirming ? (
            <>
              <p className="text-base leading-6 text-white/70">
                All your creations — uploaded photos, generated images and
                videos — will be deleted from our servers, permanently. Any
                subscription is cancelled immediately, and your account
                disappears. Nothing is kept, nothing can be recovered.
              </p>
              {error && (
                <p role="alert" className="text-[14px] text-red-400">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex h-14 w-full items-center justify-center rounded-3xl border-[1.5px] border-[#3a3a3a] bg-[#212121] text-[17px] font-semibold text-[#ff453a] transition active:opacity-90 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Permanently delete my account"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="self-center py-2 text-base text-white/45 transition active:opacity-70 disabled:opacity-40"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <p className="text-base leading-6 text-white/70">
                Deleting your account erases everything it holds — creations,
                credits, subscription. It&apos;s immediate and can&apos;t be
                undone.
              </p>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex h-14 w-full items-center justify-center rounded-3xl border-[1.5px] border-white/15 bg-black/30 text-[17px] font-medium text-white transition active:opacity-70"
              >
                Delete account
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
