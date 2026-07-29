"use client";

import dynamic from "next/dynamic";

const DotField = dynamic(() => import("@/components/react-bits/DotField"), {
  ssr: false,
});

const ColorBends = dynamic(
  () => import("@/components/react-bits/ColorBends"),
  { ssr: false },
);

const BEND_COLOR = "#A855F7";

/** Fond animé partagé (DotField + ColorBends), rendu une seule fois dans le layout racine. */
export default function StudioBackdrop() {
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
