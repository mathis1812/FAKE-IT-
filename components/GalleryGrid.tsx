"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";

type GalleryEntry = {
  id: string;
  mode: "image" | "video";
  result_url: string;
  label: string;
  created_at: string;
};

function extensionFor(entry: GalleryEntry): string {
  if (entry.mode === "video") return "mp4";
  const match = /\.([a-z0-9]+)(?:\?|$)/i.exec(entry.result_url);
  return match ? match[1] : "png";
}

async function downloadEntry(entry: GalleryEntry) {
  const res = await fetch(entry.result_url);
  if (!res.ok) return;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `bluminoo-${entry.id}.${extensionFor(entry)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function GalleryGrid({ entries }: { entries: GalleryEntry[] }) {
  const [selected, setSelected] = useState<GalleryEntry | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selected]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry) => (
          <Panel key={entry.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setSelected(entry)}
              className="block w-full cursor-zoom-in"
              aria-label={`Voir en grand : ${entry.label}`}
            >
              {entry.mode === "video" ? (
                <video
                  src={entry.result_url}
                  muted
                  loop
                  playsInline
                  className="aspect-square w-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.result_url}
                  alt={entry.label}
                  className="aspect-square w-full object-cover"
                />
              )}
            </button>
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-neutral-200">
                  {entry.label}
                </p>
                <p className="text-[11px] text-neutral-600">
                  {formatDate(entry.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void downloadEntry(entry)}
                aria-label={`Télécharger : ${entry.label}`}
                className="shrink-0 rounded-full border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </Panel>
        ))}
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {selected.mode === "video" ? (
              <video
                src={selected.result_url}
                controls
                autoPlay
                loop
                playsInline
                className="max-h-[85vh] w-full rounded-2xl object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.result_url}
                alt={selected.label}
                className="max-h-[85vh] w-full rounded-2xl object-contain"
              />
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-neutral-100">
                  {selected.label}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatDate(selected.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void downloadEntry(selected)}
                  className="rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-ink transition hover:bg-primary-soft"
                >
                  Télécharger
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-neutral-300 transition hover:border-white/20"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
