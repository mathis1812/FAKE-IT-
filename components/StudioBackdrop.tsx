"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const DotField = dynamic(() => import("@/components/react-bits/DotField"), {
  ssr: false,
});

const ColorBends = dynamic(
  () => import("@/components/react-bits/ColorBends"),
  { ssr: false },
);

const BEND_COLOR = "#A855F7";

/**
 * Décide si cet appareil doit charger les fonds animés.
 *
 * `ColorBends` tire `three` derrière lui : ~140 Ko gzip de JavaScript, plus
 * un shader plein écran qui tourne en continu. C'est le poste le plus lourd
 * du premier chargement, pour un élément purement décoratif — donc le
 * premier à sacrifier dès que l'appareil ou la connexion ne suivent pas.
 *
 * Les seuils visent les téléphones d'entrée et milieu de gamme, où le coût
 * se paie deux fois : au téléchargement, puis à chaque frame.
 */
function canAffordAnimatedBackdrop(): boolean {
  if (typeof window === "undefined") return false;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };

  if (nav.connection?.saveData) return false;
  if (
    nav.connection?.effectiveType &&
    ["slow-2g", "2g", "3g"].includes(nav.connection.effectiveType)
  ) {
    return false;
  }
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false;
  if (
    typeof nav.hardwareConcurrency === "number" &&
    nav.hardwareConcurrency < 4
  ) {
    return false;
  }

  return true;
}

/** Repli statique : le même dégradé violet, sans JavaScript ni frame. */
function StaticBackdrop() {
  return <div className="studio-backdrop-static" aria-hidden />;
}

/**
 * Fond animé partagé, rendu une seule fois dans le layout racine.
 *
 * Le chargement est volontairement repoussé après l'interactivité :
 * `dynamic()` seul déclencherait le téléchargement dès l'hydratation, c'est
 * à dire en concurrence directe avec le JavaScript dont la page a réellement
 * besoin. On attend donc que le navigateur soit inactif, avec un repli CSS
 * affiché pendant ce temps — l'utilisateur ne voit pas de trou, juste un
 * dégradé qui s'anime une seconde plus tard.
 */
export default function StudioBackdrop() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!canAffordAnimatedBackdrop()) return;

    const start = () => setAnimated(true);
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;

    // Safari n'a pas requestIdleCallback : un timer court joue le même rôle.
    if (idle) {
      const handle = idle(start, { timeout: 2500 });
      return () => {
        (
          window as Window & { cancelIdleCallback?: (h: number) => void }
        ).cancelIdleCallback?.(handle);
      };
    }
    const timer = setTimeout(start, 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!animated) {
    return (
      <>
        <StaticBackdrop />
        <div className="studio-vignette" aria-hidden />
      </>
    );
  }

  return (
    <>
      <div className="studio-backdrop" aria-hidden>
        <div className="absolute inset-0">
          <DotField
            dotRadius={1.5}
            dotSpacing={14}
            cursorRadius={500}
            cursorForce={0.1}
            bulgeOnly
            bulgeStrength={67}
            glowRadius={160}
            sparkle={false}
            waveAmplitude={0}
          />
        </div>
        <div className="absolute inset-0">
          <ColorBends
            color={BEND_COLOR}
            rotation={90}
            speed={0.2}
            scale={1}
            frequency={1}
            warpStrength={1}
            yOffset={0.3}
            mouseInfluence={0.3}
            noise={0.15}
            iterations={1}
            intensity={1.3}
            bandWidth={0.14}
            fadeTop={0.75}
          />
        </div>
      </div>
      <div className="studio-vignette" aria-hidden />
    </>
  );
}
