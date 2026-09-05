"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { EDIT_COST } from "@/lib/generation-cost";

/**
 * Retouche d'un rendu : le client décrit ce qu'il veut changer, et le rendu
 * repart au modèle avec sa propre URL comme photo source.
 *
 * Monté depuis deux endroits — juste après une génération (`ResultActions`)
 * et depuis la modale de la galerie (`GalleryGrid`). Le moment où l'on veut
 * retoucher est surtout celui où l'on découvre son rendu ; obliger à passer
 * par la galerie ajouterait une étape pour rien. D'où un seul composant et
 * deux points d'entrée, plutôt que deux implémentations qui divergeraient.
 *
 * Le résultat est une NOUVELLE entrée de galerie, jamais un remplacement :
 * c'est une génération, elle est facturée, et le client garde les deux
 * versions. Elle est elle-même retouchable, via `onEdited` qui remonte la
 * nouvelle URL à l'appelant.
 */
export default function EditPanel({
  sourceUrl,
  label,
  onEdited,
  onCancel,
}: {
  sourceUrl: string;
  /** Libellé de l'entrée d'origine, repris pour nommer la retouche. */
  label?: string;
  onEdited: (imageUrl: string) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trimmed = description.trim();
  const canSubmit = trimmed.length > 0 && !loading;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrl: sourceUrl,
          editPrompt: trimmed,
          label: label ? `${label} — edit` : "Edit",
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Edit failed. Please try again.");
        return;
      }
      if (!data?.imageUrl) {
        setError("Unexpected response from the server. Please try again.");
        return;
      }
      setDescription("");
      onEdited(data.imageUrl as string);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Network error during the edit. Check your connection.",
      );
    } finally {
      setLoading(false);
    }
  }, [canSubmit, label, onEdited, sourceUrl, trimmed]);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="relative w-full overflow-hidden rounded-2xl bg-black/40">
        <Image
          src={sourceUrl}
          alt="Image being edited"
          width={1200}
          height={900}
          unoptimized
          className="h-auto w-full object-contain"
        />
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        // Le plafond est aussi appliqué côté serveur : celui-ci n'est qu'un
        // confort, il évite d'envoyer une requête vouée au 400.
        maxLength={500}
        rows={2}
        disabled={loading}
        placeholder="Describe what you want to change…"
        aria-label="Describe what you want to change"
        className="w-full resize-none rounded-2xl bg-white/5 px-4 py-3 text-[15px] leading-snug text-white outline-none ring-1 ring-white/10 placeholder:text-white/40 focus:ring-white/25 disabled:opacity-60"
      />

      {error && (
        <p role="alert" className="text-[13px] text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="h-11 rounded-full px-5 text-[15px] font-semibold text-white/70 transition-opacity active:opacity-70 disabled:opacity-40"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-black transition-opacity active:opacity-80 disabled:opacity-40"
        >
          {loading ? "Editing…" : "Edit"}
          <span aria-hidden>·</span>
          <span>{EDIT_COST}</span>
        </button>
      </div>
    </div>
  );
}
