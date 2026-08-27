"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

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

/**
 * Pied de page partagé, aligné sur le modèle : ni bordure ni bandeau, tout
 * centré, très discret sur le noir. La marge basse intègre la zone de
 * sécurité iOS, sinon les liens passent sous la barre d'accueil.
 */
export default function SiteFooter() {
  const pathname = usePathname();
  // Le studio et les écrans de gabarit sont un shell plein écran, sans pied
  // de page — même retrait que SiteHeader, pour la même raison.
  if (pathname === "/" || pathname.startsWith("/templates")) return null;

  const links = [...PRODUCT_LINKS, ...LEGAL_LINKS];

  return (
    <footer className="px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2 text-center text-[13px] text-white/35">
      <p>© {new Date().getFullYear()} Bluminoo Studio. All rights reserved.</p>
      <nav className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {links.map((link, index) => (
          <Fragment key={link.href}>
            {index > 0 && <span aria-hidden>·</span>}
            <Link
              href={link.href}
              className="underline underline-offset-2 transition active:opacity-70"
            >
              {link.label}
            </Link>
          </Fragment>
        ))}
      </nav>
    </footer>
  );
}
