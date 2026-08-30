"use client";

import { usePathname } from "next/navigation";
import { hasOwnHeader } from "@/lib/app-shell-routes";

/**
 * Le `<main>` global appliquait `mx-auto max-w-7xl px-4 py-8` à TOUTES les
 * pages — pensé pour la vitrine (marketing), pas pour les écrans plein
 * écran (studio, gabarits, galerie, réglages, tarifs) qui gèrent déjà leur
 * propre hauteur (`h-dvh`) et leur propre respiration.
 *
 * Trouvé le 30/08 en traçant pourquoi la carte du studio débordait
 * systématiquement de l'écran, quelle que soit la structure interne
 * corrigée : ce `py-8` (64px) s'additionnait TOUJOURS par-dessus, sur
 * toutes les pages à en-tête propre. C'était la vraie cause des
 * débordements corrigés au pansement plus tôt dans le projet.
 *
 * Même prédicat que SiteHeader/SiteFooter : les écrans à en-tête propre
 * reçoivent un `<main>` nu, les autres gardent le conteneur marketing.
 */
export default function MainShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (hasOwnHeader(pathname)) {
    return <main>{children}</main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      {children}
    </main>
  );
}
