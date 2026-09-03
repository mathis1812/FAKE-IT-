import type { Metadata } from "next";
import { Cormorant, Montserrat } from "next/font/google";
import "./globals.css";
import StudioBackdrop from "@/components/StudioBackdrop";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// Les graisses déclarées ici sont celles réellement utilisées dans les
// pages, et rien de plus : chaque graisse en trop est un fichier woff2
// téléchargé pour rien au premier rendu. Vérifiable d'une commande —
//   grep -roh "font-display[^\"]*" app components
// ne renvoie que `font-semibold`, d'où l'unique graisse 600 côté display.
// Ajouter une graisse ici sans l'utiliser, ou l'utiliser sans l'ajouter (la
// police serait alors synthétisée par le navigateur), sont deux erreurs
// symétriques : garder les deux listes alignées.
const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const SITE_URL = "https://bluminoo.vercel.app";
const SITE_TITLE = "Bluminoo Studio";
const SITE_DESCRIPTION =
  "Crée une photo ou une vidéo ultra-réaliste de la vie dont tu rêves — un lieu, une scène, un instant — et poste-la en story pour surprendre tout ton entourage.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body className="bg-ink font-body text-neutral-100 antialiased">
        <div className="studio-shell min-h-screen">
          <StudioBackdrop />
          <div className="studio-content min-h-screen">
            <SiteHeader />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
              {children}
            </main>
            <SiteFooter />
          </div>
        </div>
      </body>
    </html>
  );
}
