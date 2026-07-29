"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import PlaceholderSection from "@/components/PlaceholderSection";
import { listGalleryEntries, type GalleryEntry } from "@/lib/gallery";

export default function GaleriePage() {
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);

  useEffect(() => {
    listGalleryEntries()
      .then(setEntries)
      .catch((err) => {
        console.error("Impossible de charger la galerie locale.", err);
        setEntries([]);
      });
  }, []);

  if (entries === null) {
    return null;
  }

  if (entries.length === 0) {
    return (
      <PlaceholderSection
        eyebrow="Galerie"
        title="Vos prochaines générations apparaîtront ici."
        description="Chaque génération réussie (image ou vidéo) est automatiquement sauvegardée dans ce navigateur — générez votre première photo ou vidéo pour la voir apparaître."
      />
    );
  }

  return (
    <div className="animate-fade-up mx-auto max-w-6xl py-8">
      <div className="mb-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
          Galerie
        </p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-white">
          Vos dernières générations
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map((entry) => (
          <Panel key={entry.id} className="overflow-hidden">
            {entry.mode === "video" ? (
              <video
                src={entry.resultUrl}
                controls
                muted
                loop
                playsInline
                className="aspect-square w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={entry.resultUrl}
                alt={entry.label}
                className="aspect-square w-full object-cover"
              />
            )}
            <div className="p-3">
              <p className="text-xs font-medium text-neutral-200">
                {entry.label}
              </p>
              <p className="text-[11px] text-neutral-600">
                {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
