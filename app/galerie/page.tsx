"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  clearGallery,
  loadGallery,
  removeGalleryItem,
  type GalleryItem,
} from "@/lib/gallery";

export default function GaleriePage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(loadGallery());
    setReady(true);
  }, []);

  const onClear = useCallback(() => {
    clearGallery();
    setItems([]);
  }, []);

  const onRemove = useCallback((id: string) => {
    setItems(removeGalleryItem(id));
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary">
            Galerie
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight text-white">
            Vos créations récentes
          </h1>
          <p className="mt-3 max-w-lg text-sm text-neutral-400">
            Stockage local sur cet appareil — jusqu’à 24 rendus image ou vidéo
            générés depuis le studio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-primary-soft"
          >
            Nouveau rendu
          </Link>
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="cursor-pointer rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300 transition hover:border-white/25 hover:text-white"
            >
              Tout effacer
            </button>
          )}
        </div>
      </div>

      {!ready ? (
        <p className="mt-16 text-sm text-neutral-500">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="mt-16 max-w-md">
          <p className="font-display text-2xl text-white">Galerie vide</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Lancez une génération dans le studio : le résultat sera ajouté ici
            automatiquement.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex text-xs font-semibold uppercase tracking-[0.14em] text-primary transition hover:text-primary-soft"
          >
            Aller au studio →
          </Link>
        </div>
      ) : (
        <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/40">
                {item.type === "video" ? (
                  <video
                    src={item.url}
                    className="aspect-square w-full object-cover"
                    controls
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.label || "Rendu Bluminoo"}
                    className="aspect-square w-full object-cover"
                  />
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">
                    {item.label || (item.type === "video" ? "Vidéo" : "Image")}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {new Date(item.createdAt).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a
                    href={item.url}
                    download={`bluminoo-${item.type}-${item.id}`}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-300 transition hover:border-primary/40 hover:text-white"
                  >
                    Télécharger
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="cursor-pointer rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 transition hover:border-red-400/40 hover:text-red-300"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
