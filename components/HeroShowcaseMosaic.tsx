/**
 * Mosaïque de rendus affichée en fond du hero de la landing.
 *
 * Deux rangées de vignettes inclinées qui défilent horizontalement, comme
 * une planche-contact posée en biais derrière le titre. Le composant est
 * volontairement décoratif : `aria-hidden` et `pointer-events-none`, il
 * n'est ni annoncé par les lecteurs d'écran ni cliquable.
 *
 * Le fondu du bas ne va PAS vers une couleur opaque mais vers la couleur de
 * fond du site avec une opacité croissante : `StudioBackdrop` (le shader
 * violet monté globalement dans app/layout.tsx) est derrière, et c'est lui
 * qui doit réapparaître à mesure que la mosaïque s'efface.
 */

const SHOWCASE_COUNT = 18;

/** Les 18 vignettes disponibles dans public/landing/showcase/. */
const SHOWCASE_IMAGES = Array.from(
  { length: SHOWCASE_COUNT },
  (_, i) => `/landing/showcase/${i + 1}.webp`,
);

/** Répétitions pour remplir la largeur sans trou, comme sur la référence. */
const ROW_REPEATS = 3;

function MosaicRow({
  images,
  direction,
}: {
  images: string[];
  direction: "left" | "right";
}) {
  // Même mécanique que le bandeau de témoignages : la liste est rendue deux
  // fois et l'animation translate d'exactement une copie (-100%), ce qui
  // rend la boucle sans couture. Retirer la duplication casserait l'effet.
  const animation =
    direction === "left" ? "animate-marquee-left" : "animate-marquee-right";

  return (
    <div className="flex">
      {[0, 1].map((copy) => (
        <div
          key={copy}
          className={`flex shrink-0 gap-6 pr-6 ${animation} motion-reduce:animate-none`}
        >
          {images.map((src, i) => (
            <div
              key={`${copy}-${i}`}
              className="aspect-[3/4] w-[150px] shrink-0 overflow-hidden rounded-xl bg-white/[0.04] shadow-2xl sm:w-[220px] md:w-[280px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                width={700}
                height={1254}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover grayscale-[25%]"
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function HeroShowcaseMosaic() {
  const repeated = Array.from({ length: ROW_REPEATS }, () => SHOWCASE_IMAGES)
    .flat();
  const half = Math.ceil(repeated.length / 2);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden opacity-40"
    >
      <div className="absolute inset-0 -rotate-12 scale-[1.35] sm:scale-125 lg:scale-110">
        <div className="flex flex-col gap-6 pt-10">
          <MosaicRow images={repeated.slice(0, half)} direction="left" />
          <MosaicRow images={repeated.slice(half)} direction="right" />
        </div>
      </div>

      {/* Fondu vers le fond du site : laisse réapparaître StudioBackdrop. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0810]/70 via-[#0a0810]/30 to-[#0a0810]" />
    </div>
  );
}
