import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import StudioBackdrop from "@/components/StudioBackdrop";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
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
