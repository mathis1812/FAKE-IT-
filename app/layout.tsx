import type { Metadata } from "next";
import { Cormorant, Montserrat } from "next/font/google";
import "./globals.css";
import StudioBackdrop from "@/components/StudioBackdrop";
import SiteHeader from "@/components/SiteHeader";

const cormorant = Cormorant({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Bluminoo Studio",
  description:
    "Uploadez une photo et générez une version ultra-réaliste avec un élément de luxe intégré.",
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
              <footer className="mt-12 text-center text-[11px] uppercase tracking-[0.18em] text-neutral-700">
                Gemini Flash Image · Kling O3 · React Bits
              </footer>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
