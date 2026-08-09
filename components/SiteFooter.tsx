import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgv", label: "CGV" },
  { href: "/confidentialite", label: "Confidentialité" },
] as const;

/** Pied de page partagé : liens légaux, purement présentationnel. */
export default function SiteFooter() {
  return (
    <footer className="border-t border-foreground/[0.06] py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 text-xs text-foreground/50 sm:flex-row sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Bluminoo Studio</p>
        <nav className="flex items-center gap-4">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-foreground/85"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
