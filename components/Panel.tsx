import type { ReactNode } from "react";

/** Conteneur vitré du studio, sans état ni écouteur : purement présentationnel. */
export default function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#13101b]/85 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
