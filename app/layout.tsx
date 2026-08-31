import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import AuthSheet from "@/components/AuthSheet";
import MainShell from "@/components/MainShell";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const SITE_URL = "https://bluminoo.vercel.app";
const SITE_TITLE = "Bluminoo Studio";
const SITE_DESCRIPTION =
  "Create a hyper-realistic photo or video of the life you dream about — a place, a scene, a moment — and post it to your story to stun everyone you know.";

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
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

/**
 * Décide s'il faut jouer l'animation d'intro, AVANT le premier rendu.
 *
 * Relevé sur le modèle le 31/08. Deux contraintes expliquent sa forme :
 *
 * - Il doit être synchrone et dans le `<head>` : poser `data-intro` après
 *   la peinture ferait clignoter l'écran d'accueil avant que le voile noir
 *   n'arrive. C'est aussi pourquoi l'animation est purement CSS et pilotée
 *   par un attribut, plutôt que montée par React après hydratation.
 * - `!(now - last < WINDOW)` plutôt que `now - last >= WINDOW` : au tout
 *   premier passage `last` vaut NaN, et toute comparaison avec NaN est
 *   fausse. La forme négative rend donc vrai ce premier cas, là où la
 *   forme directe l'aurait raté et n'aurait jamais montré l'intro à un
 *   nouveau visiteur.
 *
 * La date de visite est réécrite à chaque masquage de l'onglet, pas
 * seulement au chargement : sans cela, un onglet laissé ouvert une journée
 * rejouerait l'intro à la première interaction.
 */
const INTRO_GATE = `(function(){try{
var k="bluminoo:last-visit",s=1800000,d=Date.now();
var t=parseInt(localStorage.getItem(k),10);
if(!(d-t<s))document.documentElement.setAttribute("data-intro","1");
var m=function(){try{localStorage.setItem(k,String(Date.now()))}catch(e){}};
m();
addEventListener("pagehide",m);
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")m()});
}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning : le script ci-dessus pose `data-intro` sur
    // <html> avant l'hydratation, donc le balisage rendu par le serveur et
    // celui trouvé par React diffèrent forcément sur cet attribut.
    <html lang="en" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_GATE }} />
      </head>
      <body className="bg-ink font-body text-neutral-100 antialiased">
        {/* Voile d'intro. Toujours présent dans le balisage mais masqué par
            défaut (`display:none`) : c'est `data-intro` qui l'allume, de
            sorte qu'un visiteur revenu depuis moins de 30 min ne le voit
            jamais, même une fraction de seconde. */}
        <div
          className="intro pointer-events-none fixed inset-0 z-[100] bg-black"
          aria-hidden
        >
          <p className="intro-titre text-[3rem] font-bold tracking-tight text-white">
            Bluminoo
          </p>
        </div>

        <div className="studio-shell min-h-screen">
          <div className="studio-content min-h-screen">
            <SiteHeader />
            <MainShell>{children}</MainShell>
            <SiteFooter />
          </div>
          <AuthSheet />
        </div>
      </body>
    </html>
  );
}
