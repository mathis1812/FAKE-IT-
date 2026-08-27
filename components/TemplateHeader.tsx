import Link from "next/link";

/**
 * Barre supérieure des écrans de gabarit : un retour à gauche, le titre
 * centré. Le studio et la vitrine ont chacun la leur ; celle-ci suit le
 * modèle, où chaque niveau se referme d'un seul geste vers le précédent.
 */
export default function TemplateHeader({
  backHref,
  title,
}: {
  backHref: string;
  title: string;
}) {
  return (
    <header className="relative flex h-[68px] items-center px-4">
      <Link
        href={backHref}
        aria-label="Back"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#2d2d2d] bg-[#161616] text-white transition active:opacity-80"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[18px] w-[18px]"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      {/* Centré sur la page et non sur l'espace restant : sinon le titre se
          décale selon la largeur du bouton de retour. */}
      <h1 className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[17px] font-semibold text-white">
        {title}
      </h1>
    </header>
  );
}
