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

/**
 * Répétitions pour remplir la largeur sans trou.
 *
 * Le calcul, à ne pas baisser à l'aveugle : chaque rangée reçoit la moitié
 * des vignettes répétées, et le composant en rend deux copies pour la boucle
 * sans couture. À 2 répétitions cela fait 18 vignettes par copie, soit
 * ~5040 px à 280 px de large — assez pour couvrir n'importe quel écran même
 * avec la rotation et le `scale` appliqués au conteneur. Passer à 3 doublait
 * le nombre de nœuds (108 balises `img`) sans rien couvrir de plus.
 */
const ROW_REPEATS = 2;

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
                // Décor posé derrière le titre : il ne doit jamais disputer
                // la bande passante au texte et aux polices, qui portent le
                // LCP de la page.
                fetchPriority="low"
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

  // `left-[calc(50%-50vw)]` + `w-screen` sortent la mosaïque du conteneur
  // `max-w-6xl` de la page pour lui donner toute la largeur de la fenêtre.
  // Le débordement est contenu par `overflow-x: clip` sur `.studio-shell`.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-[calc(50%-50vw)] top-0 h-[760px] w-screen overflow-hidden opacity-[0.55]"
    >
      <div className="absolute inset-0 -rotate-12 scale-[1.35] sm:scale-125 lg:scale-110">
        <div className="flex flex-col gap-6 pt-10">
          <MosaicRow images={repeated.slice(0, half)} direction="left" />
          <MosaicRow images={repeated.slice(half)} direction="right" />
        </div>
      </div>

      {/* Fondu concentré sur le bas : le haut reste presque limpide pour ne
          pas ternir les photos, et seule la dernière portion se fond dans le
          fond du site pour laisser réapparaître StudioBackdrop. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-55% to-[#0a0810]" />
    </div>
  );
}
