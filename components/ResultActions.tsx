"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { sendAsRedSnap as sendAsRedSnapFn } from "@/lib/share-utils";

/**
 * Actions proposées une fois le rendu obtenu, partagées par le studio et
 * les pages de gabarit.
 *
 * Le Red Snap est un avantage des paliers Essentiel et Ultimate, annoncé
 * comme tel sur /pricing. Un abonné Starter voit à la place une invitation
 * à le débloquer : si cette distinction saute, la grille tarifaire ment.
 */
export default function ResultActions({
  resultUrl,
  hasRedSnap,
  canShare,
  onReset,
  onError,
}: {
  resultUrl: string;
  hasRedSnap: boolean;
  canShare: boolean;
  onReset: () => void;
  onError: (message: string) => void;
}) {
  const [sendingRedSnap, setSendingRedSnap] = useState(false);

  const download = useCallback(async () => {
    if (!resultUrl) return;

    const fallbackToAnchor = () => {
      const a = document.createElement("a");
      a.href = resultUrl;
      a.download = "bluminoo-result.png";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const file = new File([blob], "bluminoo-result.png", {
        type: blob.type || "image/png",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      // L'utilisateur a simplement fermé la feuille de partage : ne pas
      // enchaîner sur un téléchargement qu'il n'a pas demandé.
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    fallbackToAnchor();
  }, [resultUrl]);

  const sendAsRedSnap = useCallback(async () => {
    await sendAsRedSnapFn(resultUrl, (patch) => {
      if (patch.sendingRedSnap !== undefined)
        setSendingRedSnap(patch.sendingRedSnap);
      if (patch.error !== undefined) onError(patch.error);
    });
  }, [resultUrl, onError]);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={download}
        className="flex h-12 items-center justify-center rounded-3xl bg-white px-6 text-[16px] font-semibold text-black transition active:opacity-90"
      >
        {canShare ? "Save" : "Download"}
      </button>

      {hasRedSnap ? (
        <button
          type="button"
          onClick={sendAsRedSnap}
          disabled={sendingRedSnap}
          className="flex h-12 items-center justify-center rounded-3xl border-[1.5px] border-white/20 px-6 text-[16px] font-medium text-white transition active:opacity-90 disabled:opacity-60"
        >
          {sendingRedSnap ? "Preparing…" : "Send as Red Snap"}
        </button>
      ) : (
        <Link
          href="/pricing"
          className="flex h-12 items-center justify-center rounded-3xl border-[1.5px] border-white/20 px-6 text-[16px] font-medium text-white transition active:opacity-90"
        >
          Unlock Red Snap
        </Link>
      )}

      <button
        type="button"
        onClick={onReset}
        className="flex h-12 items-center justify-center rounded-3xl px-4 text-[16px] font-medium text-white/50 transition active:opacity-70"
      >
        New photo
      </button>
    </div>
  );
}
