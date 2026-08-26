import Link from "next/link";

/**
 * Liens produit rapatriés ici le 26/08, quand l'en-tête a été réduit à la
 * marque et au bouton de connexion : sans eux, ces trois pages ne seraient
 * plus atteignables par la navigation.
 */
const PRODUCT_LINKS = [
  { href: "/gallery", label: "Gallery" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
] as const;

const LEGAL_LINKS = [
  { href: "/legal", label: "Legal" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const;

/** Pied de page partagé : liens légaux, purement présentationnel. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 text-xs text-neutral-500 sm:flex-row sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Bluminoo Studio</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {PRODUCT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-neutral-300"
            >
              {link.label}
            </Link>
          ))}
          <span aria-hidden className="text-faint">
            ·
          </span>
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-neutral-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
