import type { ReactNode } from "react";

/**
 * Conteneur vitré du studio. Volontairement sans état ni écouteur souris :
 * il remplace l'ancien SpotlightCard, qui repeignait un dégradé radial et
 * déclenchait deux rendus React à chaque déplacement du curseur.
 */
export default function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12100e]/90 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
