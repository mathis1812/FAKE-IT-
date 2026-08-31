import type { Metadata } from "next";
import TemplateHeader from "@/components/TemplateHeader";

/**
 * Écran « Red Snap », atteint depuis la carte jaune du menu.
 *
 * Relevé en direct sur l'écran équivalent du modèle (`/methode`) le 31/08,
 * en lisant son DOM plutôt qu'en recopiant une capture :
 *
 * - Le fond n'est pas une bande dans le flux mais un calque `fixed` de
 *   300vh posé à `top:-100vh`, en `z-index:-10`, portant un dégradé jaune
 *   Snapchat → #121212. Ainsi le jaune reste collé au haut de l'écran quel
 *   que soit le défilement, au lieu de défiler avec le contenu.
 * - Le titre de l'en-tête y passe en foncé et en 1.8rem (leur variable
 *   `--titre-barre` vaut #121212 sur cette page) : un titre blanc serait
 *   illisible sur le jaune.
 * - La vidéo est encadrée par deux boîtes arrondies imbriquées, et sa
 *   largeur est plafonnée pour que sa hauteur ne dépasse jamais 84dvh.
 *
 * La vidéo elle-même n'est pas embarquée dans le dépôt : sur le modèle elle
 * pèse ~78 Mo et est servie depuis un stockage privé par URL signée. Elle
 * vient donc d'une variable d'environnement, et l'écran reste cohérent tant
 * qu'elle n'est pas fournie.
 */

export const metadata: Metadata = {
  title: "Red Snap — Bluminoo",
  description:
    "Send your Bluminoo generations as a Red Snap, straight from your camera roll.",
};

/** Format exact du tutoriel du modèle : capture d'écran de téléphone. */
const VIDEO_ASPECT_RATIO = "1080 / 2346";
/**
 * Hauteur maximale laissée à la vidéo. La largeur en découle par le ratio,
 * moins les 16px de marge intérieure du cadre (`p-2`) — même calcul que le
 * modèle, écrit ici lisiblement plutôt qu'en constante pré-multipliée.
 */
const VIDEO_MAX_WIDTH = "min(100%, calc((84dvh - 16px) * (1080 / 2346)))";

export default function RedSnapPage() {
  const videoUrl = process.env.NEXT_PUBLIC_RED_SNAP_VIDEO_URL;

  return (
    <>
      {/* Calque de fond : hors flux, derrière tout (z-index négatif), il
          déborde volontairement d'un écran vers le haut pour que le jaune
          ne se décolle jamais du bord supérieur. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: "-100vh",
          height: "300vh",
          zIndex: -10,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(to bottom, #FFFC00 0%, #FFFC00 34.67%, #121212 46.67%)",
        }}
      />

      <TemplateHeader
        backHref="/"
        title="Snapchat"
        titleClassName="text-[1.8rem] text-[#121212]"
      />

      <main className="flex min-h-dvh flex-col gap-3 px-2 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+76px)]">
        {/* flex-1 : la carte sombre descend jusqu'en bas de l'écran, comme
            sur le modèle — lui y arrive via une variable propre au studio,
            qui n'aurait pas de sens hors de cet écran. */}
        <section className="animate-fade-up flex flex-1 flex-col gap-3 rounded-3xl bg-[#121212] p-4 pt-6">
          <span className="text-center text-[28px] font-semibold leading-tight text-white">
            Send your AI generations
            <br />
            as a Red Snap
          </span>

          <div
            className="mx-auto mt-2 w-full rounded-[32px] border border-[#1d2222] bg-[#0b1010] p-2"
            style={{ maxWidth: VIDEO_MAX_WIDTH }}
          >
            <div
              className="relative w-full overflow-hidden rounded-3xl border border-[#141919]"
              style={{ aspectRatio: VIDEO_ASPECT_RATIO }}
            >
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                // Sans vidéo configurée, on garde le cadre (donc la mise en
                // page reste juste) et on dit ce qui manque, plutôt que de
                // laisser un rectangle noir muet.
                <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[14px] leading-snug text-white/40">
                  The walkthrough video isn&apos;t configured yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
