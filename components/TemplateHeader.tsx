import Link from "next/link";

/**
 * Barre supérieure des écrans de gabarit, et de la galerie.
 *
 * Corrigé le 29/08 : ce n'était pas un bloc en flux normal de 68px comme
 * construit d'abord, mais l'en-tête PARTAGÉ que le modèle pose en position
 * fixe sur tous ses écrans secondaires — relevé en inspectant `/galerie` et
 * `/templates/<slug>`, qui portent la même empreinte de classes. Ses
 * consommateurs réservent l'espace avec `pt-[calc(env(safe-area-inset-top)
 * +76px)]` plutôt que de compter sur sa hauteur en flux.
 */
export default function TemplateHeader({
  backHref,
  title,
  titleClassName = "text-[1.3rem] text-white",
}: {
  backHref: string;
  title: string;
  /**
   * Taille et couleur du titre. Par défaut celles des écrans sombres, mais
   * /red-snap pose un fond jaune Snapchat sous cet en-tête : le modèle y
   * bascule le titre en foncé et l'agrandit (sa variable `--titre-barre`
   * passe à #121212, et le titre à 1.8rem). Sans ce point d'entrée, un
   * titre blanc y serait illisible.
   */
  titleClassName?: string;
}) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      <Link
        href={backHref}
        aria-label="Back"
        className="pointer-events-auto flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#2d2d2d] bg-[#161616] text-white transition active:opacity-80"
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
      <span
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-bold tracking-tight ${titleClassName}`}
      >
        {title}
      </span>
    </header>
  );
}
