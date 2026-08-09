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
      className={`relative overflow-hidden rounded-3xl border border-foreground/[0.08] bg-panel/85 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
